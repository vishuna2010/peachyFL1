const express = require('express');
const router = express.Router();
const db = require('../db');

const ALLOWED_DISCOUNT_TYPES = ['percentage', 'fixed_amount']; // Could be shared from a constants file

const discountService = require('../services/discountService'); // Import discountService
const { body, validationResult } = require('express-validator'); // For validation

// POST /api/cart/validate-discount - Validate a discount code against a cart subtotal
router.post(
  '/validate-discount',
  [
    body('discount_code').trim().notEmpty().withMessage('Discount code is required.'),
    body('cart_subtotal').isFloat({ gt: -0.000001 }).withMessage('Valid cart_subtotal (non-negative number) is required.').toFloat()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { discount_code, cart_subtotal } = req.body;

    try {
      const validationResult = await discountService.validateDiscountForCart(discount_code, cart_subtotal);
      // The service now returns a more structured object, including a generic 'message'.
      // We can keep the route's message or use the service's.
      // For consistency, let's use a standard success message here and let service provide details.
      res.status(200).json({
        ...validationResult, // Spread all details from service
        message: 'Discount code validation successful.' // Override or use service's message
      });
    } catch (error) {
      // Service will throw NotFoundError or BadRequestError for known validation issues,
      // or AppError for other issues. Pass to global error handler.
      next(error);
    }
  }
);

const taxService = require('../services/taxService');
const userService = require('../services/userService'); // Import userService
const { NotFoundError, BadRequestError } = require('../utils/AppError');

// POST /api/cart/calculate-taxes - Calculate taxes for a given cart
router.post(
  '/calculate-taxes',
  // Removed temporary logging middleware
  [ // Basic validation for cartItems and optional userId/shippingAddress
    body('cartItems').isArray({ min: 1 }).withMessage('Cart items must be a non-empty array.'),
    body('cartItems.*.productId').isInt({ gt: 0 }).withMessage('Each cart item must have a valid productId.'),
    body('cartItems.*.quantity').isInt({ gt: 0 }).withMessage('Each cart item must have a positive quantity.'),
    body('cartItems.*.price').isFloat({ gt: -0.000001 }).withMessage('Each cart item must have a valid price.').toFloat(),
    body('cartItems.*.variantId').optional().isInt({ gt: 0 }).withMessage('variantId must be a positive integer if provided.'),
    body('userId').optional().isInt({ gt: 0 }).withMessage('userId must be a positive integer if provided.'),
    body('shippingAddress').optional().isObject().withMessage('shippingAddress must be an object if provided.'),
    body('shippingAddress.country').optional().isString().notEmpty().withMessage('shippingAddress.country is required if address is provided.'),
    // Add more specific address field validations as needed by taxService
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cartItems, userId, shippingAddress } = req.body;

    let userIsTaxExempt = false;
    let addressForTaxCalculation = {};
    // db client is now managed by individual service calls or not needed if services use default pool for reads.
    // For taxService.calculateTaxForCartItems, if it needs to run within a larger transaction (like order creation),
    // a client should be passed. For standalone cart tax calculation, it can manage its own.
    // userService.getUserTaxContext also takes an optional client.

    try {
      if (userId) {
        const userTaxContext = await userService.getUserTaxContext(userId); // client can be passed if needed
        if (userTaxContext) {
          userIsTaxExempt = userTaxContext.userIsTaxExempt;
          if (!shippingAddress || !shippingAddress.country) { // Use user's default address if no specific one provided
            addressForTaxCalculation = userTaxContext.defaultAddress || {};
          }
        } else {
          console.warn(`User ID ${userId} provided for tax calculation but not found by userService.`);
          // Proceed as guest, userIsTaxExempt remains false
        }
      }

      // If shippingAddress is explicitly provided in the request, it overrides user's default
      if (shippingAddress && shippingAddress.country) {
        addressForTaxCalculation = {
          country: shippingAddress.country,
          state_province: shippingAddress.state_province || null,
        };
      } else if (!addressForTaxCalculation.country && !userId) {
        // No userId to fetch default address, and no shippingAddress provided
        return next(new BadRequestError('Shipping address (country) is required to calculate taxes for guest users or if user has no default address.'));
      }

      // If after all checks, we still don't have a country, we cannot proceed (unless taxService handles default/no tax)
      if (!addressForTaxCalculation.country) {
          // This case might occur if a logged-in user has no default address and no shippingAddress was passed.
          // Depending on business rules, either error out or default to no tax / specific jurisdiction.
          // For now, let's assume taxService can handle it or will throw if jurisdiction is indeterminable.
          console.warn(`[CartRoutes /calculate-taxes] Could not determine country for tax calculation. UserID: ${userId}. Proceeding, taxService might apply default or no tax.`);
      }


      const itemsForTaxCalc = cartItems.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        unit_price: item.price
      }));

      // Assuming taxService.calculateTaxForCartItems can manage its own DB connection if not part of a larger transaction
      const taxCalculationResult = await taxService.calculateTaxForCartItems(
        itemsForTaxCalc,
        userId || null,
        addressForTaxCalculation,
        userIsTaxExempt
        // No client passed here, taxService will use its default db pool connection for product lookups.
      );

      res.status(200).json(taxCalculationResult);

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
