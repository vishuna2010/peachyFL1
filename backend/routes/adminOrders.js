const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { generateOrderInvoicePdf } = require('../services/pdfService');
const { param, validationResult } = require('express-validator');
const { NotFoundError } = require('../utils/AppError');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

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

// PUT /admin/orders/:id/status - Update an order's status
router.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status: newStatus } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid order ID format.' });
  }

  if (!newStatus) {
    return res.status(400).json({ message: 'Status is required in the request body.' });
  }

  if (!ALLOWED_ORDER_STATUSES.includes(newStatus.toLowerCase())) {
    return res.status(400).json({
      message: `Invalid status. Allowed statuses are: ${ALLOWED_ORDER_STATUSES.join(', ')}`
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if order exists
    const orderExistsResult = await client.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderExistsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Order with ID ${id} not found.` });
    }

    // Update the order status and updated_at timestamp
    const updateQuery = `
      UPDATE orders
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    // RETURNING id, user_id, status, total_amount, created_at, updated_at;
    // Fetch more details if needed for the response, similar to GET /orders/:id
    const updatedOrderResult = await client.query(updateQuery, [newStatus.toLowerCase(), id]);

    await client.query('COMMIT');

    // For a more complete response, you could re-fetch the order with joins like in GET /orders/:id
    // For now, returning the directly updated row is sufficient.
    res.status(200).json({
      message: `Order #${id} status updated to '${newStatus}'.`,
      order: updatedOrderResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error updating status for order ID ${id}:`, error);
    res.status(500).json({ message: 'Failed to update order status.' });
  } finally {
    client.release();
  }
});

// GET /admin/orders/:orderId/invoice/pdf - Generate PDF invoice for an order
router.get(
  '/orders/:orderId/invoice/pdf',
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;

    try {
      // Fetch comprehensive order details
      const orderQuery = `
        SELECT
          o.*,
          u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = $1;
      `;
      const orderResult = await db.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found.`);
      }
      const orderDataFromDb = orderResult.rows[0];

      const itemsQuery = `
        SELECT
          oi.quantity, oi.price_at_purchase,
          p.name as product_name
          /* Add other item details if needed by invoice, e.g., SKU */
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC;
      `;
      const itemsResult = await db.query(itemsQuery, [orderId]);
      orderDataFromDb.items = itemsResult.rows;

      // Prepare orderDetails for PDF generation
      const orderDetailsForPdf = {
        ...orderDataFromDb,
        // Company details can be from env or config
        company_name: process.env.COMPANY_NAME || "My Awesome Store",
        company_address: process.env.COMPANY_ADDRESS || "123 Store Street, Shopsville, ST 12345",
        company_logo_url: process.env.COMPANY_LOGO_URL || null, // e.g. "https://example.com/logo.png"
        company_phone: process.env.COMPANY_PHONE || "1-800-SHOP-NOW",
        company_email: process.env.COMPANY_EMAIL || "contact@myawesomestore.com",
        company_website: process.env.COMPANY_WEBSITE || "www.myawesomestore.com"
      };

      const pdfBuffer = await generateOrderInvoicePdf(orderDetailsForPdf);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="invoice_order_${orderId}.pdf"`);
      // Use 'attachment' to force download: `attachment; filename="invoice_order_${orderId}.pdf"`
      res.send(pdfBuffer);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      // Pass other errors to the global error handler
      next(error);
    }
  }
);

module.exports = router;
