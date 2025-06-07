const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../auth');
const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationText } = require('../services/emailService');

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
      let currentStock;
      let productSku = null; // Conceptual, if we were to store SKU in order_items

      if (item.productVariantId) {
        // --- Handling a Product Variant ---
        const variantResult = await client.query(
          `SELECT pv.stock_quantity, pv.price_modifier, pv.sku as variant_sku,
                  p.price as base_price, p.name as base_product_name, p.sku as base_product_sku
           FROM product_variants pv
           JOIN products p ON pv.product_id = p.id
           WHERE pv.id = $1 AND pv.product_id = $2 FOR UPDATE OF pv`, // Lock variant row
          [item.productVariantId, item.productId]
        );
        if (variantResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: `Product variant with ID ${item.productVariantId} for product ID ${item.productId} not found.` });
        }
        const variant = variantResult.rows[0];
        currentStock = variant.stock_quantity;
        priceAtPurchase = parseFloat(variant.base_price) + parseFloat(variant.price_modifier);
        productName = `${variant.base_product_name} (Variant)`; // Or more descriptive with option values later
        productSku = variant.variant_sku || variant.base_product_sku;

        if (currentStock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Not enough stock for variant "${productName}". Available: ${currentStock}, Requested: ${item.quantity}.` });
        }
        stockUpdates.push({ type: 'variant', id: item.productVariantId, quantityToDecrement: item.quantity });
      } else {
        // --- Handling a Base Product (no variant specified) ---
        const productResult = await client.query(
          'SELECT name, price, stock_quantity, sku FROM products WHERE id = $1 FOR UPDATE',
          [item.productId]
        );
        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
        }
        const product = productResult.rows[0];
        currentStock = product.stock_quantity;
        priceAtPurchase = parseFloat(product.price);
        productName = product.name;
        productSku = product.sku;

        // Check if this product actually has variants. If so, user should select one.
        // This check is optional here if UI prevents adding base product to cart if variants exist.
        // For now, we allow ordering base product if it has stock.
        if (currentStock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Not enough stock for product "${productName}". Available: ${currentStock}, Requested: ${item.quantity}.` });
        }
        stockUpdates.push({ type: 'base', id: item.productId, quantityToDecrement: item.quantity });
      }

      subtotalForItems += priceAtPurchase * item.quantity;
      orderItemsToInsert.push({
        productId: item.productId, // Base product ID
        productVariantId: item.productVariantId || null,
        product_name: productName, // For email
        quantity: item.quantity,
        priceAtPurchase: priceAtPurchase,
        // sku_at_purchase: productSku // Conceptual
      });
    }

    subtotalForItems = parseFloat(subtotalForItems.toFixed(2));

    // --- Discount Logic (applied to subtotalForItems) ---
    let finalTotalAmount = subtotalForItems;
    let originalTotalAmountBeforeDiscount = subtotalForItems;
    let appliedDiscountId = null;
    let appliedDiscountCode = null;
    let appliedDiscountAmount = null;

    if (discount_code) {
      // ... (existing discount logic remains largely the same, applied to subtotalForItems) ...
      // Ensure discount calculation is based on subtotalForItems
        const discountResult = await client.query('SELECT * FROM discounts WHERE code = $1 FOR UPDATE', [discount_code.toUpperCase()]);
        if (discountResult.rows.length === 0) { /* ... rollback, error ... */ await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid discount code.' }); }
        const discount = discountResult.rows[0];
        if (!discount.is_active || (discount.valid_from && new Date(discount.valid_from) > new Date()) || (discount.valid_until && new Date(discount.valid_until) < new Date()) || (discount.usage_limit !== null && discount.times_used >= discount.usage_limit) || (discount.min_order_amount !== null && subtotalForItems < parseFloat(discount.min_order_amount))) {
            let message = 'Discount code cannot be applied.';
            if (!discount.is_active) message = 'Discount code is not active.';
            // Add more specific messages
            await client.query('ROLLBACK'); return res.status(400).json({ message });
        }
        if (discount.type === 'percentage') { appliedDiscountAmount = subtotalForItems * (parseFloat(discount.value) / 100.0); }
        else if (discount.type === 'fixed_amount') { appliedDiscountAmount = parseFloat(discount.value); }
        appliedDiscountAmount = parseFloat(Math.min(subtotalForItems, appliedDiscountAmount).toFixed(2));
        finalTotalAmount = parseFloat((subtotalForItems - appliedDiscountAmount).toFixed(2));
        appliedDiscountId = discount.id; appliedDiscountCode = discount.code;
        await client.query('UPDATE discounts SET times_used = times_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [discount.id]);
    }
    // --- End Discount Logic ---

    const orderInsertQuery = `
      INSERT INTO orders (
        user_id, status, total_amount, original_total_amount,
        discount_id, discount_code_applied, discount_amount_applied,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_postal_code, shipping_country,
        billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country,
        updated_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, status, total_amount, original_total_amount, discount_code_applied, discount_amount_applied, created_at;
    `;
    const orderValues = [
      userId, 'pending', finalTotalAmount, originalTotalAmountBeforeDiscount,
      appliedDiscountId, appliedDiscountCode, appliedDiscountAmount,
      shippingAddress.line1, shippingAddress.line2 || null, shippingAddress.city, shippingAddress.postalCode, shippingAddress.country,
      finalBillingAddress.line1, finalBillingAddress.line2 || null, finalBillingAddress.city, finalBillingAddress.postalCode, finalBillingAddress.country
    ];
    const orderResult = await client.query(orderInsertQuery, orderValues);
    const newOrder = orderResult.rows[0];

    const orderItemInsertQuery = `
      INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, price_at_purchase)
      VALUES ($1, $2, $3, $4, $5);
    `;
    for (const itemToInsert of orderItemsToInsert) {
      await client.query(orderItemInsertQuery, [
          newOrder.id, itemToInsert.productId, itemToInsert.productVariantId,
          itemToInsert.quantity, itemToInsert.priceAtPurchase
        ]);
    }

    for (const stockUpdate of stockUpdates) {
      if (stockUpdate.type === 'variant') {
        await client.query('UPDATE product_variants SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [stockUpdate.quantityToDecrement, stockUpdate.id]);
      } else { // 'base'
        await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [stockUpdate.quantityToDecrement, stockUpdate.id]);
      }
    }

    await client.query('COMMIT');

    const createdOrderDetails = {
        ...newOrder, user_id: userId, shippingAddress, billingAddress, items: orderItemsToInsert
    };
    res.status(201).json({ message: 'Order created successfully.', order: createdOrderDetails });

    let customerEmail = req.user.email;
    if (!customerEmail) {
        try {
            const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0) { customerEmail = userResult.rows[0].email; }
        } catch (userFetchError) { console.error("Error fetching user email for order confirmation:", userFetchError); }
    }
    if (customerEmail) {
      sendEmail({
        to: customerEmail, subject: `Order Confirmation #${newOrder.id}`,
        text: getOrderConfirmationText(createdOrderDetails, customerEmail),
        html: getOrderConfirmationHtml(createdOrderDetails, customerEmail),
      }).then(emailResult => { /* logging */ }).catch(emailError => { /* logging */ });
    } else { console.warn(`No customer email found for order ${newOrder.id}. Skipping confirmation email.`); }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ message: error.message || 'Failed to create order due to an internal error.' }); // Send back specific stock error messages if they were thrown
  } finally {
    client.release();
  }
});

module.exports = router;
