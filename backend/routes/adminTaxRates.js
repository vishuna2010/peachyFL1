const express = require('express');
const router = express.Router();
const taxService = require('../services/taxService'); // Import taxService
const { isAuthenticated, isAdmin } = require('../auth');
const { body, query, param, validationResult } = require('express-validator');
// Removed db import and specific error types from utils/AppError as service handles them

router.use(isAuthenticated, isAdmin);

// POST / - Create a new tax rate
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Tax rate name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('rate_percentage').isNumeric().toFloat()
      .custom(value => value >= 0 && value <= 1).withMessage('Rate percentage must be a decimal between 0.0000 and 1.0000 (e.g., 0.07 for 7%).'),
    body('jurisdiction').trim().notEmpty().withMessage('Jurisdiction is required.'),
    body('tax_type').trim().notEmpty().withMessage('Tax type is required.'),
    body('tax_code').optional({ nullable: true }).trim().isString().isLength({ max: 50 }).withMessage('Tax code cannot exceed 50 chars.'),
    body('is_active').optional().isBoolean().toBoolean(),
    body('valid_from').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid from must be a valid date (YYYY-MM-DD) or null.'),
    body('valid_until').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid until must be a valid date (YYYY-MM-DD) or null.')
      .custom((value, { req }) => {
        if (value && req.body.valid_from && value < req.body.valid_from) { // Dates are already Date objects here due to .toDate()
          throw new Error('Valid until date cannot be before valid from date.');
        }
        return true;
      })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const newTaxRate = await taxService.createTaxRate(req.body);
      res.status(201).json(newTaxRate);
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get a specific tax rate
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      const taxRate = await taxService.getTaxRateById(id);
      res.status(200).json(taxRate);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update an existing tax rate
router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).toInt(),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty if provided.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('rate_percentage').optional().isNumeric().toFloat()
      .custom(value => value >= 0 && value <= 1).withMessage('Rate percentage must be a decimal between 0.0000 and 1.0000.'),
    body('jurisdiction').optional().trim().notEmpty().withMessage('Jurisdiction cannot be empty if provided.'),
    body('tax_type').optional().trim().notEmpty().withMessage('Tax type cannot be empty if provided.'),
    body('tax_code').optional({ checkFalsy: true }).trim().isString().isLength({ max: 50 }).withMessage('Tax code cannot exceed 50 chars if provided.'),
    body('is_active').optional().isBoolean().toBoolean(),
    body('valid_from').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid from must be a valid date (YYYY-MM-DD) or null.'),
    body('valid_until').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid until must be a valid date (YYYY-MM-DD) or null.')
      .custom((value, { req }) => {
        const validFromInBody = req.body.valid_from; // Already a Date object or null
        if (validFromInBody && value && value < validFromInBody) {
          throw new Error('Valid until date cannot be before valid from date when both are provided.');
        }
        return true;
      })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      const updatedTaxRate = await taxService.updateTaxRate(id, req.body);
      res.status(200).json(updatedTaxRate);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id - Delete a tax rate
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      const deletedRate = await taxService.deleteTaxRate(id);
      res.status(200).json({ message: 'Tax rate deleted successfully.', deletedRate });
    } catch (error) {
      next(error);
    }
  }
);

// GET / - List all tax rates (paginated and filterable)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('is_active').optional().isBoolean().toBoolean(),
    query('tax_type').optional().trim().isString(),
    query('jurisdiction').optional().trim().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Extract validated/sanitized values. Defaults are handled by service or can be applied here if preferred.
    const { page, limit, is_active, tax_type, jurisdiction } = req.query;

    const filterOptions = { is_active, tax_type, jurisdiction };
    // Remove undefined keys from filterOptions so service defaults apply cleanly
    Object.keys(filterOptions).forEach(key => filterOptions[key] === undefined && delete filterOptions[key]);

    const paginationOptions = { page, limit };
    Object.keys(paginationOptions).forEach(key => paginationOptions[key] === undefined && delete paginationOptions[key]);

    try {
      const result = await taxService.getAllTaxRates(filterOptions, paginationOptions);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
