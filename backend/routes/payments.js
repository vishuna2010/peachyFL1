const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { BadRequestError, PaymentError } = require('../utils/AppError');
const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');
const { isAuthenticated } = require('../auth');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize payment service
let paymentInitialized = false;

// Middleware to initialize payment service
const initializePaymentService = async (req, res, next) => {
  try {
    if (!paymentInitialized) {
      await paymentService.initialize();
      paymentInitialized = true;
    }
    next();
  } catch (error) {
    logger.error('Error initializing payment service:', error);
    next(error);
  }
};

// Apply initialization middleware to all routes
router.use(initializePaymentService);

/**
 * GET /api/payments/methods
 * Get available payment methods
 */
router.get('/methods', async (req, res, next) => {
  try {
    const methods = paymentService.getAvailablePaymentMethods();
    const publicSettings = paymentService.getPublicSettings();
    
    res.json({
      success: true,
      data: {
        methods,
        currency: publicSettings.general.currency,
        timeout: publicSettings.general.timeoutMinutes
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/settings
 * Get public payment settings (safe to expose to frontend)
 */
router.get('/settings', async (req, res, next) => {
  try {
    const publicSettings = paymentService.getPublicSettings();
    
    res.json({
      success: true,
      data: publicSettings
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/process
 * Process a payment
 */
router.post('/process', [
  body('method').isString().trim().notEmpty().withMessage('Payment method is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('orderId').isString().trim().notEmpty().withMessage('Order ID is required'),
  body('customerData').isObject().withMessage('Customer data is required'),
  body('customerData.email').isEmail().withMessage('Valid email is required'),
  body('customerData.firstName').isString().trim().notEmpty().withMessage('First name is required'),
  body('customerData.lastName').isString().trim().notEmpty().withMessage('Last name is required'),
  body('paymentToken').optional().isObject().withMessage('Payment token must be an object')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const { method, amount, currency, orderId, customerData, paymentToken } = req.body;

    // Validate payment method
    const validation = paymentService.validatePaymentMethod(method);
    if (!validation.valid) {
      throw new BadRequestError(validation.message);
    }

    // Verify order exists and belongs to user
    const order = await orderService.getAdminOrderById(orderId);
    if (!order) {
      throw new BadRequestError('Order not found');
    }

    // Check if user is authorized to pay for this order
    if (req.user && order.user_id !== req.user.id) {
      throw new BadRequestError('Not authorized to pay for this order');
    }

    // Verify amount matches order total
    if (Math.abs(order.total_amount - amount) > 0.01) {
      throw new BadRequestError('Payment amount does not match order total');
    }

    // Get currency from payment settings
    const publicSettings = paymentService.getPublicSettings();
    const paymentCurrency = currency || publicSettings.general.currency || 'USD';

    // Process payment
    const paymentResult = await paymentService.processPayment({
      method,
      amount,
      currency: paymentCurrency,
      orderId,
      customerData,
      paymentToken
    });

    // Update order with payment information
    const updateData = {
      payment_status: paymentResult.status === 'pending' ? 'pending' : 'paid',
      payment_method: method,
      transaction_id: paymentResult.transactionId,
      paid_at: paymentResult.status !== 'pending' ? new Date() : null
    };

    await orderService.updateOrderStatus(orderId, updateData);

    // Log payment
    logger.info(`Payment processed for order ${orderId}: ${method} - ${amount} ${paymentCurrency}`, {
      orderId,
      method,
      amount,
      currency: paymentCurrency,
      transactionId: paymentResult.transactionId,
      status: paymentResult.status
    });

    res.json({
      success: true,
      data: {
        payment: paymentResult,
        order: {
          id: orderId,
          status: updateData.payment_status,
          transactionId: paymentResult.transactionId
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/refund
 * Process a refund
 */
router.post('/refund', [
  isAuthenticated,
  body('orderId').isString().trim().notEmpty().withMessage('Order ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  body('items').optional().isArray().withMessage('Items must be an array')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const { orderId, amount, reason, items } = req.body;

    // Get order
    const order = await orderService.getAdminOrderById(orderId);
    if (!order) {
      throw new BadRequestError('Order not found');
    }

    // Check if order can be refunded
    if (!['paid', 'partially_refunded'].includes(order.payment_status)) {
      throw new BadRequestError(`Order cannot be refunded. Current payment status: ${order.payment_status}`);
    }

    // Verify refund amount
    if (amount > order.total_amount) {
      throw new BadRequestError('Refund amount cannot exceed order total');
    }

    // Process refund through order service (which handles the payment service)
    const refundResult = await orderService.processRefund(orderId, {
      amount,
      reason,
      items,
      processedBy: req.user.id
    });

    res.json({
      success: true,
      data: refundResult
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/status/:orderId
 * Get payment status for an order
 */
router.get('/status/:orderId', [
  param('orderId').isString().trim().notEmpty().withMessage('Order ID is required')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const { orderId } = req.params;

    const order = await orderService.getAdminOrderById(orderId);
    if (!order) {
      throw new BadRequestError('Order not found');
    }

    // Check if user is authorized to view this order
    if (req.user && order.user_id !== req.user.id) {
      throw new BadRequestError('Not authorized to view this order');
    }

    res.json({
      success: true,
      data: {
        orderId,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        transactionId: order.transaction_id,
        amount: order.total_amount,
        paidAt: order.paid_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/webhook/:method
 * Handle payment webhooks
 */
router.post('/webhook/:method', [
  param('method').isIn(['stripe', 'paypal', 'plugnpay']).withMessage('Invalid payment method')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const { method } = req.params;
    const webhookData = req.body;

    logger.info(`Received ${method} webhook:`, webhookData);

    // Handle webhook based on method
    switch (method) {
      case 'stripe':
        await handleStripeWebhook(webhookData);
        break;
      case 'paypal':
        await handlePayPalWebhook(webhookData);
        break;
      case 'plugnpay':
        await handlePlugNPayWebhook(webhookData);
        break;
      default:
        throw new BadRequestError(`Unsupported webhook method: ${method}`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`Webhook error for ${req.params.method}:`, error);
    next(error);
  }
});

/**
 * POST /api/payments/confirm/:orderId
 * Confirm manual payment (COD, Bank Transfer)
 */
router.post('/confirm/:orderId', [
  isAuthenticated,
  param('orderId').isString().trim().notEmpty().withMessage('Order ID is required'),
  body('confirmed').isBoolean().withMessage('Confirmation status is required'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const { orderId } = req.params;
    const { confirmed, notes } = req.body;

    const order = await orderService.getAdminOrderById(orderId);
    if (!order) {
      throw new BadRequestError('Order not found');
    }

    // Check if order requires manual confirmation
    if (!['cod', 'bank_transfer'].includes(order.payment_method)) {
      throw new BadRequestError('Order does not require manual confirmation');
    }

    if (confirmed) {
      // Mark payment as confirmed
      await orderService.updateOrderStatus(orderId, {
        payment_status: 'paid',
        paid_at: new Date()
      });

      logger.info(`Manual payment confirmed for order ${orderId} by user ${req.user.id}`, { notes });
    } else {
      // Mark payment as failed
      await orderService.updateOrderStatus(orderId, {
        payment_status: 'failed'
      });

      logger.info(`Manual payment rejected for order ${orderId} by user ${req.user.id}`, { notes });
    }

    res.json({
      success: true,
      data: {
        orderId,
        confirmed,
        paymentStatus: confirmed ? 'paid' : 'failed'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Webhook handlers
async function handleStripeWebhook(webhookData) {
  const { type, data } = webhookData;

  switch (type) {
    case 'payment_intent.succeeded':
      await handleStripePaymentSuccess(data.object);
      break;
    case 'payment_intent.payment_failed':
      await handleStripePaymentFailure(data.object);
      break;
    case 'charge.refunded':
      await handleStripeRefund(data.object);
      break;
    default:
      logger.info(`Unhandled Stripe webhook type: ${type}`);
  }
}

async function handlePayPalWebhook(webhookData) {
  const { event_type, resource } = webhookData;

  switch (event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      await handlePayPalPaymentSuccess(resource);
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      await handlePayPalPaymentFailure(resource);
      break;
    case 'PAYMENT.CAPTURE.REFUNDED':
      await handlePayPalRefund(resource);
      break;
    default:
      logger.info(`Unhandled PayPal webhook type: ${event_type}`);
  }
}

async function handlePlugNPayWebhook(webhookData) {
  // PlugNPay webhook handling would depend on their specific webhook format
  logger.info('PlugNPay webhook received:', webhookData);
  
  // Extract order ID and status from webhook data
  const orderId = webhookData.x_invoice_num;
  const status = webhookData.x_response_code === '1' ? 'success' : 'failed';
  
  if (orderId) {
    if (status === 'success') {
      await handlePlugNPayPaymentSuccess(webhookData);
    } else {
      await handlePlugNPayPaymentFailure(webhookData);
    }
  }
}

// Payment success/failure handlers
async function handleStripePaymentSuccess(paymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'paid',
      paid_at: new Date()
    });
    logger.info(`Stripe payment succeeded for order ${orderId}`);
  }
}

async function handleStripePaymentFailure(paymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'failed'
    });
    logger.info(`Stripe payment failed for order ${orderId}`);
  }
}

async function handleStripeRefund(refund) {
  const orderId = refund.metadata?.order_id;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'refunded'
    });
    logger.info(`Stripe refund processed for order ${orderId}`);
  }
}

async function handlePayPalPaymentSuccess(capture) {
  const orderId = capture.invoice_id;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'paid',
      paid_at: new Date()
    });
    logger.info(`PayPal payment succeeded for order ${orderId}`);
  }
}

async function handlePayPalPaymentFailure(capture) {
  const orderId = capture.invoice_id;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'failed'
    });
    logger.info(`PayPal payment failed for order ${orderId}`);
  }
}

async function handlePayPalRefund(refund) {
  const orderId = refund.invoice_id;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'refunded'
    });
    logger.info(`PayPal refund processed for order ${orderId}`);
  }
}

async function handlePlugNPayPaymentSuccess(webhookData) {
  const orderId = webhookData.x_invoice_num;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'paid',
      paid_at: new Date()
    });
    logger.info(`PlugNPay payment succeeded for order ${orderId}`);
  }
}

async function handlePlugNPayPaymentFailure(webhookData) {
  const orderId = webhookData.x_invoice_num;
  if (orderId) {
    await orderService.updateOrderStatus(orderId, {
      payment_status: 'failed'
    });
    logger.info(`PlugNPay payment failed for order ${orderId}`);
  }
}

module.exports = router; 