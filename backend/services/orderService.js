// backend/services/orderService.js
const db = require('../db');
const { NotFoundError, AppError, BadRequestError, ConflictError } = require('../utils/AppError');

/**
 * Retrieves a paginated list of all orders for the admin view.
 * @param {object} options - Pagination options.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10] // Default limit from adminOrders route
 * @returns {Promise<object>} An object containing { data: orders, pagination: {...} }.
 * @throws {AppError} If database operation fails.
 */
async function getAllAdminOrders(options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const offset = (page - 1) * limit;

  try {
    const countQuery = 'SELECT COUNT(*) FROM orders';
    const ordersQuery = `
      SELECT
        o.id, o.user_id, u.email as user_email,
        o.status, o.payment_status, o.total_amount,
        o.invoice_number, o.invoice_issue_date,
        o.shipping_address_line1, o.shipping_city, o.shipping_postal_code, o.shipping_country,
        o.created_at, o.updated_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const totalResult = await db.query(countQuery);
    const totalOrders = parseInt(totalResult.rows[0].count, 10);

    const ordersResult = await db.query(ordersQuery, [limit, offset]);

    return {
      data: ordersResult.rows,
      pagination: {
        total: totalOrders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
      }
    };
  } catch (error) {
    console.error('Error in orderService.getAllAdminOrders:', error);
    throw new AppError('Failed to retrieve orders for admin.', 500, 'ADMIN_ORDERS_FETCH_FAILED');
  }
}

/**
 * Retrieves a specific order by its ID for the admin view, including order items.
 * @param {number} orderId - The ID of the order.
 * @returns {Promise<object>} The order object with items.
 * @throws {NotFoundError} If the order is not found.
 * @throws {AppError} If database operation fails.
 */
async function getAdminOrderById(orderId) {
  try {
    const orderQuery = `
      SELECT
        o.*,
        u.email as user_email,
        u.role as user_role
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = $1;
    `;
    const orderResult = await db.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found.`);
    }
    const order = orderResult.rows[0];

    const itemsQuery = `
      SELECT
        oi.id as order_item_id, oi.product_id, oi.product_variant_id,
        oi.quantity, oi.price_at_purchase,
        oi.tax_class_id_at_purchase,
        tc.name as tax_class_name_at_purchase,
        p.name as product_name, p.image_url as product_image_url,
        pv.sku as variant_sku,
        p.sku as base_product_sku
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      LEFT JOIN tax_classes tc ON oi.tax_class_id_at_purchase = tc.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [orderId]);
    order.items = itemsResult.rows.map(item => ({
      ...item,
      price_at_purchase: parseFloat(item.price_at_purchase),
      display_sku: item.variant_sku || item.base_product_sku || 'N/A'
    }));

    return order;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in orderService.getAdminOrderById for ID ${orderId}:`, error);
    throw new AppError(`Failed to retrieve order ID ${orderId} for admin.`, 500, 'ADMIN_ORDER_FETCH_BY_ID_FAILED');
  }
}

// const { BadRequestError } = require('../utils/AppError'); // REMOVED - Consolidated at top

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded']; // Added refund statuses
const BILLABLE_ORDER_STATUSES = ['shipped', 'completed', 'delivered'];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided'];


/**
 * Updates the status and/or payment_status of an order.
 * Generates an invoice number if the order moves to a billable status and doesn't have one.
 * @param {number} orderId - The ID of the order to update.
 * @param {object} data - Object containing new status and/or payment_status.
 * @param {string} [data.status] - The new order status.
 * @param {string} [data.payment_status] - The new payment status.
 * @param {number} adminUserId - ID of the admin performing the update (for audit).
 * @returns {Promise<object>} The updated order object.
 * @throws {NotFoundError} If the order is not found.
 * @throws {BadRequestError} If status values are invalid or no updatable fields provided.
 * @throws {AppError} For other DB errors.
 */
async function updateOrderStatus(orderId, data, adminUserId /* for potential future use in audit within service */) {
  const { status: newStatus, payment_status: newPaymentStatus } = data;

  if (!newStatus && !newPaymentStatus) {
    throw new BadRequestError('At least one of status or payment_status is required for update.');
  }
  if (newStatus && !ALLOWED_ORDER_STATUSES.includes(newStatus.toLowerCase())) {
    throw new BadRequestError(`Invalid order status. Allowed: ${ALLOWED_ORDER_STATUSES.join(', ')}`);
  }
  if (newPaymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(newPaymentStatus.toLowerCase())) {
    throw new BadRequestError(`Invalid payment status. Allowed: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const orderCheckResult = await client.query(
      'SELECT id, status, invoice_number, payment_status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (orderCheckResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found.`);
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
      // Simple invoice number generation, can be made more robust/configurable
      const generatedInvoiceNumber = `INV-${year}${month}${day}-${orderId}`;

      setClauses.push(`invoice_number = $${paramIndex++}`);
      queryParams.push(generatedInvoiceNumber);
      setClauses.push(`invoice_issue_date = CURRENT_TIMESTAMP`);
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // Release lock
      // Return current order data as no update was performed or needed. Fetch full data.
      return getAdminOrderById(orderId);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(orderId); // For WHERE id = $N

    const updateQuery = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const updatedOrderResult = await client.query(updateQuery, queryParams);

    await client.query('COMMIT');
    // The RETURNING * gives the full order, but getAdminOrderById ensures consistent structure with items.
    // For this specific method, returning the direct result of RETURNING * is fine as items aren't modified.
    return updatedOrderResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error(`Error in orderService.updateOrderStatus for order ID ${orderId}:`, error);
    throw new AppError(`Failed to update order status for ID ${orderId}.`, 500, 'ORDER_STATUS_UPDATE_FAILED');
  } finally {
    client.release();
  }
}


