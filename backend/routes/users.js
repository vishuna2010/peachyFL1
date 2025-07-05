const express = require('express');
const router = express.Router();
const authService = require('../auth'); // For isAuthenticated middleware
const userService = require('../services/userService'); // Import userService
const orderService = require('../services/orderService'); // Import orderService
const addressService = require('../services/addressService'); // Import addressService
const { body, query, param, validationResult } = require('express-validator');
// Removed db import, specific error types will be handled by global error handler via next(error)

// GET /api/users/me - Get current user's profile
router.get(
  '/me',
  authService.isAuthenticated,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const user = await userService.getUserById(userId);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/users/me/profile - Update current user's profile
router.put(
  '/me/profile',
  authService.isAuthenticated,
  [
    // Validation ensures 'name' if provided, meets criteria.
    // The service will also validate if 'name' is empty after trim if it's the only field.
    body('name').optional().isString().trim()
      .notEmpty().withMessage('Name cannot be an empty string if provided.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters if provided.'),
    // Add other updatable fields here with their own validation if needed in the future
  ],
  async (req, res, next) => { // Added next parameter
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const profileData = req.body; // Pass the whole body, service will pick relevant fields

    // A preliminary check: if body is empty or only contains non-updatable fields (currently only 'name' is updatable by user)
    // The service will perform a more specific check if 'name' is missing or invalid.
    if (Object.keys(profileData).length === 0 || (profileData.name === undefined && Object.keys(profileData).length === 1 && profileData.hasOwnProperty('name_is_not_the_only_key_check'))) {
        // A more robust check if other fields were possible:
        // const updatableFieldsInRequest = Object.keys(profileData).filter(key => ['name', 'other_field'].includes(key));
        // if (updatableFieldsInRequest.length === 0) { ... }
      if (profileData.name === undefined) { // Simplified: if 'name' is not in body and no other fields are updatable yet.
        return res.status(400).json({ message: 'No profile data provided for update.' });
      }
    }

    try {
      const updatedUser = await userService.updateUserProfile(userId, profileData);
      res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });
    } catch (error) {
      // Service function will throw AppError instances (NotFoundError, BadRequestError, etc.)
      next(error); // Pass to global error handler
    }
  }
);

