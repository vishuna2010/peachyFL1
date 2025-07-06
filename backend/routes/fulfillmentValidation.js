const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth');
const { param, body, validationResult } = require('express-validator');
const fulfillmentValidationService = require('../services/fulfillmentValidationService');
const { generateQrCodeDataURL } = require('../services/pdfService');

// Validation middleware
const validateValidationCode = [
  param('validationCode').isLength({ min: 8, max: 8 }).withMessage('Validation code must be exactly 8 characters.')
];

const validateAssignCode = [
  param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt()
];

const validateFulfillmentValidation = [
  param('validationCode').isLength({ min: 8, max: 8 }).withMessage('Validation code must be exactly 8 characters.'),
  body('validationMethod').optional().isIn(['qr_scan', 'manual', 'barcode_scan']).withMessage('Invalid validation method.'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes must be a string with maximum 500 characters.')
];

// GET /api/fulfillment/validate/:validationCode - Public endpoint for QR code validation
router.get(
  '/validate/:validationCode',
  validateValidationCode,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { validationCode } = req.params;

    try {
      // This endpoint is for QR code scanning, so we'll return a simple HTML page
      // that can be used for validation or redirect to a proper validation interface
      
      // First, check if the validation code exists
      const orderResult = await db.query(
        `SELECT o.id, o.status, o.fulfillment_validated_at, o.fulfillment_validation_code,
                u.name as customer_name, u.email as customer_email
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.fulfillment_validation_code = $1`,
        [validationCode]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Invalid Fulfillment Code</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .code { font-family: monospace; font-size: 18px; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>❌ Invalid Fulfillment Code</h1>
            <div class="error">
              <p>The fulfillment code <span class="code">${validationCode}</span> was not found.</p>
              <p>Please check the code and try again.</p>
            </div>
            <p><a href="/admin/fulfillment">Go to Fulfillment Dashboard</a></p>
          </body>
          </html>
        `);
      }

      const order = orderResult.rows[0];

      if (order.fulfillment_validated_at) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Order Already Validated</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .warning { color: #f57c00; background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .success { color: #388e3c; background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .code { font-family: monospace; font-size: 18px; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>✅ Order Already Validated</h1>
            <div class="success">
              <p>Order #<strong>${order.id}</strong> has already been validated for fulfillment.</p>
              <p>Validation Code: <span class="code">${validationCode}</span></p>
              <p>Validated at: ${new Date(order.fulfillment_validated_at).toLocaleString()}</p>
            </div>
            <p><a href="/admin/fulfillment">Go to Fulfillment Dashboard</a></p>
          </body>
          </html>
        `);
      }

      // Return a validation interface
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fulfillment Validation</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .order-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .code { font-family: monospace; font-size: 18px; font-weight: bold; background: #fff; padding: 10px; border-radius: 4px; }
            .btn { background: #4caf50; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            .btn:hover { background: #45a049; }
            .btn:disabled { background: #ccc; cursor: not-allowed; }
            .status { margin: 20px 0; padding: 15px; border-radius: 4px; }
            .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 Fulfillment Validation</h1>
            <p>Scan this QR code to validate order fulfillment</p>
          </div>
          
          <div class="order-info">
            <h3>Order Information</h3>
            <p><strong>Order ID:</strong> #${order.id}</p>
            <p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Validation Code:</strong> <span class="code">${validationCode}</span></p>
          </div>

          <div style="text-align: center;">
            <button class="btn" onclick="validateOrder()" id="validateBtn">✅ Validate Fulfillment</button>
          </div>

          <div id="status"></div>

          <script>
            async function validateOrder() {
              const btn = document.getElementById('validateBtn');
              const status = document.getElementById('status');
              
              btn.disabled = true;
              btn.textContent = 'Validating...';
              
              try {
                const response = await fetch('/api/fulfillment/validate/${validationCode}', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    validationMethod: 'qr_scan'
                  })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  status.innerHTML = '<div class="status success"><h3>✅ Validation Successful!</h3><p>' + result.message + '</p></div>';
                  btn.textContent = 'Validated';
                } else {
                  status.innerHTML = '<div class="status error"><h3>❌ Validation Failed</h3><p>' + (result.message || 'An error occurred') + '</p></div>';
                  btn.disabled = false;
                  btn.textContent = '✅ Validate Fulfillment';
                }
              } catch (error) {
                status.innerHTML = '<div class="status error"><h3>❌ Network Error</h3><p>Please check your connection and try again.</p></div>';
                btn.disabled = false;
                btn.textContent = '✅ Validate Fulfillment';
              }
            }
          </script>
        </body>
        </html>
      `);

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/fulfillment/validate/:validationCode - Validate fulfillment (requires authentication)
router.post(
  '/validate/:validationCode',
  isAuthenticated,
  checkPermission('orders:validate_fulfillment'),
  validateFulfillmentValidation,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { validationCode } = req.params;
    const { validationMethod = 'qr_scan', notes } = req.body;
    const validatedByUserId = req.user.userId;

    try {
      const result = await fulfillmentValidationService.validateFulfillment(
        validationCode,
        validatedByUserId,
        validationMethod,
        notes
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/fulfillment/orders/:orderId/assign-code - Assign validation code to order
router.post(
  '/orders/:orderId/assign-code',
  isAuthenticated,
  checkPermission('orders:manage_fulfillment'),
  validateAssignCode,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;

    try {
      const result = await fulfillmentValidationService.assignFulfillmentValidationCode(orderId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/fulfillment/orders/:orderId/validation-details - Get validation details for an order
router.get(
  '/orders/:orderId/validation-details',
  isAuthenticated,
  checkPermission('orders:view_details'),
  validateAssignCode,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;

    try {
      const result = await fulfillmentValidationService.getFulfillmentValidationDetails(orderId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/fulfillment/validation-logs - Get all validation logs
router.get(
  '/validation-logs',
  isAuthenticated,
  checkPermission('orders:view_details'),
  async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
      const result = await fulfillmentValidationService.getFulfillmentValidationLogs({ page, limit });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/fulfillment/qr-code/:validationCode - Generate QR code for validation
router.get(
  '/qr-code/:validationCode',
  isAuthenticated,
  checkPermission('orders:view_details'),
  validateValidationCode,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { validationCode } = req.params;

    try {
      const qrUrl = fulfillmentValidationService.generateFulfillmentValidationQRUrl(validationCode);
      const qrCodeDataUrl = await generateQrCodeDataURL(qrUrl);
      
      res.status(200).json({
        validation_code: validationCode,
        qr_url: qrUrl,
        qr_code_data_url: qrCodeDataUrl
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/fulfillment/recent-validations - Get recent validations for mobile app
router.get(
  '/recent-validations',
  isAuthenticated,
  checkPermission('orders:validate_fulfillment'),
  async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const validations = await fulfillmentValidationService.getRecentValidations(limit);
      
      res.status(200).json({
        success: true,
        validations: validations
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router; 