const config = require('../config'); // For company details, QR code base URL

/**
 * Retrieves and formats order details suitable for PDF generation (invoice or packing slip).
 * @param {number} orderId - The ID of the order.
 * @param {string} type - 'invoice' or 'packing-slip'.
 * @returns {Promise<object>} The formatted order data object.
 * @throws {NotFoundError} If the order is not found.
 * @throws {AppError} If database operation fails.
 */
async function getOrderDetailsForPdf(orderId, type) {
  try {
    const orderQuery = `
      SELECT
        o.*,
        u.email as user_email,
        u.name as user_name, // Assuming 'name' field exists on users for customer name
        u.first_name as user_first_name, // For packing slip if 'name' is full name
        u.last_name as user_last_name   // For packing slip
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1;
    `;
    const orderResult = await db.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found.`);
    }
    const orderData = orderResult.rows[0];

    const itemsQuery = `
      SELECT
        oi.id as order_item_id,
        oi.quantity,
        oi.price_at_purchase,
        p.name as product_name,
        p.sku as base_product_sku,
        pv.sku as variant_sku,
        p.image_url as base_product_image_url,
        pv.image_url as variant_image_url,
        oi.tax_class_id_at_purchase,
        tc.name AS tax_class_name_at_purchase,
        oi.line_item_tax_amount,
        oi.applied_tax_rate_percentage,
        pv.id as product_variant_id -- for fetching variant option details
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      LEFT JOIN tax_classes tc ON oi.tax_class_id_at_purchase = tc.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [orderId]);

    const processedItems = [];
    for (const item of itemsResult.rows) {
      let variant_description = null;
      if (item.product_variant_id) {
        // Re-use internal helper from productService if possible, or replicate logic
        const optionDetails = await _getVariantOptionDetails(item.product_variant_id, db); // db is the pool here
        variant_description = optionDetails.map(opt => `${opt.option_name}: ${opt.option_value_name}`).join(', ');
      }
      processedItems.push({
        ...item,
        price_at_purchase: parseFloat(item.price_at_purchase),
        line_item_tax_amount: item.line_item_tax_amount ? parseFloat(item.line_item_tax_amount) : 0,
        applied_tax_rate_percentage: item.applied_tax_rate_percentage ? parseFloat(item.applied_tax_rate_percentage) : null,
        display_sku: item.variant_sku || item.base_product_sku || 'N/A',
        image_url: item.variant_image_url || item.base_product_image_url, // Prioritize variant image
        variant_description
      });
    }
    orderData.items = processedItems;

    // Add company details from config
    orderData.company_name = config.company.name;
    orderData.company_address = config.company.address;
    orderData.company_logo_url = config.company.logoUrl;
    orderData.company_phone = config.company.phone;
    orderData.company_email = config.company.email;
    orderData.company_website = config.company.website;

    // Add customer name for packing slip if not already full name
    orderData.customer_name_for_slip = (orderData.user_first_name || orderData.user_last_name)
        ? `${orderData.user_first_name || ''} ${orderData.user_last_name || ''}`.trim()
        : orderData.user_name;


    // Add QR code URL for invoice
    if (type === 'invoice' && orderData.id) {
        // This token generation should ideally be more secure or tied to a session/DB record if it's for public access
        const crypto = require('crypto');
        const token = crypto.randomBytes(8).toString('hex');
        orderData.invoice_qr_code_url = `${config.frontendInvoiceViewUrlBase || config.frontendUrlBase + '/invoices'}/${orderData.id}?token=${token}`;
    }

    return orderData;

  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error in orderService.getOrderDetailsForPdf (type: ${type}) for order ID ${orderId}:`, error);
    throw new AppError(`Failed to retrieve order details for PDF (type: ${type}).`, 500, 'ORDER_PDF_DETAILS_FETCH_FAILED');
  }
}

// Need to import _getVariantOptionDetails or have it accessible if it's in productService
// For now, assuming it might be part of a shared utils or re-implemented if this is a separate service.
// Let's assume it's available via productService for now.
const productService = require('../services/productService'); // Temporary, might cause circular if not careful
async function _getVariantOptionDetails(variantId, dbClient) { // Copied for now
    const detailsQuery = `
      SELECT pov.value as option_value_name, po.name as option_name
      FROM product_variant_option_values pvov
      JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
      JOIN product_options po ON pov.product_option_id = po.id
      WHERE pvov.product_variant_id = $1 ORDER BY po.name, pov.value;`;
    const { rows } = await (dbClient || db).query(detailsQuery, [variantId]);
    return rows;
}


const auditLogService = require('../services/auditLogService'); // For audit logging within service if needed, or return data for route to log

/**
 * Processes a refund for an order (full or partial).
 * - Updates order status and payment status.
 * - Restocks items (simplified: increments product/variant stock_quantity).
 * - Creates stock movement logs.
 * - Returns data sufficient for audit logging and email confirmation by the route.
 * @param {number} orderId - The ID of the order to refund.
 * @param {object} refundInput - Refund details.
 * @param {string} [refundInput.reason] - Optional reason for refund.
 * @param {Array<{order_item_id: number, quantity_to_refund: number}>} [refundInput.itemsToRefund] - Specific items and quantities for partial refund. If empty/null, assumes full refund.
 * @param {number} adminUserId - ID of the admin performing the refund.
 * @returns {Promise<object>} Contains { updatedOrder, refundedItemsSummary, calculatedRefundAmount, isFullRefund }
 * @throws {NotFoundError} If order or order items not found.
 * @throws {BadRequestError} If order cannot be refunded (e.g., already refunded, invalid items).
 * @throws {AppError} For other DB errors.
 */
async function processOrderRefund(orderId, refundInput, adminUserId) {
  const { reason, itemsToRefund } = refundInput;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found.`);
    }
    const order = orderResult.rows[0];

    if (order.payment_status === 'refunded') {
      throw new BadRequestError('This order has already been fully refunded.');
    }
    if (itemsToRefund && itemsToRefund.length > 0 && !['paid', 'partially_refunded'].includes(order.payment_status)) {
      throw new BadRequestError(`Order payment status is '${order.payment_status}'. Partial refunds typically apply to 'paid' or 'partially_refunded' orders.`);
    }

    let itemsToProcessForRefund = [];
    let calculatedRefundAmount = 0;
    let isFullRefundIntent = (!itemsToRefund || itemsToRefund.length === 0);

    if (isFullRefundIntent) {
      const allOrderItemsResult = await client.query(
        `SELECT oi.*, p.name as product_name_from_db, pv.sku as variant_sku, p.sku as base_sku
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
         WHERE oi.order_id = $1`,
        [orderId]
      );
      itemsToProcessForRefund = allOrderItemsResult.rows.map(item => ({ ...item, quantity_to_refund: item.quantity, product_name: item.product_name_from_db }));
      // For full refund, the amount being refunded is sum of (price_at_purchase * quantity) for items.
      // This does not automatically account for original order-level discounts or taxes in the refund amount calculation here.
      // The order.total_amount is post-discount and post-tax.
      // A true full refund might mean refunding order.total_amount.
      // For simplicity, we are refunding the sum of item values at purchase.
      calculatedRefundAmount = itemsToProcessForRefund.reduce((sum, item) => sum + (parseFloat(item.price_at_purchase) * item.quantity_to_refund), 0);

    } else { // Partial refund
      for (const itemToRef of itemsToRefund) {
        if (!itemToRef.order_item_id || typeof itemToRef.quantity_to_refund !== 'number' || itemToRef.quantity_to_refund <= 0) {
          throw new BadRequestError('Each item to refund must have a valid order_item_id and a positive quantity_to_refund.');
        }
        const oiResult = await client.query(
          `SELECT oi.*, p.name as product_name_from_db, pv.sku as variant_sku, p.sku as base_sku
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
           WHERE oi.id = $1 AND oi.order_id = $2`,
          [itemToRef.order_item_id, orderId]
        );
        if (oiResult.rows.length === 0) {
          throw new NotFoundError(`Order item with ID ${itemToRef.order_item_id} not found in order ${orderId}.`);
        }
        const orderItem = oiResult.rows[0];
        if (itemToRef.quantity_to_refund > orderItem.quantity) { // Basic check, more complex logic needed for already refunded items
          throw new BadRequestError(`Cannot refund ${itemToRef.quantity_to_refund} for item ${orderItem.product_name_from_db}. Ordered: ${orderItem.quantity}.`);
        }
        itemsToProcessForRefund.push({ ...orderItem, quantity_to_refund: itemToRef.quantity_to_refund, product_name: orderItem.product_name_from_db });
        calculatedRefundAmount += parseFloat(orderItem.price_at_purchase) * itemToRef.quantity_to_refund;
      }
    }
    calculatedRefundAmount = parseFloat(calculatedRefundAmount.toFixed(2));

    // Restock items and log movements
    for (const item of itemsToProcessForRefund) {
      const qtyToRestock = item.quantity_to_refund;
      let oldStockQuantity, newStockQuantity;

      if (item.product_variant_id) {
        const vr = await client.query('SELECT stock_quantity FROM product_variants WHERE id = $1 FOR UPDATE', [item.product_variant_id]);
        oldStockQuantity = vr.rows[0].stock_quantity;
        newStockQuantity = oldStockQuantity + qtyToRestock;
        await client.query('UPDATE product_variants SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStockQuantity, item.product_variant_id]);
      } else {
        const pr = await client.query('SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
        oldStockQuantity = pr.rows[0].stock_quantity;
        newStockQuantity = oldStockQuantity + qtyToRestock;
        await client.query('UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStockQuantity, item.product_id]);
      }
      await client.query(
        `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [item.product_id, item.product_variant_id || null, adminUserId, 'refund_restock', qtyToRestock, newStockQuantity, `Refund Order #${orderId}. Item: ${item.product_name}. Reason: ${reason || 'N/A'}`, orderId.toString()]
      );
    }

    // Update order status and payment status
    // This needs more sophisticated logic for partial vs full based on total refunded amount vs order total.
    // For now, simplified:
    let newPaymentStatus = isFullRefundIntent ? 'refunded' : 'partially_refunded';
    let newOrderStatus = isFullRefundIntent ? 'refunded' : 'partially_refunded'; // Or other appropriate status

    // A more precise check for full refund status:
    // This would involve tracking cumulative refunded amounts per order or per item.
    // If (order.total_amount_refunded_so_far + calculatedRefundAmount) >= order.total_amount, then it's fully refunded.
    // This requires adding a 'total_amount_refunded_so_far' column to orders table, or similar tracking.
    // For now, rely on isFullRefundIntent.

    const updatedOrderResult = await client.query(
      `UPDATE orders SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [newOrderStatus, newPaymentStatus, orderId]
    );

    await client.query('COMMIT');

    return {
      updatedOrder: updatedOrderResult.rows[0],
      refundedItemsSummary: itemsToProcessForRefund.map(i => ({
          name: i.product_name,
          sku: i.variant_sku || i.base_sku,
          refunded_qty: i.quantity_to_refund,
          price_at_purchase: i.price_at_purchase
      })),
      calculatedRefundAmount, // This is the sum of item values refunded in this transaction
      isFullRefundIntent,
      originalOrderDataForEmail: { // Data that might be needed for email construction by the route
          id: order.id,
          user_email: order.user_email, // Assuming orders table has user_email directly or it was joined
          user_name: order.user_name // Assuming orders table has user_name
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error(`Error in orderService.processOrderRefund for order ID ${orderId}:`, error);
    throw new AppError(`Failed to process refund for order ID ${orderId}.`, 500, 'ORDER_REFUND_FAILED');
  } finally {
    client.release();
  }
}


module.exports = {
  getAllAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  getOrderDetailsForPdf,
  processOrderRefund,
  createPublicOrder, // Added new function
  getUserOrderHistory, // Added for user's order history
  getUserOrderDetails, // Added for user's specific order details
};

const bcrypt = require('bcrypt');
const taxService = require('./taxService'); // Assuming it's in the same directory
// const { BadRequestError, ConflictError } = require('../utils/AppError'); // REMOVED - Consolidated at top

/**
 * Creates a new public order, handling guest or authenticated users,
 * stock checks, inventory updates, tax calculation, and discount application.
 * All operations are performed within a single database transaction.
 *
 * @param {object} orderRequestData - Data related to the order request.
 * @param {Array<object>} orderRequestData.cartItems - Array of items from the cart.
 *        Each item: { productId: number, productVariantId?: number, quantity: number, name?: string, unit_price?: number (optional, for validation/reference) }
 * @param {object} orderRequestData.shippingAddress - Shipping address object.
 * @param {object} [orderRequestData.billingAddress] - Optional billing address. Defaults to shipping if not provided.
 * @param {string} [orderRequestData.discount_code] - Optional discount code.
 * @param {object} [orderRequestData.guestDetails] - Details for guest checkout: { email, firstName, lastName }.
 * @param {boolean} [orderRequestData.mock_payment_successful=false] - Flag for mock payment status.
 * @param {object} [authenticatedUser] - Optional authenticated user object from req.user.
 *        If provided: { userId: number, email?: string, name?: string, is_tax_exempt?: boolean }
 *
 * @returns {Promise<object>} The newly created order object, including order items and other relevant details.
 * @throws {BadRequestError} For invalid input, insufficient stock, or other business rule violations.
 * @throws {NotFoundError} If products/variants in cart are not found.
 * @throws {ConflictError} If guest email conflicts with an existing non-guest user.
 * @throws {AppError} For other internal or unexpected errors.
 */
async function createPublicOrder(orderRequestData, authenticatedUser) {
  const {
    cartItems, // Renamed from 'cart' for clarity within service
    shippingAddress,
    billingAddress,
    discount_code,
    guestDetails,
    mock_payment_successful = false // Default to false
  } = orderRequestData;

  let userId;
  let userEmailForOrder;
  let userNameForOrder;
  let userIsTaxExempt = false;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. User Handling
    if (authenticatedUser && authenticatedUser.userId) {
      userId = authenticatedUser.userId;
      // Fetch user details, especially is_tax_exempt, as it might not be on req.user
      const userResult = await client.query('SELECT email, name, is_tax_exempt FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new NotFoundError('Authenticated user record not found.'); // Should not happen if token is valid
      }
      userEmailForOrder = userResult.rows[0].email;
      userNameForOrder = userResult.rows[0].name;
      userIsTaxExempt = userResult.rows[0].is_tax_exempt || false;
    } else if (guestDetails) {
      if (!guestDetails.email || !guestDetails.firstName || !guestDetails.lastName) {
        throw new BadRequestError('Guest email and name are required for guest checkout.');
      }
      userEmailForOrder = guestDetails.email.trim().toLowerCase();
      userNameForOrder = `${guestDetails.firstName.trim()} ${guestDetails.lastName.trim()}`;

      const existingUserCheck = await client.query('SELECT id, name, role, is_tax_exempt FROM users WHERE email = $1', [userEmailForOrder]);
      if (existingUserCheck.rows.length > 0) {
        const existingUser = existingUserCheck.rows[0];
        if (existingUser.role !== 'guest') {
          throw new ConflictError('An account with this email already exists. Please log in or use a different email.');
        }
        userId = existingUser.id;
        userIsTaxExempt = existingUser.is_tax_exempt || false;
        if (userNameForOrder !== existingUser.name) {
          await client.query('UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [userNameForOrder, userId]);
        }
      } else {
        const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
        const saltRounds = 10; // Consider moving to config
        const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);
        const guestUserInsertResult = await client.query(
          'INSERT INTO users (name, email, password, role, is_tax_exempt, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, is_tax_exempt',
          [userNameForOrder, userEmailForOrder, hashedPassword, 'guest', false]
        );
        userId = guestUserInsertResult.rows[0].id;
        userIsTaxExempt = guestUserInsertResult.rows[0].is_tax_exempt;
      }
    } else {
      throw new BadRequestError('User authentication or guest details are required.');
    }

    // 2. Validate Addresses (Basic validation, route level should be more comprehensive)
    if (!shippingAddress || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
      throw new BadRequestError('Complete shipping address is required.');
    }
    const finalBillingAddress = (billingAddress && billingAddress.line1 && billingAddress.city && billingAddress.postalCode && billingAddress.country)
      ? billingAddress
      : shippingAddress;

    // 3. Validate Cart
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw new BadRequestError('Cart is required and cannot be empty.');
    }
    for (const item of cartItems) {
      if (!item.productId || typeof item.productId !== 'number' || !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new BadRequestError('Each cart item must have a valid base productId and a positive quantity.');
      }
      if (item.productVariantId && (typeof item.productVariantId !== 'number' || item.productVariantId <=0) ) {
         throw new BadRequestError(`Invalid productVariantId format for product ${item.productId}. Must be a positive number if provided.`);
      }
    }

    // 4. Process Cart Items & Stock
    let subtotalForItems = 0;
    const orderItemsToInsert = [];
    const stockUpdates = []; // For aggregate stock and logging

    for (const item of cartItems) {
      let priceAtPurchase;
      let productNameForDisplay; // Used for messages and order item record
      let productSkuForRecord;
      let aggregate_old_stock_quantity; // For logging

      if (item.productVariantId) {
        const variantResult = await client.query(
          `SELECT pv.stock_quantity, pv.price_modifier, pv.sku as variant_sku,
                  p.price as base_price, p.name as base_product_name, p.sku as base_product_sku
           FROM product_variants pv
           JOIN products p ON pv.product_id = p.id
           WHERE pv.id = $1 AND pv.product_id = $2 FOR UPDATE OF pv, p`,
          [item.productVariantId, item.productId]
        );
        if (variantResult.rows.length === 0) {
          throw new NotFoundError(`Product variant with ID ${item.productVariantId} for product ID ${item.productId} not found.`);
        }
        const dbVariant = variantResult.rows[0];
        aggregate_old_stock_quantity = dbVariant.stock_quantity;
        priceAtPurchase = parseFloat(dbVariant.base_price) + parseFloat(dbVariant.price_modifier);
        productNameForDisplay = `${dbVariant.base_product_name} (Variant: ${dbVariant.variant_sku || item.productVariantId})`;
        productSkuForRecord = dbVariant.variant_sku || dbVariant.base_product_sku;

        // Batch deduction for variant
        const batches = await client.query(
          `SELECT id, current_quantity FROM inventory_batches
           WHERE product_id = $1 AND variant_id = $2 AND current_quantity > 0
           ORDER BY expiry_date ASC NULLS LAST, received_date ASC, id ASC FOR UPDATE`,
          [item.productId, item.productVariantId]
        );
        let totalBatchStock = batches.rows.reduce((sum, batch) => sum + batch.current_quantity, 0);
        if (totalBatchStock < item.quantity) {
          throw new BadRequestError(`Insufficient batch stock for variant "${productNameForDisplay}". Available: ${totalBatchStock}, Requested: ${item.quantity}.`);
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
        stockUpdates.push({ type: 'variant', id: item.productVariantId, productId: item.productId, quantityToDecrement: item.quantity, old_stock_quantity: aggregate_old_stock_quantity });
      } else { // Base Product
        const productResult = await client.query(
          'SELECT name, price, stock_quantity, sku FROM products WHERE id = $1 AND has_variants = FALSE FOR UPDATE',
          [item.productId]
        );
        if (productResult.rows.length === 0) {
          throw new NotFoundError(`Product with ID ${item.productId} not found or it has variants (must specify variantId).`);
        }
        const dbProduct = productResult.rows[0];
        aggregate_old_stock_quantity = dbProduct.stock_quantity;
        priceAtPurchase = parseFloat(dbProduct.price);
        productNameForDisplay = dbProduct.name;
        productSkuForRecord = dbProduct.sku;

        // Batch deduction for base product
        const batches = await client.query(
          `SELECT id, current_quantity FROM inventory_batches
           WHERE product_id = $1 AND variant_id IS NULL AND current_quantity > 0
           ORDER BY expiry_date ASC NULLS LAST, received_date ASC, id ASC FOR UPDATE`,
          [item.productId]
        );
        let totalBatchStock = batches.rows.reduce((sum, batch) => sum + batch.current_quantity, 0);
        if (totalBatchStock < item.quantity) {
          throw new BadRequestError(`Insufficient batch stock for product "${productNameForDisplay}". Available: ${totalBatchStock}, Requested: ${item.quantity}.`);
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
        stockUpdates.push({ type: 'base', id: item.productId, productId: item.productId, quantityToDecrement: item.quantity, old_stock_quantity: aggregate_old_stock_quantity });
      }

      subtotalForItems += priceAtPurchase * item.quantity;
      orderItemsToInsert.push({
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        product_name_at_purchase: productNameForDisplay, // Store the descriptive name
        product_sku_at_purchase: productSkuForRecord,
        quantity: item.quantity,
        price_at_purchase: priceAtPurchase, // This is pre-tax, pre-discount unit price
      });
    }
    subtotalForItems = parseFloat(subtotalForItems.toFixed(2));

    // 5. Calculate Taxes
    const cartItemsForTaxCalc = orderItemsToInsert.map(item => ({
      product_id: item.productId, variant_id: item.productVariantId,
      quantity: item.quantity, unit_price: item.price_at_purchase
    }));

    const taxCalculationResult = await taxService.calculateTaxForCartItems(cartItemsForTaxCalc, userId, finalBillingAddress, userIsTaxExempt, client);
    const orderTotalTaxAmount = taxCalculationResult.total_tax_amount;
    const itemsWithTaxDetails = taxCalculationResult.line_items_with_tax_details;
    const orderTaxSummaryDetails = taxCalculationResult.tax_summary_details;

    let subtotalExclusiveForDiscount = itemsWithTaxDetails.reduce((acc, item) => acc + (parseFloat(item.calculated_exclusive_unit_price) * item.quantity), 0);
    subtotalExclusiveForDiscount = parseFloat(subtotalExclusiveForDiscount.toFixed(2));

    // 6. Apply Discount
    let finalAmountPreTax = subtotalExclusiveForDiscount;
    let appliedDiscountId = null;
    let appliedDiscountCode = null;
    let appliedDiscountAmount = 0; // Initialize to 0

    if (discount_code) {
      const discountResult = await client.query('SELECT * FROM discounts WHERE UPPER(code) = UPPER($1) FOR UPDATE', [discount_code]);
      if (discountResult.rows.length === 0) throw new BadRequestError('Invalid discount code.');
      const discount = discountResult.rows[0];
      if (!discount.is_active || (discount.valid_from && new Date(discount.valid_from) > new Date()) || (discount.valid_until && new Date(discount.valid_until) < new Date()) || (discount.usage_limit !== null && discount.times_used >= discount.usage_limit) || (discount.min_order_amount !== null && subtotalExclusiveForDiscount < parseFloat(discount.min_order_amount))) {
        throw new BadRequestError('Discount code cannot be applied (inactive, expired, limit reached, or minimum order not met).');
      }
      if (discount.type === 'percentage') {
        appliedDiscountAmount = subtotalExclusiveForDiscount * (parseFloat(discount.value) / 100.0);
      } else if (discount.type === 'fixed_amount') {
        appliedDiscountAmount = parseFloat(discount.value);
      }
      appliedDiscountAmount = parseFloat(Math.min(subtotalExclusiveForDiscount, appliedDiscountAmount).toFixed(2));
      finalAmountPreTax = parseFloat((subtotalExclusiveForDiscount - appliedDiscountAmount).toFixed(2));
      appliedDiscountId = discount.id;
      appliedDiscountCode = discount.code;
      await client.query('UPDATE discounts SET times_used = times_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [discount.id]);
    }

    // 7. Calculate Final Total
    const grandTotal = parseFloat((finalAmountPreTax + orderTotalTaxAmount).toFixed(2));

    // 8. Create Order Record
    const initialOrderStatus = 'pending';
    const initialPaymentStatus = mock_payment_successful ? 'paid' : 'pending';
    const orderInsertResult = await client.query(
      `INSERT INTO orders (
          user_id, status, payment_status, total_amount, original_total_amount,
          discount_id, discount_code_applied, discount_amount_applied,
          total_tax_amount, tax_summary_details,
          shipping_address_line1, shipping_address_line2, shipping_city, shipping_postal_code, shipping_country,
          billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country,
          created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        userId, initialOrderStatus, initialPaymentStatus, grandTotal, subtotalExclusiveForDiscount,
        appliedDiscountId, appliedDiscountCode, appliedDiscountAmount,
        orderTotalTaxAmount, orderTaxSummaryDetails ? JSON.stringify(orderTaxSummaryDetails) : null,
        shippingAddress.line1, shippingAddress.line2 || null, shippingAddress.city, shippingAddress.postalCode, shippingAddress.country,
        finalBillingAddress.line1, finalBillingAddress.line2 || null, finalBillingAddress.city, finalBillingAddress.postalCode, finalBillingAddress.country
      ]
    );
    const newOrder = orderInsertResult.rows[0];

    // 9. Create Order Item Records
    const orderItemInsertQuery = `
      INSERT INTO order_items (
        order_id, product_id, product_variant_id, product_name_at_purchase, product_sku_at_purchase,
        quantity, price_at_purchase, line_item_tax_amount, applied_tax_rate_percentage, tax_class_id_at_purchase
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`;

    for (let i = 0; i < orderItemsToInsert.length; i++) {
      const baseItem = orderItemsToInsert[i];
      const taxDetailForItem = itemsWithTaxDetails.find(tdi => tdi.product_id === baseItem.productId && (tdi.variant_id || null) === (baseItem.productVariantId || null) );

      await client.query(orderItemInsertQuery, [
        newOrder.id, baseItem.productId, baseItem.productVariantId, baseItem.product_name_at_purchase, baseItem.product_sku_at_purchase,
        baseItem.quantity, baseItem.price_at_purchase, // Storing unit price pre-tax
        taxDetailForItem ? taxDetailForItem.line_item_tax_amount : 0,
        taxDetailForItem ? taxDetailForItem.applied_tax_rate_percentage : null,
        taxDetailForItem ? taxDetailForItem.tax_class_id_at_purchase : null
      ]);
    }

    // 10. Update Aggregate Stock & Log Movements
    for (const stockUpdate of stockUpdates) {
      const newAggregateStock = stockUpdate.old_stock_quantity - stockUpdate.quantityToDecrement;
      if (stockUpdate.type === 'variant') {
        await client.query('UPDATE product_variants SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [newAggregateStock, stockUpdate.id]);
      } else {
        await client.query('UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [newAggregateStock, stockUpdate.id]);
      }
      await client.query(
        `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [stockUpdate.productId, stockUpdate.type === 'variant' ? stockUpdate.id : null, userId, 'sale_deduction', -stockUpdate.quantityToDecrement, newAggregateStock, `Sale - Order #${newOrder.id}`, newOrder.id.toString()]
      );
    }

    // 11. (Optional) Clear User's Cart - This logic would depend on how carts are stored (e.g., DB table, session)
    // For now, assume this is handled by the frontend or a separate cart service call after order success.

    await client.query('COMMIT');

    // Fetch full order details for response (similar to getAdminOrderById)
    const finalCreatedOrder = await this.getAdminOrderById(newOrder.id); // Assuming 'this' context or direct call if standalone

    return finalCreatedOrder;

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError) {
      throw error;
    }
    console.error('[orderService.createPublicOrder] Error:', error);
    throw new AppError('Failed to create order due to an internal server error.', 500, 'ORDER_CREATION_FAILED', { originalError: error.message });
  } finally {
    if (client) client.release();
  }
}


/**
 * Retrieves a paginated list of orders for a specific user.
 * @param {number} userId - The ID of the user.
 * @param {object} paginationOptions - Contains page and limit.
 * @returns {Promise<object>} Paginated list of orders.
 */
async function getUserOrderHistory(userId, paginationOptions = {}) {
  const page = parseInt(paginationOptions.page) || 1;
  let limit = parseInt(paginationOptions.limit) || 10;
  if (limit > 100) limit = 100; // Max limit safeguard

  const offset = (page - 1) * limit;

  try {
    const ordersQuery = `
      SELECT o.id, o.created_at as order_date, o.total_amount, o.status,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const ordersResult = await db.query(ordersQuery, [userId, limit, offset]);

    const totalCountQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1;';
    const totalCountResult = await db.query(totalCountQuery, [userId]);
    const totalOrders = parseInt(totalCountResult.rows[0].count);
    const totalPages = Math.ceil(totalOrders / limit);

    return {
      data: ordersResult.rows,
      pagination: {
        total: totalOrders,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error(`[orderService.getUserOrderHistory] Error for user ID ${userId}:`, error);
    throw new AppError('Failed to retrieve user order history.', 500, 'USER_ORDER_HISTORY_FETCH_FAILED');
  }
}

/**
 * Retrieves detailed information for a specific order, ensuring it belongs to the specified user.
 * @param {number} userId - The ID of the user.
 * @param {number} orderId - The ID of the order.
 * @returns {Promise<object>} The detailed order object.
 */
async function getUserOrderDetails(userId, orderId) {
  if (isNaN(parseInt(orderId)) || parseInt(orderId) <= 0) {
    throw new BadRequestError('Invalid order ID format.');
  }
  const numOrderId = parseInt(orderId);

  try {
    const orderQuery = 'SELECT *, created_at as order_date FROM orders WHERE id = $1 AND user_id = $2;';
    const orderResult = await db.query(orderQuery, [numOrderId, userId]);

    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${numOrderId} not found or does not belong to user ID ${userId}.`);
    }
    const orderData = orderResult.rows[0];

    const itemsQuery = `
      SELECT
        oi.id as item_id,
        oi.product_id,
        oi.product_variant_id,
        oi.quantity,
        oi.price_at_purchase,
        oi.product_name_at_purchase,
        oi.product_sku_at_purchase,
        p.image_url as product_image_url, -- Base product image
        pv.image_url as variant_image_url -- Variant specific image
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [numOrderId]);

    // Ensure order items are correctly associated and image_url is determined
    orderData.items = itemsResult.rows.map(item => ({
      item_id: item.item_id,
      product_id: item.product_id,
      product_variant_id: item.product_variant_id,
      name: item.product_name_at_purchase, // Use the name stored at time of purchase
      sku: item.product_sku_at_purchase,   // Use SKU stored at time of purchase
      quantity: item.quantity,
      price_at_purchase: parseFloat(item.price_at_purchase),
      image_url: item.variant_image_url || item.product_image_url, // Prioritize variant image
    }));


    // Reconstruct response similar to the original route's structure
    const responseOrder = {
      id: orderData.id,
      order_date: orderData.order_date, // This is already aliased from created_at
      status: orderData.status,
      payment_status: orderData.payment_status,
      total_amount: parseFloat(orderData.total_amount),
      shipping_address: {
        line1: orderData.shipping_address_line1,
        line2: orderData.shipping_address_line2,
        city: orderData.shipping_city,
        postalCode: orderData.shipping_postal_code,
        country: orderData.shipping_country,
      },
      billing_address: {
        line1: orderData.billing_address_line1 || orderData.shipping_address_line1,
        line2: orderData.billing_address_line2 || orderData.shipping_address_line2,
        city: orderData.billing_city || orderData.shipping_city,
        postalCode: orderData.billing_postal_code || orderData.shipping_postal_code,
        country: orderData.billing_country || orderData.shipping_country,
      },
      items: orderData.items, // Already processed above
      subtotal: parseFloat(orderData.original_total_amount), // This is the pre-discount, pre-tax subtotal
      total_tax_amount: parseFloat(orderData.total_tax_amount),
      discount_applied: orderData.discount_id ? {
        code: orderData.discount_code_applied,
        amount_deducted: parseFloat(orderData.discount_amount_applied),
      } : null,
      // Additional fields from the 'orders' table if needed by frontend can be added here directly from orderData
      invoice_number: orderData.invoice_number,
      tax_summary_details: orderData.tax_summary_details, // Assuming it's stored as JSONB
    };

    // This logic from route was to recalculate subtotal if original_total_amount was null
    // However, original_total_amount should always be set by createPublicOrder now.
    // If it could still be null, this check would be needed.
    // if (orderData.original_total_amount === null && responseOrder.discount_applied) {
    //    responseOrder.subtotal = parseFloat(orderData.total_amount) + parseFloat(orderData.discount_amount_applied);
    // } else if (orderData.original_total_amount === null && !responseOrder.discount_applied) {
    //    responseOrder.subtotal = parseFloat(orderData.total_amount);
    // }


    return responseOrder;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    console.error(`[orderService.getUserOrderDetails] Error for order ID ${orderId}, user ID ${userId}:`, error);
    throw new AppError('Failed to retrieve user order details.', 500, 'USER_ORDER_DETAILS_FETCH_FAILED');
  }
}
