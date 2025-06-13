const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { generateOrderInvoicePdf, generatePackingSlipPdf } = require('../services/pdfService');
const { param, validationResult } = require('express-validator');
const { NotFoundError } = require('../utils/AppError');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const BILLABLE_ORDER_STATUSES = ['shipped', 'completed', 'delivered']; // 'completed' can be an alias for delivered or a separate final step
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided'];

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
        o.status, o.payment_status, o.total_amount, -- Added payment_status
        o.invoice_number, o.invoice_issue_date,
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

// PUT /admin/orders/:id/status - Update an order's status and optionally payment_status
router.put('/orders/:id/status', async (req, res, next) => { // Added next for error handling
  const { id } = req.params;
  const { status: newStatus, payment_status: newPaymentStatus } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid order ID format.' });
  }

  if (!newStatus && !newPaymentStatus) {
    return res.status(400).json({ message: 'At least one of status or payment_status is required.' });
  }

  if (newStatus && !ALLOWED_ORDER_STATUSES.includes(newStatus.toLowerCase())) {
    return res.status(400).json({
      message: `Invalid status. Allowed statuses are: ${ALLOWED_ORDER_STATUSES.join(', ')}`
    });
  }

  if (newPaymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(newPaymentStatus.toLowerCase())) {
    return res.status(400).json({
      message: `Invalid payment_status. Allowed statuses are: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const orderCheckResult = await client.query('SELECT id, status, invoice_number, payment_status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderCheckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Order with ID ${id} not found.`);
    }
    const currentOrder = orderCheckResult.rows[0];

    const setClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (newStatus && newStatus.toLowerCase() !== currentOrder.status) {
      setClauses.push(`status = $${paramIndex++}`);
      queryParams.push(newStatus.toLowerCase());
    }

    if (newPaymentStatus && newPaymentStatus.toLowerCase() !== currentOrder.payment_status) {
      setClauses.push(`payment_status = $${paramIndex++}`);
      queryParams.push(newPaymentStatus.toLowerCase());
    }

    const statusForInvoiceCheck = newStatus ? newStatus.toLowerCase() : currentOrder.status;
    if (currentOrder.invoice_number === null && BILLABLE_ORDER_STATUSES.includes(statusForInvoiceCheck)) {
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const generatedInvoiceNumber = `INV-${year}${month}${day}-${id}`;

      setClauses.push(`invoice_number = $${paramIndex++}`);
      queryParams.push(generatedInvoiceNumber);
      setClauses.push(`invoice_issue_date = CURRENT_TIMESTAMP`);
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // No actual changes to make
      // Return current order data as no update was performed or needed
      const currentOrderData = await db.query('SELECT * FROM orders WHERE id = $1', [id]); // Re-fetch or use currentOrder
      return res.status(200).json({ message: 'No changes detected for order status or payment status.', order: currentOrderData.rows[0] });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(id); // For WHERE id = $N

    const updateQuery = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const updatedOrderResult = await client.query(updateQuery, queryParams);

    await client.query('COMMIT');

    res.status(200).json({
      message: `Order #${id} updated successfully.`,
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

// GET /admin/orders/:orderId/packing-slip/pdf - Generate PDF packing slip for an order
router.get(
  '/orders/:orderId/packing-slip/pdf',
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params; // Now an integer

    try {
      // Fetch main order data and customer email (similar to packing-slip-data)
      const orderQuery = `
        SELECT
          o.id as order_id,
          o.created_at as order_date,
          o.shipping_address_line1,
          o.shipping_address_line2,
          o.shipping_city,
          o.shipping_state_province_region,
          o.shipping_postal_code,
          o.shipping_country,
          u.first_name as customer_first_name,
          u.last_name as customer_last_name,
          u.email as customer_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = $1;
      `;
      const orderResult = await db.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found.`);
      }
      const orderData = orderResult.rows[0];

      // Fetch order items with product and variant details
      const itemsQuery = `
        SELECT
          oi.id as order_item_id,
          oi.quantity as quantity_ordered,
          oi.product_id,
          oi.product_variant_id,
          p.name as product_name_from_db,
          p.image_url as base_product_image_url,
          p.sku as base_product_sku,
          pv.sku as variant_sku,
          pv.image_url as variant_image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC;
      `;
      const itemsResult = await db.query(itemsQuery, [orderId]);

      const processedItems = [];
      for (const item of itemsResult.rows) {
        let variant_description = null;
        if (item.product_variant_id) {
          const optionsQuery = `
            SELECT pov.value as option_value_name, po.name as option_name
            FROM product_variant_option_values pvov
            JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
            JOIN product_options po ON pov.product_option_id = po.id
            WHERE pvov.product_variant_id = $1
            ORDER BY po.name, pov.value;
          `;
          const optionsResult = await db.query(optionsQuery, [item.product_variant_id]);
          variant_description = optionsResult.rows.map(opt => `${opt.option_name}: ${opt.option_value_name}`).join(', ');
        }

        processedItems.push({
          // order_item_id: item.order_item_id, // Not typically on packing slip items, but available
          sku: item.variant_sku || item.base_product_sku,
          product_name: item.product_name_from_db,
          variant_description: variant_description,
          quantity_ordered: item.quantity_ordered,
          image_url: item.variant_image_url || item.base_product_image_url
        });
      }

      // Prepare data for PDF service
      const packingSlipDataForPdf = {
        order_id: orderData.order_id,
        order_date: orderData.order_date,
        customer_name: `${orderData.customer_first_name || ''} ${orderData.customer_last_name || ''}`.trim(),
        customer_email: orderData.customer_email, // Optional for packing slip, but good to have
        shipping_address: {
          line1: orderData.shipping_address_line1,
          line2: orderData.shipping_address_line2,
          city: orderData.shipping_city,
          state_province_region: orderData.shipping_state_province_region,
          postal_code: orderData.shipping_postal_code,
          country: orderData.shipping_country
        },
        items: processedItems,
        // Company details for PDF service
        company_name: process.env.COMPANY_NAME || "My Store Inc.", // Consistent naming
        company_logo_url: process.env.COMPANY_LOGO_URL || null,
        // show_images: req.query.show_images !== 'false' // Default to true, allow disabling via query
      };

      const pdfBuffer = await generatePackingSlipPdf(packingSlipDataForPdf);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="packing_slip_order_${orderId}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
);

// GET /admin/orders/:orderId/packing-slip-data - Get structured data for a packing slip
router.get(
  '/orders/:orderId/packing-slip-data',
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params; // Now an integer

    try {
      // Fetch main order data and customer email
      const orderQuery = `
        SELECT
          o.id as order_id,
          o.created_at as order_date,
          o.shipping_address_line1,
          o.shipping_address_line2,
          o.shipping_city,
          o.shipping_state_province_region,
          o.shipping_postal_code,
          o.shipping_country,
          u.first_name as customer_first_name,
          u.last_name as customer_last_name,
          u.email as customer_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = $1;
      `;
      const orderResult = await db.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found.`);
      }
      const orderData = orderResult.rows[0];

      // Fetch order items with product and variant details
      const itemsQuery = `
        SELECT
          oi.id as order_item_id,
          oi.quantity as quantity_ordered,
          oi.product_id,
          oi.product_variant_id,
          p.name as product_name_from_db, /* Renamed to avoid conflict */
          p.image_url as base_product_image_url,
          p.sku as base_product_sku,
          pv.sku as variant_sku,
          pv.image_url as variant_image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC;
      `;
      const itemsResult = await db.query(itemsQuery, [orderId]);

      const processedItems = [];
      for (const item of itemsResult.rows) {
        let variant_description = null;
        if (item.product_variant_id) {
          const optionsQuery = `
            SELECT pov.value as option_value_name, po.name as option_name
            FROM product_variant_option_values pvov
            JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
            JOIN product_options po ON pov.product_option_id = po.id
            WHERE pvov.product_variant_id = $1
            ORDER BY po.name, pov.value;
          `;
          const optionsResult = await db.query(optionsQuery, [item.product_variant_id]);
          variant_description = optionsResult.rows.map(opt => `${opt.option_name}: ${opt.option_value_name}`).join(', ');
        }

        processedItems.push({
          order_item_id: item.order_item_id,
          sku: item.variant_sku || item.base_product_sku,
          product_name: item.product_name_from_db,
          variant_description: variant_description,
          quantity_ordered: item.quantity_ordered,
          image_url: item.variant_image_url || item.base_product_image_url // Prioritize variant image
        });
      }

      const packingSlipData = {
        order_id: orderData.order_id,
        order_date: orderData.order_date,
        customer_name: `${orderData.customer_first_name || ''} ${orderData.customer_last_name || ''}`.trim(),
        customer_email: orderData.customer_email,
        shipping_address: {
          line1: orderData.shipping_address_line1,
          line2: orderData.shipping_address_line2,
          city: orderData.shipping_city,
          state_province_region: orderData.shipping_state_province_region,
          postal_code: orderData.shipping_postal_code,
          country: orderData.shipping_country
        },
        items: processedItems
      };

      res.status(200).json(packingSlipData);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
);

module.exports = router;
