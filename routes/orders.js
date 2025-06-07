const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../auth');
const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationText } = require('../services/emailService');

// POST /api/orders - Create a new order
router.post('/', isAuthenticated, async (req, res) => {
  const { cart, shippingAddress, billingAddress } = req.body;
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

    totalAmount = parseFloat(totalAmount.toFixed(2));

    // --- 4. Insert a new record into the orders table ---
    const orderInsertQuery = `
      INSERT INTO orders (
        user_id, status, total_amount,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_postal_code, shipping_country,
        billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      RETURNING id, status, total_amount, created_at;
    `;
    const orderValues = [
      userId, 'pending', totalAmount,
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
        ...newOrder,
        user_id: userId,
        shippingAddress: shippingAddress,
        billingAddress: finalBillingAddress,
        items: orderItemsData // product_name is already included here
    };

    res.status(201).json({ message: 'Order created successfully.', order: createdOrderDetails });

    // Asynchronously send order confirmation email
    let customerEmail = req.user.email;
    if (!customerEmail) {
        try {
            // Use the same client for this quick read, as it's part of the post-commit phase
            const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]); // Changed to db.query as client might be released
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
