const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth'); // Replaced isAdmin with checkPermission
const { generateOrderInvoicePdf, generatePackingSlipPdf } = require('../services/pdfService');
const { param, query, body, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError } = require('../utils/AppError');
const crypto = require('crypto');
const auditLogService = require('../services/auditLogService');

// Apply auth middleware to all routes in this router
// router.use(isAuthenticated, isAdmin); // REMOVED - will apply per route

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const BILLABLE_ORDER_STATUSES = ['shipped', 'completed', 'delivered']; // 'completed' can be an alias for delivered or a separate final step
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided'];

// Validation for GET /orders
const validateListOrdersParams = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt()
];

// GET /admin/orders - List all orders
router.get('/orders', isAuthenticated, checkPermission('orders:view_all'), validateListOrdersParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const page = req.query.page || 1; // Default if optional and not provided
  const limit = req.query.limit || 10; // Default if optional and not provided
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
    next(error); // Pass to global error handler
  }
});

// GET /admin/orders/:id - View a specific order
router.get('/orders/:id', isAuthenticated, checkPermission('orders:view_details'), async (req, res, next) => {
  // Added next for consistency, though current error handling doesn't use it for all paths
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid order ID format.' }); // Or use express-validator
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
        oi.tax_class_id_at_purchase, -- Added
        tc.name as tax_class_name_at_purchase, -- Added
        p.id as product_id, p.name as product_name, p.image_url as product_image_url,
        pv.sku as variant_sku, -- Added for better item identification
        p.sku as base_product_sku -- Added for better item identification
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id -- Join for variant SKU
      LEFT JOIN tax_classes tc ON oi.tax_class_id_at_purchase = tc.id -- Added Join for tax class name
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [id]);
    order.items = itemsResult.rows.map(item => ({
      ...item,
      price_at_purchase: parseFloat(item.price_at_purchase), // Ensure numeric
      // Construct a display SKU
      display_sku: item.variant_sku || item.base_product_sku || 'N/A'
    }));

    // Exclude user password if it was somehow fetched (it's not in this query)
    if (order.user_password) delete order.user_password;


    res.status(200).json(order);
  } catch (error) {
    console.error(`Error fetching order details for admin (ID: ${id}):`, error);
    res.status(500).json({ message: 'Failed to retrieve order details.' });
  }
});

