const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, param, query, validationResult } = require('express-validator'); // Added query
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/AppError'); // Assuming AppError.js exports these

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// const ALLOWED_DISCOUNT_TYPES = ['percentage', 'fixed_amount']; // Already used in validation chain

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
router.post('/', validateCreateDiscount, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Values are already validated and sanitized by express-validator
  const {
    code, type, value, description, is_active, // is_active is boolean due to toBoolean()
    valid_from, valid_until, // these are Date objects due to toDate()
    usage_limit, min_order_amount
  } = req.body;

  const client = await db.pool.connect();
  try {
    // Check for code uniqueness (case-insensitive for robustness, DB constraint is case-sensitive)
    // The DB constraint will enforce actual uniqueness. This is a pre-check.
    const existingCode = await client.query('SELECT id FROM discounts WHERE code = $1', [code.toUpperCase()]);
    if (existingCode.rows.length > 0) {
        return next(new ConflictError('Discount code already exists.'));
    }

    const insertQuery = `
      INSERT INTO discounts
        (code, type, value, description, is_active, valid_from, valid_until, usage_limit, min_order_amount, updated_at, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const queryValues = [
      code.toUpperCase(), // Store codes in uppercase for consistency
      type, // Already toLowerCase() by validator
      value, // Already toFloat() by validator
      description, // Optional, trim handled
      is_active === undefined ? true : is_active, // Default if not provided
      valid_from, // Date object or null
      valid_until, // Date object or null
      usage_limit, // Integer or null
      min_order_amount, // Float or null
    ];

    const result = await client.query(insertQuery, queryValues);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (e.g., code already exists)
      return next(new ConflictError('Discount code already exists (database constraint).'));
    }
    console.error('Error creating discount code:', error);
    next(error); // Pass to global error handler
  } finally {
    client.release();
  }
});

// Validation for GET /
const validateListDiscountsParams = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt()
];

// GET /api/admin/discounts - List all discount codes
router.get('/', validateListDiscountsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const page = req.query.page || 1; // Default if optional and not provided
  const limit = req.query.limit || 20; // Default if optional and not provided
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM discounts');
    const totalDiscounts = parseInt(countResult.rows[0].count);

    const result = await db.query('SELECT * FROM discounts ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.status(200).json({
        data: result.rows,
        pagination: {
            total: totalDiscounts,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalDiscounts / limit)
        }
    });
  } catch (error) {
    console.error('Error listing discount codes:', error);
    next(error);
  }
});

// GET /api/admin/discounts/:id - Get a specific discount code
router.get('/:id', validateDiscountId, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params; // id is validated and sanitized (toInt)

  try {
    const result = await db.query('SELECT * FROM discounts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Discount code with ID ${id} not found.`);
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching discount code ${id}:`, error);
    next(error);
  }
});

// PUT /api/admin/discounts/:id - Update a discount code
router.put('/:id', validateDiscountId, validateUpdateDiscount, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params; // Validated id
  const updates = req.body; // Validated and sanitized fields

  // Check if there's anything to update
  const updatableFields = ['type', 'value', 'description', 'is_active', 'valid_from', 'valid_until', 'usage_limit', 'min_order_amount'];
  const providedUpdates = updatableFields.filter(field => updates[field] !== undefined);
  if (providedUpdates.length === 0) {
    return next(new BadRequestError('No fields provided for update.'));
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Fetch current discount to compare for complex validations if needed (e.g. valid_until vs existing valid_from)
    // And to return if no actual change is made.
    const currentDiscountResult = await client.query('SELECT * FROM discounts WHERE id = $1 FOR UPDATE', [id]);
    if (currentDiscountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Discount code with ID ${id} not found.`);
    }
    // req.currentDiscount = currentDiscountResult.rows[0]; // Make available to custom validators if they were more complex

    // More robust valid_until check against current or new valid_from
    let finalValidFrom = updates.valid_from !== undefined ? updates.valid_from : currentDiscountResult.rows[0].valid_from;
    if (updates.valid_until !== undefined && finalValidFrom && updates.valid_until < finalValidFrom) {
        await client.query('ROLLBACK');
        throw new BadRequestError('valid_until must be after or the same as valid_from.');
    }
    // More robust value check if type is not in req.body but value is.
    if (updates.value !== undefined && updates.type === undefined && currentDiscountResult.rows[0].type === 'percentage') {
        if (updates.value < 0.01 || updates.value > 100) {
             await client.query('ROLLBACK');
             throw new Error('Percentage discount value must be between 0.01 and 100.');
        }
    }


    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const field of providedUpdates) {
        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(updates[field]);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `UPDATE discounts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const result = await client.query(updateQuery, values);

    await client.query('COMMIT');
    res.status(200).json(result.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error updating discount code ${id}:`, error);
    // Note: Unique constraint on 'code' is not an issue here as 'code' is not updatable.
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/admin/discounts/:id - Delete a discount code
router.delete('/:id', validateDiscountId, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params; // Validated id

  try {
    const result = await db.query('DELETE FROM discounts WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      throw new NotFoundError(`Discount code with ID ${id} not found.`);
    }
    res.status(200).json({ message: 'Discount code deleted successfully.', discount: result.rows[0] });
  } catch (error) {
    console.error(`Error deleting discount code ${id}:`, error);
    next(error);
  }
});

module.exports = router;
