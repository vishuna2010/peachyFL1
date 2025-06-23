const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, query, param, validationResult } = require('express-validator'); // param might be needed for PUT/DELETE later
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/AppError');

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
    body('valid_from').optional({ nullable: true }).isDate().withMessage('Valid from must be a valid date (YYYY-MM-DD) or null.'),
    body('valid_until').optional({ nullable: true }).isDate().withMessage('Valid until must be a valid date (YYYY-MM-DD) or null.')
      .custom((value, { req }) => {
        if (value && req.body.valid_from && new Date(value) < new Date(req.body.valid_from)) {
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

    const { name, rate_percentage, jurisdiction, tax_type, tax_code, is_active, valid_from, valid_until } = req.body;

    try {
      const existingRate = await db.query('SELECT id FROM tax_rates WHERE LOWER(name) = LOWER($1)', [name]);
      if (existingRate.rows.length > 0) {
        return next(new ConflictError('A tax rate with this name already exists.'));
      }

      const result = await db.query(
        `INSERT INTO tax_rates (name, rate_percentage, jurisdiction, tax_type, tax_code, is_active, valid_from, valid_until, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) RETURNING *`,
        [
          name, rate_percentage, jurisdiction, tax_type, tax_code || null,
          is_active === undefined ? true : is_active, // Default is_active to true if not provided
          valid_from || null,
          valid_until || null
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation for name (DB constraint)
        return next(new ConflictError('A tax rate with this name already exists (database constraint).'));
      }
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
      const result = await db.query('SELECT * FROM tax_rates WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        throw new NotFoundError(`Tax rate with ID ${id} not found.`);
      }
      res.status(200).json(result.rows[0]);
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
    body('tax_code').optional({ nullable: true }).trim().isString().isLength({ max: 50 }).withMessage('Tax code cannot exceed 50 chars if provided.'),
    body('is_active').optional().isBoolean().toBoolean(),
    body('valid_from').optional({ nullable: true }).isDate().withMessage('Valid from must be a valid date (YYYY-MM-DD) or null.'),
    body('valid_until').optional({ nullable: true }).isDate().withMessage('Valid until must be a valid date (YYYY-MM-DD) or null.')
      // Custom validator for valid_until against valid_from only if both are provided in the request.
      // More robust check against DB state is done in the handler.
      .custom((value, { req }) => {
        if (req.body.valid_from && value && new Date(value) < new Date(req.body.valid_from)) {
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
    const updates = req.body;

    // Check if at least one updatable field is provided
    const updatableFields = ['name', 'rate_percentage', 'jurisdiction', 'tax_type', 'tax_code', 'is_active', 'valid_from', 'valid_until'];
    const hasUpdates = updatableFields.some(field => updates[field] !== undefined);
    if (!hasUpdates) {
      return next(new BadRequestError('No fields provided for update.'));
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentRateResult = await client.query('SELECT * FROM tax_rates WHERE id = $1 FOR UPDATE', [id]);
      if (currentRateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new NotFoundError(`Tax rate with ID ${id} not found.`);
      }
      const currentRate = currentRateResult.rows[0];

      // Validate valid_until against valid_from (considering existing and new values)
      let finalValidFrom = updates.valid_from !== undefined ? (updates.valid_from ? new Date(updates.valid_from) : null) : (currentRate.valid_from ? new Date(currentRate.valid_from) : null);
      let finalValidUntil = updates.valid_until !== undefined ? (updates.valid_until ? new Date(updates.valid_until) : null) : (currentRate.valid_until ? new Date(currentRate.valid_until) : null);

      if (finalValidFrom && finalValidUntil && finalValidUntil < finalValidFrom) {
        await client.query('ROLLBACK');
        throw new BadRequestError('Valid until date cannot be before valid from date.');
      }

      // Name uniqueness check if name is being updated
      if (updates.name && updates.name !== currentRate.name) {
        const existingRate = await client.query('SELECT id FROM tax_rates WHERE LOWER(name) = LOWER($1) AND id != $2', [updates.name, id]);
        if (existingRate.rows.length > 0) {
          await client.query('ROLLBACK');
          throw new ConflictError('Another tax rate with this name already exists.');
        }
      }

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      updatableFields.forEach(field => {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = $${paramIndex++}`);
          // Ensure null is passed correctly for date fields if cleared
          if ((field === 'valid_from' || field === 'valid_until' || field === 'tax_code') && updates[field] === null) {
            values.push(null);
          } else {
            values.push(updates[field]);
          }
        }
      });

      if (setClauses.length === 0) { // Should be caught by hasUpdates earlier, but as a safeguard
        await client.query('ROLLBACK');
        return res.status(200).json(currentRate); // No actual changes detected or applied
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id); // For WHERE id = $N

      const updateQuery = `UPDATE tax_rates SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
      const result = await client.query(updateQuery, values);

      await client.query('COMMIT');
      res.status(200).json(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'uq_tax_rate_name') { // Check specific constraint for name
        return next(new ConflictError('Another tax rate with this name already exists (database constraint).'));
      }
      next(error);
    } finally {
      client.release();
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
      const result = await db.query('DELETE FROM tax_rates WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        throw new NotFoundError(`Tax rate with ID ${id} not found.`);
      }
      res.status(200).json({ message: 'Tax rate deleted successfully.', deletedRate: result.rows[0] });
      // Alternative: res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// GET / - List all tax rates (paginated and filterable)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt().default(10), // max is now 1000
    query('is_active').optional().isBoolean().toBoolean(),
    query('tax_type').optional().trim().isString(),
    query('jurisdiction').optional().trim().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // req.query contains values processed by express-validator (toInt, toBoolean, default)
    let page = req.query.page;
    let limit = req.query.limit;
    const { is_active, tax_type, jurisdiction } = req.query;

    // Explicitly ensure page and limit are numbers and fall back to defaults if necessary,
    // even after express-validator, to prevent NaN issues.
    // express-validator's .default() applies if the param is missing.
    // .toInt() converts valid numbers. If a param is present but empty (e.g., ?page=),
    // toInt() might result in NaN if not caught by isInt() first.
    // A simple parseInt with a fallback is a robust final check.

    page = parseInt(page, 10);
    if (isNaN(page) || page < 1) {
      page = 1; // Default page
    }

    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit < 1) {
      limit = 10; // Default limit
    }
    limit = Math.min(limit, 1000); // Ensure limit does not exceed max defined in validator

    const offset = (page - 1) * limit;

    const queryParams = [];
    const whereClauses = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      whereClauses.push(`is_active = $${paramIndex++}`);
      queryParams.push(is_active);
    }
    if (tax_type) {
      whereClauses.push(`LOWER(tax_type) = LOWER($${paramIndex++})`);
      queryParams.push(tax_type);
    }
    if (jurisdiction) {
      // Using ILIKE for partial match on jurisdiction might be more user-friendly
      // whereClauses.push(`jurisdiction ILIKE $${paramIndex++}`);
      // queryParams.push(`%${jurisdiction}%`);
      // For exact match (case-insensitive):
      whereClauses.push(`LOWER(jurisdiction) = LOWER($${paramIndex++})`);
      queryParams.push(jurisdiction);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const dataQuery = `
        SELECT
          id, name, rate_percentage, jurisdiction, tax_type, tax_code,
          is_active, priority, valid_from, valid_until, created_at, updated_at
        FROM tax_rates
        ${whereString}
        ORDER BY name ASC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
      const dataParams = [...queryParams, limit, offset];
      const dataResult = await db.query(dataQuery, dataParams);

      const countQuery = `SELECT COUNT(*) FROM tax_rates ${whereString};`;
      // For count query, params are only the filter params
      const countParams = queryParams.slice(0, paramIndex - 2); // Exclude limit and offset params
      const countResult = await db.query(countQuery, countParams);

      const totalRecords = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalRecords / limit);

      res.status(200).json({
        data: dataResult.rows,
        pagination: {
          total: totalRecords,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          filters: {
            is_active: is_active !== undefined ? is_active : null,
            tax_type: tax_type || null,
            jurisdiction: jurisdiction || null
          } // Reflect applied filters
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
