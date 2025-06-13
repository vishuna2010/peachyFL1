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
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { // Should ideally not happen due to defaults and optional, but good practice
        return res.status(400).json({ errors: errors.array() });
    }

    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    try {
      const dataQuery = 'SELECT * FROM tax_classes ORDER BY name ASC LIMIT $1 OFFSET $2;';
      const dataResult = await db.query(dataQuery, [limit, offset]);

      const countQuery = 'SELECT COUNT(*) FROM tax_classes;';
      const countResult = await db.query(countQuery);
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
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      next(error); // Pass errors to the global error handler
    }
  }
);

module.exports = router;