// GET /api/users/me/orders - Get current user's order history
router.get(
  '/me/orders',
  authService.isAuthenticated,
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt().default(10),
    query('status').optional().isString().trim(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const { page, limit, status } = req.query;
      const orderHistory = await orderService.getUserOrderHistory(userId, { page, limit, status });
      res.status(200).json(orderHistory);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/me/orders/:orderId - Get specific order details for current user
router.get(
  '/me/orders/:orderId',
  authService.isAuthenticated,
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const orderId = req.params.orderId;
      const orderDetails = await orderService.getUserOrderDetails(userId, orderId);
      res.status(200).json({ order: orderDetails });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/me/orders/:orderId/invoice - Download invoice for specific order
router.get(
  '/me/orders/:orderId/invoice',
  authService.isAuthenticated,
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const orderId = req.params.orderId;
      
      // First verify the order belongs to the user
      const orderDetails = await orderService.getUserOrderDetails(userId, orderId);
      
      // Generate invoice PDF
      const pdfService = require('../services/pdfService');
      const invoiceData = await orderService.getOrderDetailsForPdf(orderId, 'invoice');
      const pdfBuffer = await pdfService.generateOrderInvoicePdf(invoiceData);
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-Order-${orderId}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/me/dashboard - Get user dashboard summary
router.get(
  '/me/dashboard',
  authService.isAuthenticated,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      // Get user profile
      const user = await userService.getUserById(userId);
      
      // Get recent orders (last 5)
      const recentOrders = await orderService.getUserOrderHistory(userId, { page: 1, limit: 5 });
      
      // Get default shipping address
      const defaultAddress = await addressService.getDefaultShippingAddress(userId);
      
      // Get order statistics
      const orderStats = await orderService.getUserOrderStats(userId);
      
      const dashboard = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role_name || user.role,
          created_at: user.created_at,
          two_factor_enabled: user.is_two_fa_enabled || false
        },
        recent_orders: recentOrders.data,
        default_shipping_address: defaultAddress,
        order_statistics: orderStats
      };
      
      res.status(200).json({ dashboard });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/me/addresses - Get current user's addresses
router.get(
  '/me/addresses',
  authService.isAuthenticated,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const addresses = await addressService.getUserAddresses(userId);
      res.status(200).json({ addresses });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/users/me/addresses - Create a new address for current user
router.post(
  '/me/addresses',
  authService.isAuthenticated,
  [
    body('first_name').trim().notEmpty().withMessage('First name is required.').isLength({ min: 1, max: 255 }).withMessage('First name must be between 1 and 255 characters.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.').isLength({ min: 1, max: 255 }).withMessage('Last name must be between 1 and 255 characters.'),
    body('address_line1').trim().notEmpty().withMessage('Address line 1 is required.').isLength({ min: 1, max: 255 }).withMessage('Address line 1 must be between 1 and 255 characters.'),
    body('city').trim().notEmpty().withMessage('City is required.').isLength({ min: 1, max: 100 }).withMessage('City must be between 1 and 100 characters.'),
    body('state_province').trim().notEmpty().withMessage('State/province is required.').isLength({ min: 1, max: 100 }).withMessage('State/province must be between 1 and 100 characters.'),
    body('postal_code').trim().notEmpty().withMessage('Postal code is required.').isLength({ min: 1, max: 20 }).withMessage('Postal code must be between 1 and 20 characters.'),
    body('country').trim().notEmpty().withMessage('Country is required.').isLength({ min: 2, max: 2 }).withMessage('Country must be a 2-letter country code.'),
    body('company').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Company must be 255 characters or less.'),
    body('address_line2').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Address line 2 must be 255 characters or less.'),
    body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less.'),
    body('address_type').optional().isIn(['shipping', 'billing']).withMessage('Address type must be either "shipping" or "billing".'),
    body('is_default').optional().isBoolean().withMessage('is_default must be a boolean.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const address = await addressService.createAddress(userId, req.body);
      res.status(201).json({ address });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/users/me/addresses/:id - Update an address for current user
router.put(
  '/me/addresses/:id',
  authService.isAuthenticated,
  [
    param('id').isInt({ gt: 0 }).withMessage('Address ID must be a positive integer.').toInt(),
    body('first_name').trim().notEmpty().withMessage('First name is required.').isLength({ min: 1, max: 255 }).withMessage('First name must be between 1 and 255 characters.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.').isLength({ min: 1, max: 255 }).withMessage('Last name must be between 1 and 255 characters.'),
    body('address_line1').trim().notEmpty().withMessage('Address line 1 is required.').isLength({ min: 1, max: 255 }).withMessage('Address line 1 must be between 1 and 255 characters.'),
    body('city').trim().notEmpty().withMessage('City is required.').isLength({ min: 1, max: 100 }).withMessage('City must be between 1 and 100 characters.'),
    body('state_province').trim().notEmpty().withMessage('State/province is required.').isLength({ min: 1, max: 100 }).withMessage('State/province must be between 1 and 100 characters.'),
    body('postal_code').trim().notEmpty().withMessage('Postal code is required.').isLength({ min: 1, max: 20 }).withMessage('Postal code must be between 1 and 20 characters.'),
    body('country').trim().notEmpty().withMessage('Country is required.').isLength({ min: 2, max: 2 }).withMessage('Country must be a 2-letter country code.'),
    body('company').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Company must be 255 characters or less.'),
    body('address_line2').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Address line 2 must be 255 characters or less.'),
    body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less.'),
    body('address_type').optional().isIn(['shipping', 'billing']).withMessage('Address type must be either "shipping" or "billing".'),
    body('is_default').optional().isBoolean().withMessage('is_default must be a boolean.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const addressId = req.params.id;
      const address = await addressService.updateAddress(addressId, userId, req.body);
      res.status(200).json({ address });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/users/me/addresses/:id - Delete an address for current user
router.delete(
  '/me/addresses/:id',
  authService.isAuthenticated,
  [
    param('id').isInt({ gt: 0 }).withMessage('Address ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const addressId = req.params.id;
      const address = await addressService.deleteAddress(addressId, userId);
      res.status(200).json({ message: 'Address deleted successfully.', address });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/users/me/2fa/setup - Setup 2FA for current user
router.post(
  '/me/2fa/setup',
  authService.isAuthenticated,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      // Check if 2FA is already enabled for the user
      const user = await userService.getUserById(userId);
      if (user.is_two_fa_enabled) {
        return res.status(400).json({ 
          success: false, 
          message: '2FA is already enabled for this account. Please disable it first if you want to re-setup.' 
        });
      }
      
      // Generate 2FA secret and QR code
      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({
        name: `PeachyFL (${user.email})`,
        issuer: 'PeachyFL'
      });
      
      const otpAuthUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: user.email,
        issuer: 'PeachyFL',
        algorithm: 'sha1'
      });
      
      res.status(200).json({
        success: true,
        secret: secret.base32,
        otpAuthUrl: otpAuthUrl
      });
    } catch (error) {
      console.error('Error during 2FA setup process:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to start 2FA setup process.', 
        error: error.message 
      });
    }
  }
);

// POST /api/users/me/2fa/verify - Verify TOTP token and enable 2FA
router.post(
  '/me/2fa/verify',
  authService.isAuthenticated,
  [
    body('token').isString().trim().isLength({ min: 6, max: 6 }).withMessage('Token must be exactly 6 characters.'),
    body('secret').isString().trim().notEmpty().withMessage('Secret is required for verification.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const { token, secret } = req.body;
      
      if (!secret || secret.length < 16) {
        return res.status(400).json({ 
          success: false, 
          message: 'A valid 2FA secret is required for verification.' 
        });
      }
      
      // Verify the TOTP token
      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps in case of slight time differences
      });
      
      if (!verified) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid 2FA code. Please try again.' 
        });
      }
      
      // Enable 2FA for the user
      const db = require('../db');
      const result = await db.query(
        'UPDATE users SET two_fa_secret = $1, is_two_fa_enabled = TRUE WHERE id = $2',
        [secret, userId]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found for enabling 2FA.' 
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: '2FA enabled successfully.' 
      });
    } catch (error) {
      console.error('Error during 2FA verification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to verify 2FA token.', 
        error: error.message 
      });
    }
  }
);

module.exports = router;
