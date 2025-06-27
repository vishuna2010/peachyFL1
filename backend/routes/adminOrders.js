const express = require('express');
const router = express.Router();
// const db = require('../db'); // No longer directly needed for most routes
const { isAuthenticated, checkPermission } = require('../auth');
const { generateOrderInvoicePdf, generatePackingSlipPdf } = require('../services/pdfService');
const { param, query, body, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError, AppError } = require('../utils/AppError'); // Added AppError
const crypto = require('crypto'); // Still needed for QR code token in one route, could move to service
const auditLogService = require('../services/auditLogService');
const { sendEmail, getRefundConfirmationHtml, getRefundConfirmationText } = require('../services/emailService');
const orderService = require('../services/orderService'); // Import the new service

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
  // page and limit are validated and have defaults from express-validator
  const { page, limit } = req.query;

  try {
    const result = await orderService.getAllAdminOrders({ page, limit });
    // Service returns { data: orders, pagination: { total, page, limit, totalPages } }
    // Add hasNextPage and hasPrevPage for consistency if frontend expects it
    const responsePagination = {
        ...result.pagination,
        hasNextPage: result.pagination.page < result.pagination.totalPages,
        hasPrevPage: result.pagination.page > 1,
    };
    res.status(200).json({
      data: result.data,
      pagination: responsePagination
    });
  } catch (error) {
    next(error);
  }
});

// Validation for GET /orders/:id
const validateOrderIdParam = [
  param('id').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt()
];

// GET /admin/orders/:id - View a specific order
router.get(
  '/orders/:id',
  isAuthenticated,
  checkPermission('orders:view_details'),
  validateOrderIdParam, // Apply validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params; // Validated integer

    try {
      const order = await orderService.getAdminOrderById(id);
      // Service throws NotFoundError if not found, and includes items
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
});

// Validation for PUT /orders/:id/status
const validateUpdateStatusParams = [
  param('id').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt(),
  body('status').optional().trim().toLowerCase().isIn(ALLOWED_ORDER_STATUSES)
    .withMessage(`Invalid status. Allowed: ${ALLOWED_ORDER_STATUSES.join(', ')}`),
  body('payment_status').optional().trim().toLowerCase().isIn(ALLOWED_PAYMENT_STATUSES)
    .withMessage(`Invalid payment_status. Allowed: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`),
  body().custom((value, { req }) => {
    if (!req.body.status && !req.body.payment_status) {
      throw new Error('At least one of status or payment_status is required.');
    }
    return true;
  })
];

