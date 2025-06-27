const express = require('express');
const router = express.Router();
// const db = require('../db'); // No longer directly needed in this file
const { isAuthenticated, checkPermission } = require('../auth');
const { body, param, query, validationResult } = require('express-validator');
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/AppError'); // AppError might still be needed for route-level logic if any
const discountService = require('../services/discountService'); // Import the new service

// Apply auth middleware to all routes in this router
// router.use(isAuthenticated, isAdmin); // REMOVED - will apply per route

// const ALLOWED_DISCOUNT_TYPES = ['percentage', 'fixed_amount'];

// Validation Chains
const validateDiscountId = [
  param('id').isInt({ gt: 0 }).withMessage('Discount ID must be a positive integer.').toInt()
];

const validateCreateDiscount = [
  body('code')
    .trim()
    .notEmpty().withMessage('Discount code is required.')
    .isString().withMessage('Discount code must be a string.')
    .isLength({ min: 3, max: 50 }).withMessage('Discount code must be between 3 and 50 characters.'),
  body('type')
    .trim()
    .notEmpty().withMessage('Discount type is required.')
    .toLowerCase()
    .isIn(['percentage', 'fixed_amount']).withMessage("Discount type must be either 'percentage' or 'fixed_amount'."),
  body('value')
    .notEmpty().withMessage('Discount value is required.')
    .isFloat({ gt: 0 }).withMessage('Discount value must be a positive number.')
    .toFloat() // Sanitize to float
    .custom((value, { req }) => {
      if (req.body.type === 'percentage' && (value < 0.01 || value > 100)) { // Check against 0.01 for percentage
        throw new Error('Percentage discount value must be between 0.01 and 100.');
      }
      return true;
    }),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string.')
    .isLength({ max: 255 }).withMessage('Description can be at most 255 characters.')
    .trim(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean.')
    .toBoolean(), // Sanitize to boolean
  body('valid_from')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('valid_from must be a valid ISO8601 date.')
    .toDate(),
  body('valid_until')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('valid_until must be a valid ISO8601 date.')
    .toDate()
    .custom((value, { req }) => {
      if (req.body.valid_from && value && value < req.body.valid_from) { // valid_from is already a Date object due to .toDate()
        throw new Error('valid_until must be after or the same as valid_from.');
      }
      return true;
    }),
  body('usage_limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Usage limit must be a non-negative integer.')
    .toInt(), // Sanitize to int
  body('min_order_amount')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0.00 }).withMessage('Minimum order amount must be a non-negative number.')
    .toFloat() // Sanitize to float
];

const validateUpdateDiscount = [
  body('type')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(['percentage', 'fixed_amount']).withMessage("Discount type must be either 'percentage' or 'fixed_amount'."),
  body('value')
    .optional()
    .isFloat({ gt: 0 }).withMessage('Discount value must be a positive number.')
    .toFloat()
    .custom((value, { req }) => {
      const typeToCheck = req.body.type || (req.currentDiscount ? req.currentDiscount.type : null);
      // This check might be problematic if type is not in req.body and req.currentDiscount is not populated by middleware
      // For robustness, this custom validation might need to be simpler or rely on type being present in body if value is.
      if (typeToCheck === 'percentage' && (value < 0.01 || value > 100)) {
        throw new Error('Percentage discount value must be between 0.01 and 100 if type is percentage.');
      }
      return true;
    }),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string.')
    .isLength({ max: 255 }).withMessage('Description can be at most 255 characters.')
    .trim(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean.')
    .toBoolean(),
  body('valid_from')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('valid_from must be a valid ISO8601 date.')
    .toDate(),
  body('valid_until')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('valid_until must be a valid ISO8601 date.')
    .toDate()
    .custom((value, { req }) => {
      const vFrom = req.body.valid_from || (req.currentDiscount ? req.currentDiscount.valid_from : null);
      // Similar to 'value' validation, this complex custom rule is hard without req.currentDiscount
      // Simplifying for now: if both are provided in body, check them.
      if (req.body.valid_from && value && value < req.body.valid_from) { // req.body.valid_from would be a Date by now
        throw new Error('valid_until must be after or the same as valid_from when both are provided.');
      }
      return true;
    }),
  body('usage_limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Usage limit must be a non-negative integer.')
    .toInt(),
  body('min_order_amount')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0.00 }).withMessage('Minimum order amount must be a non-negative number.')
    .toFloat()
];


