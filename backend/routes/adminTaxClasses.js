const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, query, param, validationResult } = require('express-validator'); // Added param
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/AppError'); // Added NotFoundError, BadRequestError

router.use(isAuthenticated, isAdmin);

// POST / - Create a new tax class
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Tax class name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('description').optional({ nullable: true }).trim().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    try {
      // Check for name uniqueness (case-insensitive for robustness)
      // Note: The DB constraint (UNIQUE) on tax_classes.name is likely case-sensitive by default in PostgreSQL.
      // This check helps provide a friendlier error before hitting the DB constraint.
      const existingClass = await db.query('SELECT id FROM tax_classes WHERE LOWER(name) = LOWER($1)', [name]);
      if (existingClass.rows.length > 0) {
        // Using next() with a custom error allows global error handler to manage response
        return next(new ConflictError('A tax class with this name already exists.'));
      }

      const result = await db.query(
        'INSERT INTO tax_classes (name, description, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
        [name, description || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      // Handle potential unique constraint violation if DB is case sensitive and check above missed it
      if (error.code === '23505') { // '23505' is PostgreSQL unique_violation error code
        return next(new ConflictError('A tax class with this name already exists (database constraint).'));
      }
      next(error); // Pass other errors to the global error handler
    }
  }
);

// POST /:classId/rates - Link a tax rate to a tax class
router.post(
  '/:classId/rates',
  [
    param('classId').isInt({ gt: 0 }).toInt(),
    body('tax_rate_id').isInt({ gt: 0 }).toInt().withMessage('A valid tax_rate_id is required.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { classId } = req.params;
    const { tax_rate_id } = req.body;

    try {
      // Check if tax class exists
      const classCheck = await db.query('SELECT id FROM tax_classes WHERE id = $1', [classId]);
      if (classCheck.rows.length === 0) {
        throw new NotFoundError(`Tax class with ID ${classId} not found.`);
      }
      // Check if tax rate exists
      const rateCheck = await db.query('SELECT id FROM tax_rates WHERE id = $1', [tax_rate_id]);
      if (rateCheck.rows.length === 0) {
        throw new BadRequestError(`Tax rate with ID ${tax_rate_id} not found.`);
      }

      const result = await db.query(
        'INSERT INTO tax_class_rates (tax_class_id, tax_rate_id) VALUES ($1, $2) RETURNING *',
        [classId, tax_rate_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        return next(new ConflictError('This tax rate is already linked to this tax class.'));
      }
      next(error);
    }
  }
);

// GET /:classId/rates - List tax rates for a tax class
router.get(
  '/:classId/rates',
  [param('classId').isInt({ gt: 0 }).toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { classId } = req.params;
    try {
      const classCheck = await db.query('SELECT id FROM tax_classes WHERE id = $1', [classId]);
      if (classCheck.rows.length === 0) {
        throw new NotFoundError(`Tax class with ID ${classId} not found.`);
      }

      const result = await db.query(
        `SELECT tr.*
         FROM tax_rates tr
         JOIN tax_class_rates tcr ON tr.id = tcr.tax_rate_id
         WHERE tcr.tax_class_id = $1
         ORDER BY tr.name ASC;`,
        [classId]
      );
      res.status(200).json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:classId/rates/:rateId - Unlink a tax rate from a tax class
router.delete(
  '/:classId/rates/:rateId',
  [
    param('classId').isInt({ gt: 0 }).toInt(),
    param('rateId').isInt({ gt: 0 }).toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { classId, rateId } = req.params;
    try {
      const result = await db.query(
        'DELETE FROM tax_class_rates WHERE tax_class_id = $1 AND tax_rate_id = $2 RETURNING *',
        [classId, rateId]
      );
      if (result.rowCount === 0) {
        throw new NotFoundError(`Link between tax class ID ${classId} and tax rate ID ${rateId} not found.`);
      }
      res.status(200).json({ message: 'Tax rate unlinked from tax class successfully.', unlinked_relation: result.rows[0] });
      // Or res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get a specific tax class
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
      const result = await db.query('SELECT * FROM tax_classes WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        throw new NotFoundError(`Tax class with ID ${id} not found.`);
      }
      res.status(200).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update an existing tax class
router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).toInt(),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty if provided.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('description').optional({ nullable: true }).trim().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    if (name === undefined && description === undefined) {
      return next(new BadRequestError('No fields provided for update. Please provide name or description.'));
    }

    const client = await db.pool.connect(); // Use pool for transactions
    try {
      await client.query('BEGIN');
      const currentClassResult = await client.query('SELECT name, description FROM tax_classes WHERE id = $1 FOR UPDATE', [id]);
      if (currentClassResult.rows.length === 0) {
        await client.query('ROLLBACK'); // Release transaction before throwing
        throw new NotFoundError(`Tax class with ID ${id} not found.`);
      }
      const currentClass = currentClassResult.rows[0];

      if (name && name !== currentClass.name) {
        const existingClass = await client.query('SELECT id FROM tax_classes WHERE LOWER(name) = LOWER($1) AND id != $2', [name, id]);
        if (existingClass.rows.length > 0) {
          await client.query('ROLLBACK');
          throw new ConflictError('Another tax class with this name already exists.');
        }
      }

      const updateFields = {};
      if (name !== undefined) updateFields.name = name;
      // For description, allow setting it to null explicitly
      if (description !== undefined) updateFields.description = description;


      const setClauses = Object.keys(updateFields).map((key, i) => `${key} = $${i + 1}`);
      const values = Object.values(updateFields);

      if (setClauses.length === 0) {
        await client.query('ROLLBACK');
        return res.status(200).json(currentClass); // Or 304 Not Modified, but returning current is fine
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

      const updateQuery = `UPDATE tax_classes SET ${setClauses.join(', ')} WHERE id = $${values.length + 1} RETURNING *;`;
      values.push(id);

      const result = await client.query(updateQuery, values);

      await client.query('COMMIT');
      res.status(200).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') { // Unique violation for name
        return next(new ConflictError('Another tax class with this name already exists (database constraint).'));
      }
      next(error);
    } finally {
      client.release();
    }
  }
);

// DELETE /:id - Delete a tax class
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
      // The products.tax_class_id is ON DELETE SET NULL, so direct delete is fine.
      const result = await db.query('DELETE FROM tax_classes WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        throw new NotFoundError(`Tax class with ID ${id} not found.`);
      }
      res.status(200).json({ message: 'Tax class deleted successfully.', deletedClass: result.rows[0] });
      // Alternative: res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// GET / - List all tax classes (paginated)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt().default(10) // max is now 1000
  ],
  async (req, res, next) => {
    const errors = validationResult(req); // Only one declaration

    // Log actual req.query values as received by this point (could be strings)
    console.log('[adminTaxClasses GET /] req.query upon entry to handler: page=', req.query.page, ', limit=', req.query.limit);

    if (!errors.isEmpty()) {
        console.log('[adminTaxClasses GET /] Validation errors found:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    // page and limit from req.query here have been processed by express-validator's
    // .optional(), .isInt(), .toInt(), .default()
    const { page, limit } = req.query;

    // Log values after express-validator processing (should be numbers or defaults)
    console.log('[adminTaxClasses GET /] Values from req.query after validation (page, limit):', page, limit);

    let validatedPage = parseInt(page); // Re-parse, though validator's .toInt() should suffice. This handles if page was e.g. a string '1'
    let validatedLimit = parseInt(limit); // Re-parse for same reason.

    if (isNaN(validatedPage) || validatedPage < 1) {
      // This warning uses the 'page' variable which holds the value from req.query after validation/sanitization
      console.warn(`[adminTaxClasses GET /] Invalid or NaN page value after validation: ${page}. Defaulting validatedPage to 1.`);
      validatedPage = 1;
    }
    if (isNaN(validatedLimit) || validatedLimit < 1) {
      // This warning uses the 'limit' variable
      console.warn(`[adminTaxClasses GET /] Invalid or NaN limit value after validation: ${limit}. Defaulting validatedLimit to 10.`);
      validatedLimit = 10;
    }
    // Ensure validatedLimit does not exceed the specific maximum (e.g. 1000)
    // The validator `max:1000` should already enforce this. This is an extra safeguard.
    // validatedLimit = Math.min(validatedLimit, 1000);

    // LOG 3: After safeguards
    console.log('[adminTaxClasses GET /] Safeguarded values: validatedPage=', validatedPage, ', validatedLimit=', validatedLimit);

    const offset = (validatedPage - 1) * validatedLimit;
    // LOG 4: Calculated offset
    console.log('[adminTaxClasses GET /] Calculated offset:', offset);

    try {
      const dataQuery = 'SELECT * FROM tax_classes ORDER BY name ASC LIMIT $1 OFFSET $2;';
      // LOG 5: Before data query
      console.log(`[adminTaxClasses GET /] Executing dataQuery with limit: ${validatedLimit}, offset: ${offset}`);
      // Use the safeguarded values in the query
      const dataResult = await db.query(dataQuery, [validatedLimit, offset]);

      const countQuery = 'SELECT COUNT(*) FROM tax_classes;';
      // LOG 6: Before count query
      console.log(`[adminTaxClasses GET /] Executing countQuery.`);
      const countResult = await db.query(countQuery);
      const totalRecords = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalRecords / validatedLimit);

      res.status(200).json({
        data: dataResult.rows,
        pagination: {
          total: totalRecords,
          page: validatedPage, // Use safeguarded page
          limit: validatedLimit, // Use safeguarded limit
          totalPages, // totalPages calculation should also use validatedLimit
          hasNextPage: validatedPage < totalPages,
          hasPrevPage: validatedPage > 1
        }
      });
    } catch (error) {
      next(error); // Pass errors to the global error handler
    }
  }
);

module.exports = router;
