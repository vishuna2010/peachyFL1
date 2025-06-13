const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../auth');
const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationText } = require('../services/emailService');
const { NotFoundError, BadRequestError } = require('../utils/AppError');
const taxService = require('../services/taxService'); // Import taxService

// POST /api/orders - Create a new order
router.post('/', isAuthenticated, async (req, res) => {
  const { cart, shippingAddress, billingAddress, discount_code } = req.body;
  const userId = req.user.userId;

  // --- 1. Validate input ---
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ message: 'Cart is required and cannot be empty.' });
  }
  if (!shippingAddress || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
    return res.status(400).json({ message: 'Complete shipping address is required.' });
  }
  for (const item of cart) {
    if (!item.productId || typeof item.productId !== 'number' || !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
      return res.status(400).json({ message: 'Each cart item must have a valid base productId and a positive quantity.' });
    }
    if (item.productVariantId && typeof item.productVariantId !== 'number') {
        return res.status(400).json({ message: `Invalid productVariantId format for product ${item.productId}.`});
    }
  }

  const finalBillingAddress = billingAddress && billingAddress.line1 ? billingAddress : shippingAddress;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    let subtotalForItems = 0;
    const orderItemsToInsert = [];
    const stockUpdates = []; // { type: 'base' | 'variant', id: number, quantityToDecrement: number }

    for (const item of cart) {
      let priceAtPurchase;
      let productName;
      // let currentStock; // This will now be sum of batches or checked against aggregate first
      let productSku = null;
      let aggregate_old_stock_quantity; // For stock_movement_log

      if (item.productVariantId) {
        const variantAggregateResult = await client.query(
          `SELECT pv.stock_quantity, pv.price_modifier, pv.sku as variant_sku,
                  p.price as base_price, p.name as base_product_name, p.sku as base_product_sku
           FROM product_variants pv
           JOIN products p ON pv.product_id = p.id
           WHERE pv.id = $1 AND pv.product_id = $2 FOR UPDATE OF pv, p`, // Lock both product and variant
          [item.productVariantId, item.productId]
        );
        if (variantAggregateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: `Product variant with ID ${item.productVariantId} for product ID ${item.productId} not found.` });
        }
        const variantData = variantAggregateResult.rows[0];
        aggregate_old_stock_quantity = variantData.stock_quantity;
        priceAtPurchase = parseFloat(variantData.base_price) + parseFloat(variantData.price_modifier);
        productName = `${variantData.base_product_name} (Variant)`; // For error messages
        productSku = variantData.variant_sku || variantData.base_product_sku;


        if (aggregate_old_stock_quantity < item.quantity) { // Quick check against aggregate
          await client.query('ROLLBACK');
          throw new BadRequestError(`Not enough stock for variant "${productName}". Available: ${aggregate_old_stock_quantity}, Requested: ${item.quantity}.`);
        }

        // Batch deduction logic for variant
        const batches = await client.query(
          `SELECT id, current_quantity FROM inventory_batches
           WHERE product_id = $1 AND variant_id = $2 AND current_quantity > 0
           ORDER BY expiry_date ASC NULLS LAST, received_date ASC, id ASC FOR UPDATE`, // OF inventory_batches implied by context
          [item.productId, item.productVariantId]
        );

        let totalBatchStock = batches.rows.reduce((sum, batch) => sum + batch.current_quantity, 0);
        if (totalBatchStock < item.quantity) {
          await client.query('ROLLBACK');
          throw new BadRequestError(`Insufficient batch stock for variant "${productName}". Available in batches: ${totalBatchStock}, Requested: ${item.quantity}.`);
        }

        let qtyToFulfill = item.quantity;
        for (const batch of batches.rows) {
          if (qtyToFulfill === 0) break;
          const qtyFromThisBatch = Math.min(qtyToFulfill, batch.current_quantity);
          await client.query(
            'UPDATE inventory_batches SET current_quantity = current_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [qtyFromThisBatch, batch.id]
          );
          qtyToFulfill -= qtyFromThisBatch;
        }
        // End Batch deduction for variant

        stockUpdates.push({
          type: 'variant', id: item.productVariantId, productId: item.productId,
          quantityToDecrement: item.quantity, old_stock_quantity: aggregate_old_stock_quantity
        });

      } else { // Base Product
        const productAggregateResult = await client.query(
          'SELECT name, price, stock_quantity, sku FROM products WHERE id = $1 FOR UPDATE',
          [item.productId]
        );
        if (productAggregateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
        }
        const productData = productAggregateResult.rows[0];
        aggregate_old_stock_quantity = productData.stock_quantity;
        priceAtPurchase = parseFloat(productData.price);
        productName = productData.name; // For error messages
        productSku = productData.sku;

        if (aggregate_old_stock_quantity < item.quantity) { // Quick check
            await client.query('ROLLBACK');
            throw new BadRequestError(`Not enough stock for product "${productName}". Available: ${aggregate_old_stock_quantity}, Requested: ${item.quantity}.`);
        }

        // Batch deduction logic for base product
        const batches = await client.query(
          `SELECT id, current_quantity FROM inventory_batches
           WHERE product_id = $1 AND variant_id IS NULL AND current_quantity > 0
           ORDER BY expiry_date ASC NULLS LAST, received_date ASC, id ASC FOR UPDATE`, // OF inventory_batches implied
          [item.productId]
        );

        let totalBatchStock = batches.rows.reduce((sum, batch) => sum + batch.current_quantity, 0);
        if (totalBatchStock < item.quantity) {
          await client.query('ROLLBACK');
          throw new BadRequestError(`Insufficient batch stock for product "${productName}". Available in batches: ${totalBatchStock}, Requested: ${item.quantity}.`);
        }

        let qtyToFulfill = item.quantity;
        for (const batch of batches.rows) {
          if (qtyToFulfill === 0) break;
          const qtyFromThisBatch = Math.min(qtyToFulfill, batch.current_quantity);
          await client.query(
            'UPDATE inventory_batches SET current_quantity = current_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [qtyFromThisBatch, batch.id]
          );
          qtyToFulfill -= qtyFromThisBatch;
        }
        // End Batch deduction for base product

        stockUpdates.push({
          type: 'base', id: item.productId, productId: item.productId,
          quantityToDecrement: item.quantity, old_stock_quantity: aggregate_old_stock_quantity
        });
      }

      subtotalForItems += priceAtPurchase * item.quantity;
      orderItemsToInsert.push({
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        product_name: productName,
        quantity: item.quantity,
        priceAtPurchase: priceAtPurchase,
      });
    }

    subtotalForItems = parseFloat(subtotalForItems.toFixed(2));

    // --- Tax Calculation ---
    // finalBillingAddress is already defined earlier and is either billingAddress or shippingAddress
    const addressForTaxCalculation = {
        country: finalBillingAddress.country,
        state_province_region: finalBillingAddress.state_province_region,
        // postal_code: finalBillingAddress.postalCode // or finalBillingAddress.postal_code, depending on structure
    };

    // Map orderItemsToInsert to the structure expected by calculateTaxForCartItems
    // It expects: { product_id, variant_id, quantity, unit_price }
    const cartItemsForTaxCalc = orderItemsToInsert.map(item => ({
        productId: item.productId, // Keep original key for now if service can adapt, or map to product_id
        product_id: item.productId,
        variant_id: item.productVariantId,
        quantity: item.quantity,
        unit_price: item.priceAtPurchase // Assuming this is pre-tax unit price
    }));

    const taxCalculationResult = await taxService.calculateTaxForCartItems(
        cartItemsForTaxCalc,
        userId,
        addressForTaxCalculation, // Pass the correct address object
        client
    );

    const orderTotalTaxAmount = taxCalculationResult.total_tax_amount;
    const itemsWithTaxDetails = taxCalculationResult.line_items_with_tax_details; // This now contains tax info per line item
    const orderTaxSummaryDetails = taxCalculationResult.tax_summary_details;
    // --- End Tax Calculation ---

    let finalTotalAmount = subtotalForItems; // This is pre-tax subtotal
    let originalTotalAmountBeforeDiscount = subtotalForItems; // This is also pre-tax subtotal
    let appliedDiscountId = null;
    let appliedDiscountCode = null;
    let appliedDiscountAmount = null;

    if (discount_code) {
        const discountResult = await client.query('SELECT * FROM discounts WHERE code = $1 FOR UPDATE', [discount_code.toUpperCase()]);
        if (discountResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid discount code.' }); }
        const discount = discountResult.rows[0];
        if (!discount.is_active || (discount.valid_from && new Date(discount.valid_from) > new Date()) || (discount.valid_until && new Date(discount.valid_until) < new Date()) || (discount.usage_limit !== null && discount.times_used >= discount.usage_limit) || (discount.min_order_amount !== null && subtotalForItems < parseFloat(discount.min_order_amount))) {
            let message = 'Discount code cannot be applied.';
            if (!discount.is_active) message = 'Discount code is not active.';
            await client.query('ROLLBACK'); return res.status(400).json({ message });
        }
        if (discount.type === 'percentage') { appliedDiscountAmount = subtotalForItems * (parseFloat(discount.value) / 100.0); }
        else if (discount.type === 'fixed_amount') { appliedDiscountAmount = parseFloat(discount.value); }
        appliedDiscountAmount = parseFloat(Math.min(subtotalForItems, appliedDiscountAmount).toFixed(2));
        // finalTotalAmount is subtotal - discount at this point
        finalTotalAmount = parseFloat((subtotalForItems - appliedDiscountAmount).toFixed(2));
        appliedDiscountId = discount.id; appliedDiscountCode = discount.code;
        await client.query('UPDATE discounts SET times_used = times_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [discount.id]);
    }
    // Else, finalTotalAmount remains subtotalForItems (if no discount code)

    // Now add tax to the (potentially discounted) subtotal
    finalTotalAmount = parseFloat((finalTotalAmount + orderTotalTaxAmount).toFixed(2));

    const orderInsertQuery = `
      INSERT INTO orders (
        user_id, status, payment_status, total_amount, original_total_amount,
        discount_id, discount_code_applied, discount_amount_applied,
        total_tax_amount, tax_summary_details, -- Added tax fields
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_postal_code, shipping_country,
        billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country,
        updated_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, status, payment_status, total_amount, original_total_amount, total_tax_amount, discount_code_applied, discount_amount_applied, created_at;
    `;
    const orderValues = [
      userId, 'pending', 'pending', finalTotalAmount, originalTotalAmountBeforeDiscount, // Added 'pending' for payment_status
      appliedDiscountId, appliedDiscountCode, appliedDiscountAmount,
      orderTotalTaxAmount, orderTaxSummaryDetails ? JSON.stringify(orderTaxSummaryDetails) : null, // Added tax values
      shippingAddress.line1, shippingAddress.line2 || null, shippingAddress.city, shippingAddress.postalCode, shippingAddress.country,
      finalBillingAddress.line1, finalBillingAddress.line2 || null, finalBillingAddress.city, finalBillingAddress.postalCode, finalBillingAddress.country
    ];
    const orderResult = await client.query(orderInsertQuery, orderValues);
    const newOrder = orderResult.rows[0];

    const orderItemInsertQuery = `
      INSERT INTO order_items (
        order_id, product_id, product_variant_id, quantity, price_at_purchase,
        line_item_tax_amount, applied_tax_rate_percentage, tax_class_id_at_purchase
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `;
    // Use itemsWithTaxDetails for inserting order items as it contains the tax calculations
    for (let i = 0; i < itemsWithTaxDetails.length; i++) {
        const processedItem = itemsWithTaxDetails[i];
        // priceAtPurchase for the DB should be the original unit price used for tax calculation.
        // orderItemsToInsert[i].priceAtPurchase holds this.
        await client.query(orderItemInsertQuery, [
            newOrder.id,
            processedItem.product_id,
            processedItem.variant_id || null,
            processedItem.quantity,
            orderItemsToInsert[i].priceAtPurchase, // Original unit price before tax
            processedItem.line_item_tax_amount || 0,
            processedItem.applied_tax_rate_percentage || null,
            processedItem.tax_class_id_at_purchase || null
          ]);
    }

    for (const stockUpdate of stockUpdates) {
      if (stockUpdate.type === 'variant') {
        await client.query('UPDATE product_variants SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [stockUpdate.quantityToDecrement, stockUpdate.id]);

        // Log movement for variant
        const logMovementQueryVariant = `
          INSERT INTO stock_movement_logs
              (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        const logMovementValuesVariant = [
            stockUpdate.productId,
            stockUpdate.id, // This is variant_id
            userId,
            'sale_deduction',
            -stockUpdate.quantityToDecrement,
            stockUpdate.old_stock_quantity - stockUpdate.quantityToDecrement,
            `Sale - Order #${newOrder.id}`,
            newOrder.id.toString()
        ];
        await client.query(logMovementQueryVariant, logMovementValuesVariant);

      } else { // type === 'base'
        await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [stockUpdate.quantityToDecrement, stockUpdate.id]);

        // Log movement for base product
        const logMovementQueryBase = `
          INSERT INTO stock_movement_logs
              (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        const logMovementValuesBase = [
            stockUpdate.productId, // This is product_id
            null, // No variant_id for base product
            userId,
            'sale_deduction',
            -stockUpdate.quantityToDecrement,
            stockUpdate.old_stock_quantity - stockUpdate.quantityToDecrement,
            `Sale - Order #${newOrder.id}`,
            newOrder.id.toString()
        ];
        await client.query(logMovementQueryBase, logMovementValuesBase);
      }
    }

    await client.query('COMMIT');

    const createdOrderDetails = {
        ...newOrder, user_id: userId, shippingAddress, billingAddress, items: orderItemsToInsert
    };
    res.status(201).json({ message: 'Order created successfully.', order: createdOrderDetails });

    // Email Sending Logic
    let customerEmail = req.user.email; // From JWT payload
    if (!customerEmail) { // Fallback if not in JWT (e.g. if user was fetched by ID without email in token)
        try {
            const userResult = await db.query('SELECT email, name FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0) {
                customerEmail = userResult.rows[0].email;
                // If req.user didn't have name, we can potentially add it to createdOrderDetails or emailOrderData
                if (!req.user.name && userResult.rows[0].name) {
                     if (!createdOrderDetails.user) createdOrderDetails.user = {}; // Ensure user object exists
                     createdOrderDetails.user.name = userResult.rows[0].name;
                }
            }
        } catch (userFetchError) { console.error("Error fetching user email/name for order confirmation:", userFetchError); }
    }

    if (customerEmail) {
      const emailOrderData = {
          ...createdOrderDetails,
          // Ensure shippingAddress and billingAddress are in the format expected by the template
          // createdOrderDetails already includes these from earlier in the route
          user: { // Ensure a user object exists for the template
            name: req.user.name || (createdOrderDetails.user ? createdOrderDetails.user.name : undefined), // Prioritize name from JWT or fetched user
            email: customerEmail
          }
      };

      (async () => {
          try {
              const emailHtml = await getOrderConfirmationHtml(emailOrderData, customerEmail);
              const emailText = getOrderConfirmationText(emailOrderData, customerEmail);

              sendEmail({
                  to: customerEmail,
                  subject: `Order Confirmation #${newOrder.id}`,
                  text: emailText,
                  html: emailHtml,
              }).then(emailResult => {
                  if (emailResult.success) {
                      console.log(`Order confirmation email sent for order ${newOrder.id} to ${customerEmail}. Preview: ${emailResult.previewUrl || 'N/A'}`);
                  } else {
                      console.error(`Failed to send order confirmation email for order ${newOrder.id}: ${emailResult.error}`);
                  }
              }).catch(emailError => {
                  console.error(`Error in sendEmail promise chain for order ${newOrder.id}:`, emailError);
              });
          } catch (templateError) {
              console.error(`Error generating email content for order ${newOrder.id}:`, templateError);
          }
      })();
    } else {
        console.warn(`No customer email found for order ${newOrder.id}. Skipping confirmation email.`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ message: error.message || 'Failed to create order due to an internal error.' });
  } finally {
    client.release();
  }
});

