const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// GET /admin/orders - List all orders
router.get('/orders', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Get total count for pagination
    const totalResult = await db.query('SELECT COUNT(*) FROM orders');
    const totalOrders = parseInt(totalResult.rows[0].count);

    const ordersQuery = `
      SELECT
        o.id, o.user_id, u.email as user_email,
        o.status, o.total_amount,
        o.shipping_address_line1, o.shipping_city, o.shipping_postal_code, o.shipping_country,
        o.created_at, o.updated_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const ordersResult = await db.query(ordersQuery, [limit, offset]);

    res.status(200).json({
      data: ordersResult.rows,
      pagination: {
        total: totalOrders,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders for admin:', error);
    res.status(500).json({ message: 'Failed to retrieve orders.' });
  }
});

// GET /admin/orders/:id - View a specific order
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid order ID format.' });
  }

  try {
    // Fetch the order details and join with users table
    const orderQuery = `
      SELECT
        o.*,
        u.email as user_email,
        u.role as user_role
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = $1;
    `;
    const orderResult = await db.query(orderQuery, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: `Order with ID ${id} not found.` });
    }
    const order = orderResult.rows[0];

    // Fetch order items and join with products table for product name
    const itemsQuery = `
      SELECT
        oi.id as order_item_id, oi.quantity, oi.price_at_purchase,
        p.id as product_id, p.name as product_name, p.image_url as product_image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [id]);
    order.items = itemsResult.rows;

    // Exclude user password if it was somehow fetched (it's not in this query)
    if (order.user_password) delete order.user_password;


    res.status(200).json(order);
  } catch (error) {
    console.error(`Error fetching order details for admin (ID: ${id}):`, error);
    res.status(500).json({ message: 'Failed to retrieve order details.' });
  }
});

module.exports = router;