// PUT /admin/orders/:id/status - Update an order's status and optionally payment_status
router.put(
  '/orders/:id/status',
  isAuthenticated,
  checkPermission('orders:update_status'),
  validateUpdateStatusParams, // Apply validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params; // Validated integer
    const { status: newStatus, payment_status: newPaymentStatus } = req.body; // Validated
    const adminUserId = req.user.userId;

    try {
      const updatedOrder = await orderService.updateOrderStatus(
        id,
        { status: newStatus, payment_status: newPaymentStatus },
        adminUserId
      );

      // Audit log for status update
      auditLogService.recordAuditEvent(
        'ORDER_STATUS_UPDATE',
        { userId: adminUserId, userEmail: req.user.email },
        { resourceType: 'ORDER', resourceId: id },
        {
          new_status: updatedOrder.status,
          new_payment_status: updatedOrder.payment_status,
          invoice_generated: updatedOrder.invoice_number && !req.body.invoice_number // Approx logic
        },
        req
      ).catch(err => console.error(`Audit log failed for ORDER_STATUS_UPDATE (ID: ${id}):`, err));

      res.status(200).json({
        message: `Order #${id} updated successfully.`,
        order: updatedOrder
      });

    } catch (error) {
      // Service errors (NotFoundError, BadRequestError, AppError) passed to global handler.
      next(error);
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
  '/orders/:orderId/invoice/pdf',
  isAuthenticated,
  checkPermission('orders:view_details'),
  validateOrderIdParam, // Re-use validateOrderIdParam
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.params;

    try {
      const orderDetailsForPdf = await orderService.getOrderDetailsForPdf(orderId, 'invoice');
      const pdfBuffer = await generateOrderInvoicePdf(orderDetailsForPdf);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="invoice_order_${orderId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

// GET /admin/orders/:orderId/packing-slip/pdf - Generate PDF packing slip for an order
router.get(
  '/orders/:orderId/packing-slip/pdf',
  isAuthenticated,
  checkPermission('orders:view_details'),
  validateOrderIdParam, // Re-use
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.params;

    try {
      const packingSlipDataForPdf = await orderService.getOrderDetailsForPdf(orderId, 'packing-slip');
      // Add any packing-slip specific flags if needed, e.g., show_images
      // packingSlipDataForPdf.show_images = req.query.show_images !== 'false';

      const pdfBuffer = await generatePackingSlipPdf(packingSlipDataForPdf);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="packing_slip_order_${orderId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

// GET /admin/orders/:orderId/packing-slip-data - Get structured data for a packing slip
router.get(
  '/orders/:orderId/packing-slip-data',
  isAuthenticated,
  checkPermission('orders:view_details'),
  validateOrderIdParam, // Re-use
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { orderId } = req.params;

    try {
      // Use the same service method; it fetches comprehensive data.
      // The route can then pick what it needs if the structure is slightly different,
      // or the service method could be made more flexible.
      // For now, assuming getOrderDetailsForPdf returns enough for packing slip JSON too.
      const packingSlipData = await orderService.getOrderDetailsForPdf(orderId, 'packing-slip');

      // Transform if necessary for the specific JSON structure expected by this endpoint
      // The current adminOrders.js already returns a structure from its DB queries.
      // The service's getOrderDetailsForPdf returns a very similar structure.
      // We might need to ensure customer_name field is constructed as expected.
      const responseData = {
        order_id: packingSlipData.id, // Assuming service returns 'id' as order_id
        order_date: packingSlipData.created_at, // Assuming service returns 'created_at'
        customer_name: packingSlipData.customer_name_for_slip,
        customer_email: packingSlipData.user_email,
        shipping_address: {
          line1: packingSlipData.shipping_address_line1,
          line2: packingSlipData.shipping_address_line2,
          city: packingSlipData.shipping_city,
          state_province_region: packingSlipData.shipping_state_province_region,
          postal_code: packingSlipData.shipping_postal_code,
          country: packingSlipData.shipping_country
        },
        items: packingSlipData.items.map(item => ({
          order_item_id: item.order_item_id,
          sku: item.display_sku,
          product_name: item.product_name,
          variant_description: item.variant_description,
          quantity_ordered: item.quantity,
          image_url: item.image_url
        }))
      };
      res.status(200).json(responseData);
    } catch (error) {
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
  '/orders/:orderId/refund',
  isAuthenticated,
  checkPermission('orders:manage_refunds'),
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt(),
    body('reason').optional().isString().trim().isLength({ max: 255 }).withMessage('Refund reason cannot exceed 255 characters.'),
    // More specific validation for itemsToRefund array and its objects
    body('itemsToRefund').optional().isArray().withMessage('itemsToRefund must be an array if provided.'),
    body('itemsToRefund.*.order_item_id').if(body('itemsToRefund').exists()).isInt({ gt: 0 }).withMessage('Each itemToRefund must have a positive integer order_item_id.'),
    body('itemsToRefund.*.quantity_to_refund').if(body('itemsToRefund').exists()).isInt({ gt: 0 }).withMessage('Each itemToRefund must have a positive integer quantity_to_refund.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params; // Validated
    const refundInput = req.body; // Contains reason (optional) and itemsToRefund (optional, validated structure)
    const adminUserId = req.user.userId;
    const adminUserEmail = req.user.email; // For audit log

    try {
      const refundResult = await orderService.processOrderRefund(orderId, refundInput, adminUserId);

      const { updatedOrder, refundedItemsSummary, calculatedRefundAmount, isFullRefundIntent, originalOrderDataForEmail } = refundResult;

      // Audit log
      auditLogService.recordAuditEvent(
        'ORDER_REFUND_PROCESSED',
        { userId: adminUserId, userEmail: adminUserEmail },
        { resourceType: 'ORDER', resourceId: orderId },
        {
          refund_type: isFullRefundIntent ? 'full' : 'partial',
          reason: refundInput.reason || 'N/A',
          refunded_amount_this_transaction: calculatedRefundAmount,
          items_restocked_summary: refundedItemsSummary.map(i => ({ name: i.name, sku: i.sku, refunded_qty: i.refunded_qty }))
          // Note: previous_status and previous_payment_status are not easily available here without another DB call or service returning it.
          // The service method itself could log a more detailed audit event if it has access to old/new states.
        },
        req
      ).catch(err => console.error(`Audit log failed for ORDER_REFUND_PROCESSED (ID: ${orderId}):`, err));

      res.status(200).json({
        message: `Order #${orderId} refund processed. Status: ${updatedOrder.status}. Payment Status: ${updatedOrder.payment_status}.`,
        order: updatedOrder
      });

      // Send refund confirmation email
      if (originalOrderDataForEmail.user_email) {
        const emailRefundData = {
          order: { id: originalOrderDataForEmail.id },
          user: { name: originalOrderDataForEmail.user_name || originalOrderDataForEmail.user_email.split('@')[0], email: originalOrderDataForEmail.user_email },
          refund: {
            type: isFullRefundIntent ? 'full' : 'partial',
            reason: refundInput.reason || 'N/A',
            amount_this_transaction: calculatedRefundAmount,
            items_processed: refundedItemsSummary // Already has name, sku, refunded_qty, price_at_purchase
          }
        };
        // Fire and forget email sending
        (async () => {
            try {
                const html = await getRefundConfirmationHtml(emailRefundData);
                const text = getRefundConfirmationText(emailRefundData);
                sendEmail({
                    to: originalOrderDataForEmail.user_email,
                    subject: `Refund Processed for Order #${originalOrderDataForEmail.id}`,
                    text: text,
                    html: html,
                }).then(emailRes => {
                    if(emailRes.success) console.log(`Refund confirmation email sent for order ${originalOrderDataForEmail.id}. Preview: ${emailRes.previewUrl || 'N/A'}`);
                    else console.error(`Failed to send refund email for order ${originalOrderDataForEmail.id}: ${emailRes.error}`);
                }).catch(emailSendError => console.error(`Error in sendEmail promise for refund email (Order ${originalOrderDataForEmail.id}):`, emailSendError));
            } catch (templateError) {
                console.error(`Error generating refund email template for order ${originalOrderDataForEmail.id}:`, templateError);
            }
        })();
      } else {
        console.warn(`No customer email found for order ${orderId}. Skipping refund confirmation email.`);
      }

    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
