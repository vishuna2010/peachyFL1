const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../auth'); // Assuming this middleware populates req.user.userId

// POST /api/orders - Create a new order
router.post('/', isAuthenticated, async (req, res) => {
  const { cart, shippingAddress, billingAddress } = req.body;
  const userId = req.user.userId; // From isAuthenticated middleware

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

    // --- 3. Fetch product prices and calculate total_amount ---
    let totalAmount = 0;
    const orderItemsData = []; // To store data for inserting into order_items

    for (const item of cart) {
      const productResult = await client.query('SELECT price, name FROM products WHERE id = $1', [item.productId]);
      if (productResult.rows.length === 0) {
        // This check could also be done upfront before starting transaction for efficiency
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
      }
      // Future: Check stock here. If stock is insufficient, rollback and return error.
      // const stock = productResult.rows[0].stock;
      // if (stock < item.quantity) {
      //   await client.query('ROLLBACK');
      //   return res.status(400).json({ message: `Not enough stock for product ${productResult.rows[0].name}. Available: ${stock}` });
      // }

      const priceAtPurchase = parseFloat(productResult.rows[0].price);
      totalAmount += priceAtPurchase * item.quantity;
      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: priceAtPurchase,
      });
    }

    totalAmount = parseFloat(totalAmount.toFixed(2)); // Ensure two decimal places

    // --- 5. Insert a new record into the orders table ---
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

    // --- 6. Insert records into the order_items table ---
    const orderItemInsertQuery = `
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      VALUES ($1, $2, $3, $4);
    `;
    for (const itemData of orderItemsData) {
      await client.query(orderItemInsertQuery, [newOrder.id, itemData.productId, itemData.quantity, itemData.priceAtPurchase]);
      // Future: Decrement stock here:
      // await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [itemData.quantity, itemData.productId]);
    }

    // --- 7. Commit the transaction ---
    await client.query('COMMIT');

    // --- 8. Return a success response ---
    // Fetch full order details for the response (optional, but good for client)
    const createdOrderDetails = {
        ...newOrder,
        shippingAddress: shippingAddress,
        billingAddress: finalBillingAddress,
        items: orderItemsData // Or fetch from DB if you want item IDs too
    };
    res.status(201).json({ message: 'Order created successfully.', order: createdOrderDetails });

  } catch (error) {
    // --- 9. If any step fails, rollback the transaction ---
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order.' });
  } finally {
    client.release();
  }
});

module.exports = router;