// POST /api/admin/discounts - Create a new discount code
router.post('/', isAuthenticated, checkPermission('discounts:manage'), validateCreateDiscount, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Values are already validated and sanitized by express-validator
  const {
    code, type, value, description, is_active, // is_active is boolean due to toBoolean()
    // Values are already validated and sanitized by express-validator
    // is_active is boolean due to toBoolean()
    // valid_from, valid_until are Date objects due to toDate()
  } = req.body; // Destructure all validated fields

  try {
    // discountData directly uses field names from req.body which match service expectations
    const newDiscount = await discountService.createDiscount(req.body);
    res.status(201).json(newDiscount);
  } catch (error) {
    // Service layer errors (ConflictError, BadRequestError, AppError) are passed on
    next(error);
  }
});

// Validation for GET /
const validateListDiscountsParams = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt()
];

// GET /api/admin/discounts - List all discount codes
router.get('/', isAuthenticated, checkPermission('discounts:manage'), validateListDiscountsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // page and limit are validated and defaulted by express-validator middleware
  const { page, limit } = req.query;

  try {
    const result = await discountService.getAllDiscounts({ page, limit });
    res.status(200).json({
        data: result.discounts,
        pagination: {
            total: result.totalDiscounts,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
        }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/discounts/:id - Get a specific discount code
router.get('/:id', isAuthenticated, checkPermission('discounts:manage'), validateDiscountId, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params; // id is validated and sanitized (toInt)

  try {
    const discount = await discountService.getDiscountById(id);
    // Service throws NotFoundError if not found
    res.status(200).json(discount);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/discounts/:id - Update a discount code
router.put('/:id', isAuthenticated, checkPermission('discounts:manage'), validateDiscountId, validateUpdateDiscount, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params; // Validated id
  const updateData = req.body; // Validated and sanitized fields by express-validator

  // Construct an object with only the fields that are actually present in the request body
  // to avoid sending undefined fields to the service layer, which might interpret them.
  const fieldsToUpdate = {};
  const updatableFields = ['type', 'value', 'description', 'is_active', 'valid_from', 'valid_until', 'usage_limit', 'min_order_amount'];

  let hasUpdate = false;
  for (const field of updatableFields) {
    if (updateData.hasOwnProperty(field)) {
      fieldsToUpdate[field] = updateData[field];
      hasUpdate = true;
    }
  }

  if (!hasUpdate) {
    // Although the service might return current data if no fields are updated,
    // it's good practice for the route to respond if no actual update operation is requested.
    // Alternatively, fetch current data here if that's the desired behavior for no-op updates.
    // For now, let's consider it a bad request if no valid fields for update are provided.
    return next(new BadRequestError('No valid fields provided for update.'));
  }

  try {
    const updatedDiscount = await discountService.updateDiscount(id, fieldsToUpdate);
    res.status(200).json(updatedDiscount);
  } catch (error) {
    // Service layer handles NotFoundError, BadRequestError, AppError
    next(error);
  }
});

// DELETE /api/admin/discounts/:id - Delete a discount code
router.delete('/:id', isAuthenticated, checkPermission('discounts:manage'), validateDiscountId, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params; // Validated id

  try {
    const deletedDiscount = await discountService.deleteDiscount(id);
    // Service throws NotFoundError if not found
    res.status(200).json({ message: 'Discount code deleted successfully.', discount: deletedDiscount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