// GET /api/orders/my-history - Get order history for the authenticated user
router.get('/my-history', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (isNaN(page) || page < 1) {
      page = 1;
    }
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 100) {
        limit = 100;
    }

    const offset = (page - 1) * limit;

    const ordersQuery = `
      SELECT o.id, o.created_at as order_date, o.total_amount, o.status,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const ordersResult = await db.query(ordersQuery, [userId, limit, offset]);

    const totalCountQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const totalCountResult = await db.query(totalCountQuery, [userId]);
    const totalOrders = parseInt(totalCountResult.rows[0].count);

    const totalPages = Math.ceil(totalOrders / limit);

    res.status(200).json({
      data: ordersResult.rows,
      pagination: {
        total: totalOrders,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    return next(error);
  }
});

// GET /api/orders/my-history/:orderId - Get details for a specific order for the authenticated user
router.get('/my-history/:orderId', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const orderIdParam = req.params.orderId;

    const orderId = parseInt(orderIdParam);
    if (isNaN(orderId) || orderId <= 0) {
      throw new BadRequestError('Invalid order ID format.');
    }

    // Query for the specific order, ensuring it belongs to the user
    // Query for the specific order, ensuring it belongs to the user
    // Using created_at as order_date for consistency with the list view
    const orderQuery = 'SELECT *, created_at as order_date FROM orders WHERE id = $1 AND user_id = $2';
    const orderResult = await db.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found or does not belong to the current user.`);
    }
    const orderData = orderResult.rows[0]; // This will now include order_date aliased from created_at

    // Query for associated order items
    const itemsQuery = `
      SELECT
        oi.id as item_id,
        oi.product_id,
        oi.quantity,
        oi.price_at_purchase,
        p.name as product_name,
        p.image_url as product_image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `;
    const itemsResult = await db.query(itemsQuery, [orderId]);
    orderData.items = itemsResult.rows;

    // Construct final order object to match frontend mock structure where possible
    const responseOrder = {
       id: orderData.id,
       order_date: orderData.order_date,
       status: orderData.status,
       total_amount: parseFloat(orderData.total_amount),
       shipping_address: {
           line1: orderData.shipping_address_line1,
           line2: orderData.shipping_address_line2,
           city: orderData.shipping_city,
           postalCode: orderData.shipping_postal_code,
           country: orderData.shipping_country
       },
       billing_address: {
           line1: orderData.billing_address_line1 || orderData.shipping_address_line1,
           line2: orderData.billing_address_line2 || orderData.shipping_address_line2,
           city: orderData.billing_city || orderData.shipping_city,
           postalCode: orderData.billing_postal_code || orderData.shipping_postal_code,
           country: orderData.billing_country || orderData.shipping_country
       },
       items: orderData.items.map(item => ({
           item_id: item.item_id,
           product_id: item.product_id,
           name: item.product_name,
           quantity: item.quantity,
           price_at_purchase: parseFloat(item.price_at_purchase),
           image_url: item.product_image_url
       })),
       subtotal: orderData.original_total_amount ? parseFloat(orderData.original_total_amount) : parseFloat(orderData.total_amount) + (orderData.discount_amount_applied ? parseFloat(orderData.discount_amount_applied) : 0),
       discount_applied: orderData.discount_id ? {
           code: orderData.discount_code_applied,
           amount_deducted: parseFloat(orderData.discount_amount_applied)
       } : null,
       // These fields are not in the 'orders' table schema provided earlier, so they are commented out.
       // If they were added, they could be included here.
       // shipping_cost: 0.00,
       // payment_method: 'N/A'
    };

    if (orderData.original_total_amount === null && responseOrder.discount_applied) {
       responseOrder.subtotal = parseFloat(orderData.total_amount) + parseFloat(orderData.discount_amount_applied);
    } else if (orderData.original_total_amount === null && !responseOrder.discount_applied) {
       responseOrder.subtotal = parseFloat(orderData.total_amount);
    }

    res.status(200).json(responseOrder);

  } catch (error) {
    return next(error); // Pass to global error handler
  }
});

module.exports = router;
