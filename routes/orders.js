const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../auth');
const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationText } = require('../services/emailService');

// POST /api/orders - Create a new order
router.post('/', isAuthenticated, async (req, res) => {
  const { cart, shippingAddress, billingAddress, discount_code } = req.body; // Added discount_code
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
      return res.status(400).json({ message: 'Each cart item must have a valid productId and a positive quantity.' });
    }
  }

  const finalBillingAddress = billingAddress && billingAddress.line1 ? billingAddress : shippingAddress;
  const client = await db.pool.connect();

  try {
    // --- 2. Start a database transaction ---
    await client.query('BEGIN');

    // --- 3. Fetch product details, check stock (with row locking), and calculate total_amount ---
    let totalAmount = 0;
    const orderItemsData = [];
    const productStockUpdates = [];

    for (const item of cart) {
      const productResult = await client.query(
        'SELECT name, price, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }

      const currentProduct = productResult.rows[0];

      // Stock Check
      if (currentProduct.stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Not enough stock for product "${currentProduct.name}". Available: ${currentProduct.stock_quantity}, Requested: ${item.quantity}.`
        });
      }

      const priceAtPurchase = parseFloat(currentProduct.price);
      totalAmount += priceAtPurchase * item.quantity;

      orderItemsData.push({
        productId: item.productId,
        product_name: currentProduct.name, // For email template
        quantity: item.quantity,
        priceAtPurchase: priceAtPurchase,
      });

      // Prepare stock update operation
      productStockUpdates.push({
        productId: item.productId,
        quantityToDecrement: item.quantity,
      });
    }

    totalAmount = parseFloat(totalAmount.toFixed(2)); // This is now subtotal_for_items

    // --- Discount Logic ---
    let finalTotalAmount = totalAmount;
    let originalTotalAmount = totalAmount; // Store the total before discount
    let appliedDiscountId = null;
    let appliedDiscountCode = null;
    let appliedDiscountAmount = null;

    if (discount_code) {
      const discountResult = await client.query(
        'SELECT * FROM discounts WHERE code = $1 FOR UPDATE', // Lock discount row
        [discount_code.toUpperCase()]
      );

      if (discountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid discount code.' });
      }

      const discount = discountResult.rows[0];

      // Validate discount
      if (!discount.is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Discount code is not active.' });
      }
      if (discount.valid_from && new Date(discount.valid_from) > new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Discount code is not yet valid.' });
      }
      if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Discount code has expired.' });
      }
      if (discount.usage_limit !== null && discount.times_used >= discount.usage_limit) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Discount code usage limit reached.' });
      }
      if (discount.min_order_amount !== null && totalAmount < parseFloat(discount.min_order_amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Minimum order amount of $${parseFloat(discount.min_order_amount).toFixed(2)} not met for this discount.` });
      }

      // Calculate and apply discount
      if (discount.type === 'percentage') {
        appliedDiscountAmount = totalAmount * (parseFloat(discount.value) / 100.0);
      } else if (discount.type === 'fixed_amount') {
        appliedDiscountAmount = parseFloat(discount.value);
      }
      appliedDiscountAmount = parseFloat(appliedDiscountAmount.toFixed(2));

      // Ensure discount doesn't make total negative
      finalTotalAmount = totalAmount - appliedDiscountAmount;
      if (finalTotalAmount < 0) {
        finalTotalAmount = 0; // Or minimum allowed, e.g. $0.01 if order must have cost
        appliedDiscountAmount = totalAmount; // Adjust applied amount if it exceeds total
      }

      appliedDiscountId = discount.id;
      appliedDiscountCode = discount.code;

      // Increment times_used for the discount
      await client.query(
        'UPDATE discounts SET times_used = times_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [discount.id]
      );
    }
    // --- End Discount Logic ---


    // --- 4. Insert a new record into the orders table (with discount info) ---
    const orderInsertQuery = `
      INSERT INTO orders (
        user_id, status, total_amount, original_total_amount,
        discount_id, discount_code_applied, discount_amount_applied,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_postal_code, shipping_country,
        billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
      RETURNING id, status, total_amount, original_total_amount, discount_code_applied, discount_amount_applied, created_at;
    `;
    const orderValues = [
      userId, 'pending', finalTotalAmount, originalTotalAmount,
      appliedDiscountId, appliedDiscountCode, appliedDiscountAmount,
      shippingAddress.line1, shippingAddress.line2 || null, shippingAddress.city, shippingAddress.postalCode, shippingAddress.country,
      finalBillingAddress.line1, finalBillingAddress.line2 || null, finalBillingAddress.city, finalBillingAddress.postalCode, finalBillingAddress.country
    ];
    const orderResult = await client.query(orderInsertQuery, orderValues);
    const newOrder = orderResult.rows[0];

    // --- 5. Insert records into the order_items table ---
    const orderItemInsertQuery = `
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      VALUES ($1, $2, $3, $4);
    `;
    for (const itemData of orderItemsData) {
      await client.query(orderItemInsertQuery, [newOrder.id, itemData.productId, itemData.quantity, itemData.priceAtPurchase]);
    }

    // --- 6. Perform Stock Decrements ---
    const stockUpdateQuery = 'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2;';
    for (const stockUpdate of productStockUpdates) {
      await client.query(stockUpdateQuery, [stockUpdate.quantityToDecrement, stockUpdate.productId]);
    }

    // --- 7. Commit the transaction ---
    await client.query('COMMIT');

    // --- 8. Return a success response & Send Email ---
    const createdOrderDetails = {
        ...newOrder, // Contains fields from RETURNING clause
        user_id: userId,
        shippingAddress: shippingAddress,
        billingAddress: finalBillingAddress,
        items: orderItemsData
    };

    res.status(201).json({ message: 'Order created successfully.', order: createdOrderDetails });

    // Asynchronously send order confirmation email
    let customerEmail = req.user.email;
    if (!customerEmail) {
        try {
            // Using db.query for safety, as client from pool for main transaction might be released or in error state
            const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0) {
                customerEmail = userResult.rows[0].email;
            }
        } catch (userFetchError) {
            console.error("Error fetching user email for order confirmation:", userFetchError);
        }
    }

    if (customerEmail) {
      const emailHtml = getOrderConfirmationHtml(createdOrderDetails, customerEmail);
      const emailText = getOrderConfirmationText(createdOrderDetails, customerEmail);
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
          console.error(`Unexpected error in sendEmail promise for order ${newOrder.id}:`, emailError);
      });
    } else {
        console.warn(`No customer email found for order ${newOrder.id}. Skipping confirmation email.`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    // Don't send detailed PG errors to client, but be more specific for stock issues if possible.
    // The stock check error is already returned with a specific message before this generic catch.
    res.status(500).json({ message: 'Failed to create order due to an internal error.' });
  } finally {
    client.release();
  }
});

module.exports = router;
