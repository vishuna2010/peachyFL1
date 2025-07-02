const express = require('express');
const router = express.Router();
const taxService = require('../services/taxService'); // Import taxService
const { isAuthenticated, isAdmin } = require('../auth');
const { body, query, param, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError } = require('../utils/AppError');

router.use(isAuthenticated, isAdmin);

// POST / - Create a new tax rate
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Tax rate name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('rate').isNumeric().toFloat() // Changed from rate_percentage
      .custom(value => value >= 0 ).withMessage('Rate must be a non-negative decimal (e.g., 0.07 for 7%).') // Max check removed as it depends on interpretation (0.07 vs 7.0) - service/DB might handle upper bound. Seed stores as decimal.
      .toFloat(), // Ensure it's a float for the service
    // Fields from original seed for tax_rates table:
    body('country').trim().notEmpty().withMessage('Country code is required (e.g., US, GB).').isLength({ min: 2, max: 2 }),
    body('state_province').optional({ nullable: true }).trim().isString().isLength({ max: 100 }),
    body('postal_code').optional({ nullable: true }).trim().isString().isLength({ max: 20 }),
    body('is_compound').optional().isBoolean().toBoolean(),
    body('priority').optional().isInt({ min: 0 }).toInt(),
    body('tax_class_id').isInt({ gt: 0 }).withMessage('Valid Tax Class ID is required.').toInt(),

    // Fields that were in route but not directly in the simplified tax_rates schema from seed.js
    // These are removed for now to align with the seed.js tax_rates table structure.
    // body('jurisdiction').trim().notEmpty().withMessage('Jurisdiction is required.'), // Covered by country/state/postal
    // body('tax_type').trim().notEmpty().withMessage('Tax type is required.'), // Not in tax_rates schema
    // body('tax_code').optional({ nullable: true }).trim().isString().isLength({ max: 50 }).withMessage('Tax code cannot exceed 50 chars.'), // Not in tax_rates schema
    // body('is_active').optional().isBoolean().toBoolean(), // Not in tax_rates schema
    // body('valid_from').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid from must be a valid date (YYYY-MM-DD) or null.'), // Not in tax_rates schema
    // body('valid_until').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid until must be a valid date (YYYY-MM-DD) or null.') // Not in tax_rates schema
    //   .custom((value, { req }) => {
    //     if (value && req.body.valid_from && value < req.body.valid_from) {
    //       throw new Error('Valid until date cannot be before valid from date.');
    //     }
    //     return true;
    //   })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // req.body will now contain 'rate' instead of 'rate_percentage'
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
      // Service now returns 'rate' not 'rate_percentage'
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
    body('rate').optional().isNumeric().toFloat() // Changed from rate_percentage
      .custom(value => value >= 0).withMessage('Rate must be a non-negative decimal.')
      .toFloat(),
    // Fields from original seed for tax_rates table:
    body('country').optional().trim().notEmpty().withMessage('Country code cannot be empty if provided.').isLength({ min: 2, max: 2 }),
    body('state_province').optional({ nullable: true, checkFalsy: true }).trim().isString().isLength({ max: 100 }),
    body('postal_code').optional({ nullable: true, checkFalsy: true }).trim().isString().isLength({ max: 20 }),
    body('is_compound').optional().isBoolean().toBoolean(),
    body('priority').optional().isInt({ min: 0 }).toInt(),
    body('tax_class_id').optional().isInt({ gt: 0 }).withMessage('Valid Tax Class ID is required if provided.').toInt(),

    // Fields removed to align with seed.js tax_rates table structure for this PUT
    // body('jurisdiction').optional().trim().notEmpty().withMessage('Jurisdiction cannot be empty if provided.'),
    // body('tax_type').optional().trim().notEmpty().withMessage('Tax type cannot be empty if provided.'),
    // body('tax_code').optional({ checkFalsy: true }).trim().isString().isLength({ max: 50 }).withMessage('Tax code cannot exceed 50 chars if provided.'),
    // body('is_active').optional().isBoolean().toBoolean(),
    // body('valid_from').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid from must be a valid date (YYYY-MM-DD) or null.'),
    // body('valid_until').optional({ nullable: true }).isISO8601().toDate().withMessage('Valid until must be a valid date (YYYY-MM-DD) or null.')
    //   .custom((value, { req }) => {
    //     const validFromInBody = req.body.valid_from;
    //     if (validFromInBody && value && value < validFromInBody) {
    //       throw new Error('Valid until date cannot be before valid from date when both are provided.');
    //     }
    //     return true;
    //   })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      // req.body will now contain 'rate' if provided, not 'rate_percentage'
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
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(), // Max limit reduced for sanity
    query('tax_class_id').optional().isInt({gt: 0}).toInt(),
    query('country').optional().isString().trim().isLength({min:2, max:2}),
    query('sortBy').optional().isString().trim().isIn(['name', 'rate', 'country', 'tax_class_name']).default('name'),
    query('sortOrder').optional().isString().trim().toUpperCase().isIn(['ASC', 'DESC']).default('ASC')
    // Removed is_active, tax_type, jurisdiction filters as they are not in tax_rates schema in seed.js
    // or are covered by country/state/postal.
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page, limit, tax_class_id, country, sortBy, sortOrder } = req.query;

    const filterOptions = { tax_class_id, country };
    Object.keys(filterOptions).forEach(key => filterOptions[key] === undefined && delete filterOptions[key]);

    const paginationOptions = { page, limit, sortBy, sortOrder };
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
