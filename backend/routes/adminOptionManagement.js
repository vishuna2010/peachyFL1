const express = require('express');
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, param, validationResult } = require('express-validator');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

// Router for /api/admin/options
const optionsRouter = express.Router();
optionsRouter.use(isAuthenticated, isAdmin); // Protect all routes on this router

// Router for /api/admin/option-values
const optionValuesRouter = express.Router();
optionValuesRouter.use(isAuthenticated, isAdmin); // Protect all routes on this router


// === Product Options (Global Types like "Color", "Size") ===

// POST /api/admin/options - Create a new global option type
optionsRouter.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Option name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Option name must be between 2 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO product_options (name) VALUES ($1) RETURNING *',
        [name]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'product_options_name_key') {
        return next(new ConflictError(`An option type with the name "${name}" already exists.`));
      }
      next(error);
    }
  }
);

// GET /api/admin/options - List all global option types
optionsRouter.get('/', async (req, res, next) => {
  try {
    // Consider pagination if the list grows very large in a real application
    const result = await db.query('SELECT * FROM product_options ORDER BY name ASC');
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/options/:optionId - Get a specific global option type
optionsRouter.get(
  '/:optionId',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    try {
      const result = await db.query('SELECT * FROM product_options WHERE id = $1', [optionId]);
      if (result.rows.length === 0) {
        return next(new NotFoundError(`Option type with ID ${optionId} not found.`));
      }
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/options/:optionId - Update a global option type's name
optionsRouter.put(
  '/:optionId',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.'),
    body('name').isString().trim().notEmpty().withMessage('Option name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Option name must be between 2 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    const { name } = req.body;
    try {
      const result = await db.query(
        'UPDATE product_options SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [name, optionId]
      );
      if (result.rows.length === 0) {
        return next(new NotFoundError(`Option type with ID ${optionId} not found.`));
      }
      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'product_options_name_key') {
        return next(new ConflictError(`An option type with the name "${name}" already exists.`));
      }
      next(error);
    }
  }
);

// DELETE /api/admin/options/:optionId - Delete a global option type
optionsRouter.delete(
  '/:optionId',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    try {
      const valueCountResult = await db.query('SELECT COUNT(*) FROM product_option_values WHERE product_option_id = $1', [optionId]);
      const valueCount = parseInt(valueCountResult.rows[0].count, 10);
      if (valueCount > 0) {
        return next(new BadRequestError(`Option type has ${valueCount} associated value(s). Please delete them first or reassign.`));
      }
      const result = await db.query('DELETE FROM product_options WHERE id = $1 RETURNING id', [optionId]);
      if (result.rowCount === 0) {
        return next(new NotFoundError(`Option type with ID ${optionId} not found.`));
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);


// === Product Option Values (Values like "Red", "Small" for a given Option Type) ===

// POST /api/admin/options/:optionId/values - Create a new value for a specific global option type
optionsRouter.post(
  '/:optionId/values',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.'),
    body('value').isString().trim().notEmpty().withMessage('Option value is required.')
      .isLength({ min: 1, max: 255 }).withMessage('Option value must be between 1 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    const { value } = req.body;
    try {
      const optionType = await db.query('SELECT id FROM product_options WHERE id = $1', [optionId]);
      if (optionType.rows.length === 0) {
        return next(new NotFoundError(`Option type with ID ${optionId} not found.`));
      }
      const result = await db.query(
        'INSERT INTO product_option_values (product_option_id, value) VALUES ($1, $2) RETURNING *',
        [optionId, value]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uk_option_value') {
        return next(new ConflictError(`The value "${value}" already exists for this option type.`));
      }
      next(error);
    }
  }
);

// GET /api/admin/options/:optionId/values - List all global values for a specific option type
optionsRouter.get(
  '/:optionId/values',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    try {
      const optionType = await db.query('SELECT id FROM product_options WHERE id = $1', [optionId]);
      if (optionType.rows.length === 0) {
        return next(new NotFoundError(`Option type with ID ${optionId} not found.`));
      }
      const result = await db.query('SELECT * FROM product_option_values WHERE product_option_id = $1 ORDER BY value ASC', [optionId]);
      res.json({ data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);


// === Standalone Option Value Management via /api/admin/option-values ===

// GET /api/admin/option-values/:valueId - Get a specific global option value
optionValuesRouter.get(
  '/:valueId',
  [
    param('valueId').isInt({ gt: 0 }).withMessage('Value ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { valueId } = req.params;
    try {
      const result = await db.query('SELECT * FROM product_option_values WHERE id = $1', [valueId]);
      if (result.rows.length === 0) {
        return next(new NotFoundError(`Option value with ID ${valueId} not found.`));
      }
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/option-values/:valueId - Update a global option value
optionValuesRouter.put(
  '/:valueId',
  [
    param('valueId').isInt({ gt: 0 }).withMessage('Value ID must be a positive integer.'),
    body('value').isString().trim().notEmpty().withMessage('Option value is required.')
      .isLength({ min: 1, max: 255 }).withMessage('Option value must be between 1 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { valueId } = req.params;
    const { value } = req.body;
    try {
      const currentValueData = await db.query('SELECT product_option_id FROM product_option_values WHERE id = $1', [valueId]);
      if(currentValueData.rows.length === 0) {
        return next(new NotFoundError(`Option value with ID ${valueId} not found.`));
      }
      // product_option_id is not changed here, only the value string.
      // The unique constraint `uk_option_value` is on (product_option_id, value).
      const result = await db.query(
        'UPDATE product_option_values SET value = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [value, valueId]
      );
      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uk_option_value') {
         // Need to fetch product_option_id if we want to include it in the message for context
        return next(new ConflictError(`The value "${value}" already exists for the parent option type.`));
      }
      next(error);
    }
  }
);

// DELETE /api/admin/option-values/:valueId - Delete a specific global option value
optionValuesRouter.delete(
  '/:valueId',
  [
    param('valueId').isInt({ gt: 0 }).withMessage('Value ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { valueId } = req.params;
    try {
      const usageResult = await db.query('SELECT COUNT(*) FROM product_variant_option_values WHERE product_option_value_id = $1', [valueId]);
      const usageCount = parseInt(usageResult.rows[0].count, 10);
      if (usageCount > 0) {
        return next(new BadRequestError(`Option value is in use by ${usageCount} product variant(s) and cannot be deleted.`));
      }
      const result = await db.query('DELETE FROM product_option_values WHERE id = $1 RETURNING id', [valueId]);
      if (result.rowCount === 0) {
        return next(new NotFoundError(`Option value with ID ${valueId} not found.`));
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = {
  optionsRouter,      // To be mounted at /api/admin/options
  optionValuesRouter  // To be mounted at /api/admin/option-values
};