// PUT /admin/orders/:id/status - Update an order's status and optionally payment_status
router.put('/orders/:id/status', isAuthenticated, checkPermission('orders:update_status'), async (req, res, next) => {
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
  isAuthenticated,
  checkPermission('orders:view_details'), // Viewing/generating an invoice requires viewing order details
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
          oi.quantity,
          oi.price_at_purchase,
          p.name as product_name,
          p.sku as product_sku,
          pv.sku as variant_sku,
          oi.tax_class_id_at_purchase,
          tc.name AS tax_class_name_at_purchase,
          oi.line_item_tax_amount, -- Added for invoice
          oi.applied_tax_rate_percentage -- Added for invoice
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
        LEFT JOIN tax_classes tc ON oi.tax_class_id_at_purchase = tc.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC;
      `;
      const itemsResult = await db.query(itemsQuery, [orderId]);
      orderDataFromDb.items = itemsResult.rows.map(item => ({
        ...item,
        price_at_purchase: parseFloat(item.price_at_purchase),
        line_item_tax_amount: item.line_item_tax_amount ? parseFloat(item.line_item_tax_amount) : 0, // Ensure numeric, default to 0
        applied_tax_rate_percentage: item.applied_tax_rate_percentage ? parseFloat(item.applied_tax_rate_percentage) : null, // Ensure numeric or null
        display_sku: item.variant_sku || item.product_sku || 'N/A'
      }));

    // Generate QR Code URL
    const token = crypto.randomBytes(8).toString('hex');
    const frontendInvoiceViewUrlBase = process.env.FRONTEND_INVOICE_VIEW_URL_BASE || 'https://example.com/invoices'; // Fallback URL
    const invoice_qr_code_url = `${frontendInvoiceViewUrlBase}/${orderId}?token=${token}`;

      // Prepare orderDetails for PDF generation
      const orderDetailsForPdf = {
        ...orderDataFromDb,
        invoice_qr_code_url: invoice_qr_code_url, // Added this line
        // Company details can be from env or config
        company_name: process.env.COMPANY_NAME || "YOUR_COMPANY_NAME",
        company_address: process.env.COMPANY_ADDRESS || "Your Company Address, Street, City, Postal Code",
        company_logo_url: process.env.COMPANY_LOGO_URL || "https://example.com/Logo.svg", // Placeholder: use full public URL to your logo
        company_phone: process.env.COMPANY_PHONE || "Your Company Phone",
        company_email: process.env.COMPANY_EMAIL || "yourcompany@example.com",
        company_website: process.env.COMPANY_WEBSITE || "yourcompanywebsite.com"
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
  isAuthenticated,
  checkPermission('orders:view_details'), // Viewing/generating a packing slip requires viewing order details
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
  isAuthenticated,
  checkPermission('orders:view_details'),
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

// POST /admin/orders/:orderId/refund - Process a (mock) full refund for an order
router.post(
  '/orders/:orderId/refund',
  isAuthenticated,
  checkPermission('orders:manage_refunds'),
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt(),
    body('reason').optional().isString().trim().withMessage('Refund reason must be a string if provided.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    // itemsToRefund expected structure: [{ order_item_id: X, quantity_to_refund: Y }, ...]
    // If itemsToRefund is not provided or empty, it's treated as a full refund.
    const { reason, itemsToRefund } = req.body;
    const adminUserId = req.user.userId;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch the order
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE', // Lock the order row
        [orderId]
      );
      if (orderResult.rows.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found.`);
      }
      const order = orderResult.rows[0];

      // 2. Check if order can be refunded
      if (order.payment_status === 'refunded') {
        throw new BadRequestError('This order has already been fully refunded.');
      }
      // For partial refunds, allow if payment_status is 'paid' or 'partially_refunded'
      if (itemsToRefund && itemsToRefund.length > 0 && !['paid', 'partially_refunded'].includes(order.payment_status)) {
        throw new BadRequestError(`Order payment status is '${order.payment_status}'. Partial refunds typically apply to 'paid' or 'partially_refunded' orders.`);
      }

      // 3. Determine items to refund and total refund amount
      let itemsToProcessForRefund = [];
      let calculatedRefundAmount = 0;
      let isFullRefundIntent = true; // Assume full refund unless specific items are provided

      if (itemsToRefund && itemsToRefund.length > 0) {
        isFullRefundIntent = false;
        for (const itemToRefund of itemsToRefund) {
          if (!itemToRefund.order_item_id || typeof itemToRefund.quantity_to_refund !== 'number' || itemToRefund.quantity_to_refund <= 0) {
            throw new BadRequestError('Each item to refund must have a valid order_item_id and a positive quantity_to_refund.');
          }
          const orderItemResult = await client.query(
            'SELECT oi.*, p.name as product_name, pv.sku as variant_sku, p.sku as base_sku FROM order_items oi JOIN products p ON oi.product_id = p.id LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id WHERE oi.id = $1 AND oi.order_id = $2',
            [itemToRefund.order_item_id, orderId]
          );
          if (orderItemResult.rows.length === 0) {
            throw new NotFoundError(`Order item with ID ${itemToRefund.order_item_id} not found in order ${orderId}.`);
          }
          const orderItem = orderItemResult.rows[0];
          // Basic check: cannot refund more than ordered. More complex logic would track already refunded quantities.
          if (itemToRefund.quantity_to_refund > orderItem.quantity) {
            throw new BadRequestError(`Cannot refund ${itemToRefund.quantity_to_refund} for item ${orderItem.product_name} (ID: ${orderItem.id}). Ordered quantity was ${orderItem.quantity}.`);
          }
          itemsToProcessForRefund.push({ ...orderItem, quantity_to_refund: itemToRefund.quantity_to_refund });
          calculatedRefundAmount += parseFloat(orderItem.price_at_purchase) * itemToRefund.quantity_to_refund;
        }
      } else { // Full refund
        const allOrderItemsResult = await client.query(
          'SELECT oi.*, p.name as product_name, pv.sku as variant_sku, p.sku as base_sku FROM order_items oi JOIN products p ON oi.product_id = p.id LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id WHERE oi.order_id = $1',
          [orderId]
        );
        itemsToProcessForRefund = allOrderItemsResult.rows.map(item => ({ ...item, quantity_to_refund: item.quantity }));
        calculatedRefundAmount = parseFloat(order.total_amount) - (parseFloat(order.discount_amount_applied) || 0); // Approximate for full refund
        // More accurately, sum of (price_at_purchase * quantity) for all items, then subtract order-level discount proportionally if any.
        // For simplicity now, use total_amount for full refund scenario if no specific items given.
        // However, if itemsToRefund is empty, we are treating it as full refund of original items.
        // The order.total_amount already includes tax and discounts.
        // For a true "full refund of items value", we should sum their price_at_purchase * quantity.
        calculatedRefundAmount = itemsToProcessForRefund.reduce((sum, item) => sum + (parseFloat(item.price_at_purchase) * item.quantity_to_refund), 0);

      }
      calculatedRefundAmount = parseFloat(calculatedRefundAmount.toFixed(2));

      // 4. Update inventory and log stock movements
      for (const item of itemsToProcessForRefund) {
        const qtyToRestock = item.quantity_to_refund;
        const oldStockResult = await client.query(
          item.product_variant_id
            ? 'SELECT stock_quantity FROM product_variants WHERE id = $1 FOR UPDATE'
            : 'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
          [item.product_variant_id || item.product_id]
        );
        const oldStockQuantity = oldStockResult.rows[0]?.stock_quantity || 0;
        const newStockQuantity = oldStockQuantity + qtyToRestock;

        if (item.product_variant_id) {
          await client.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [qtyToRestock, item.product_variant_id]
          );
        } else {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [qtyToRestock, item.product_id]
          );
        }
        await client.query(
          `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [item.product_id, item.product_variant_id || null, adminUserId, 'refund_restock', qtyToRestock, newStockQuantity, `Refund Order #${orderId}. Item ID ${item.id}. Reason: ${reason || 'N/A'}`, orderId.toString()]
        );
      }

      // 5. Update order status and payment status
      // This part needs more robust logic to track total amount refunded vs order total.
      // For now, if any partial refund, mark as 'partially_refunded'. If it was a full refund intent, mark 'refunded'.
      let newPaymentStatus = order.payment_status;
      let newOrderStatus = order.status;

      if (isFullRefundIntent) {
        newPaymentStatus = 'refunded';
        newOrderStatus = 'refunded';
      } else {
        newPaymentStatus = 'partially_refunded'; // Could also check if total refunded now matches order total
        newOrderStatus = 'partially_refunded'; // Or keep current status if some items remain fulfilled
      }
      // A more precise check for full refund status:
      // Query sum of (price_at_purchase * quantity) for all order_items.
      // Query sum of (price_at_purchase * quantity_refunded) for all order_items after this refund.
      // If they match, then it's fully refunded. This requires tracking refunded quantity per item.
      // For now, this simplified status update will do.

      const updatedOrderResult = await client.query(
        `UPDATE orders SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [newOrderStatus, newPaymentStatus, orderId]
      );

      // 6. Create audit log
      await auditLogService.recordAuditEvent(
        'ORDER_REFUND_PROCESSED',
        { userId: adminUserId, userEmail: req.user.email },
        { resourceType: 'ORDER', resourceId: orderId },
        {
          refund_type: isFullRefundIntent ? 'full' : 'partial',
          reason: reason || 'N/A',
          refunded_amount_this_transaction: calculatedRefundAmount, // This is the value of items refunded this time
          previous_status: order.status,
          previous_payment_status: order.payment_status,
          items_restocked: itemsToProcessForRefund.map(i => ({ order_item_id: i.id, product_id: i.product_id, variant_id: i.product_variant_id, name: i.product_name, sku: i.variant_sku || i.base_sku, refunded_qty: i.quantity_to_refund }))
        },
        req
      );

      await client.query('COMMIT');
      res.status(200).json({
        message: `Order #${orderId} refund processed. Status: ${newOrderStatus}. Payment Status: ${newPaymentStatus}.`,
        order: updatedOrderResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      next(error); // Pass to global error handler
    } finally {
      client.release();
    }
  }
);


module.exports = router;
