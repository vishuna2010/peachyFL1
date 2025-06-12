const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, param, validationResult } = require('express-validator');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

// Protect all routes in this file
router.use(isAuthenticated, isAdmin);

// === Product-Specific Assigned Options ===
// (Linking a global option type to a specific product)

// POST /products/:productId/assigned-options
router.post(
  '/products/:productId/assigned-options',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.'),
    body('option_id').isInt({ gt: 0 }).withMessage('Global Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { option_id } = req.body;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        return next(new NotFoundError(`Product with ID ${productId} not found.`));
      }
      // Check if global option type exists
      const optionCheck = await db.query('SELECT id FROM product_options WHERE id = $1', [option_id]);
      if (optionCheck.rows.length === 0) {
        return next(new NotFoundError(`Global option type with ID ${option_id} not found.`));
      }

      const result = await db.query(
        'INSERT INTO product_assigned_options (product_id, option_id) VALUES ($1, $2) RETURNING *',
        [productId, option_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uk_product_assigned_option') {
        return next(new ConflictError('This option type is already assigned to this product.'));
      }
      next(error);
    }
  }
);

// GET /products/:productId/assigned-options
router.get(
  '/products/:productId/assigned-options',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { productId } = req.params;
    try {
      const result = await db.query(
        `SELECT pao.id, pao.product_id, pao.option_id, po.name as option_name, po.created_at as option_created_at, po.updated_at as option_updated_at
         FROM product_assigned_options pao
         JOIN product_options po ON pao.option_id = po.id
         WHERE pao.product_id = $1
         ORDER BY po.name`,
        [productId]
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /assigned-options/:assignedOptionId
// (where assignedOptionId is the ID from product_assigned_options table)
router.delete(
  '/assigned-options/:assignedOptionId',
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { assignedOptionId } = req.params;
    try {
      // ON DELETE CASCADE on product_assigned_option_id in product_assigned_option_values table
      // will handle deleting associated values for this specific product assignment.
      const result = await db.query('DELETE FROM product_assigned_options WHERE id = $1 RETURNING id', [assignedOptionId]);
      if (result.rowCount === 0) {
        return next(new NotFoundError(`Product assigned option with ID ${assignedOptionId} not found.`));
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);


// === Values for a Product-Specific Assigned Option ===
// (Linking global option values to a product's assigned option type)

// POST /assigned-options/:assignedOptionId/values
router.post(
  '/assigned-options/:assignedOptionId/values',
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.'),
    body('option_value_id').isInt({ gt: 0 }).withMessage('Global Option Value ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignedOptionId } = req.params;
    const { option_value_id } = req.body;

    try {
      const assignedOptionResult = await db.query('SELECT option_id FROM product_assigned_options WHERE id = $1', [assignedOptionId]);
      if (assignedOptionResult.rows.length === 0) {
        return next(new NotFoundError(`Product assigned option with ID ${assignedOptionId} not found.`));
      }
      const globalOptionIdForAssignedOption = assignedOptionResult.rows[0].option_id;

      const globalValueResult = await db.query('SELECT product_option_id FROM product_option_values WHERE id = $1', [option_value_id]);
      if (globalValueResult.rows.length === 0) {
        return next(new NotFoundError(`Global option value with ID ${option_value_id} not found.`));
      }
      if (globalValueResult.rows[0].product_option_id !== globalOptionIdForAssignedOption) {
        return next(new BadRequestError(`Option value ID ${option_value_id} does not belong to the correct global option type (expected type ID ${globalOptionIdForAssignedOption}).`));
      }

      const result = await db.query(
        'INSERT INTO product_assigned_option_values (product_assigned_option_id, option_value_id) VALUES ($1, $2) RETURNING *',
        [assignedOptionId, option_value_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uk_product_assigned_option_value') {
        return next(new ConflictError('This option value is already assigned to this product-option combination.'));
      }
      next(error);
    }
  }
);

// GET /assigned-options/:assignedOptionId/values
router.get(
  '/assigned-options/:assignedOptionId/values',
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { assignedOptionId } = req.params;
    try {
       const assignedOptionCheck = await db.query('SELECT id FROM product_assigned_options WHERE id = $1', [assignedOptionId]);
      if (assignedOptionCheck.rows.length === 0) {
        return next(new NotFoundError(`Product assigned option with ID ${assignedOptionId} not found.`));
      }

      const result = await db.query(
        `SELECT paov.id, paov.product_assigned_option_id, paov.option_value_id, pov.value as option_value_string
         FROM product_assigned_option_values paov
         JOIN product_option_values pov ON paov.option_value_id = pov.id
         WHERE paov.product_assigned_option_id = $1
         ORDER BY pov.value`,
        [assignedOptionId]
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /assigned-option-values/:assignedValueId
// (where assignedValueId is the ID from product_assigned_option_values table)
router.delete(
  '/assigned-option-values/:assignedValueId',
  [
    param('assignedValueId').isInt({ gt: 0 }).withMessage('Assigned Option Value ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { assignedValueId } = req.params;
    try {
      // Check if this assigned value is used by any product variants.
      // This would require checking if any product_variant_option_values exist that correspond to a variant
      // of this product_assigned_option's product_id AND this specific global option_value_id.
      // For now, we assume that if a variant is deleted, its product_variant_option_values entries are deleted.
      // If this specific link is deleted, it might invalidate a variant configuration.
      // The current most direct impact is that product_variants reference product_option_values.id (global value id).
      // Deleting from product_assigned_option_values doesn't directly break FKs for product_variants,
      // but it means this product configuration no longer explicitly allows this value for new variants.
      // A more robust check would be: "Are any product_variants for this product_assigned_option's product_id
      // using this specific global option_value_id through this product_assigned_option?" This is complex.
      // For now, let's proceed with the delete. The main check for value deletion is in adminOptionManagement.js
      // (cannot delete a global product_option_value if used in ANY product_variant_option_values).

      const result = await db.query('DELETE FROM product_assigned_option_values WHERE id = $1 RETURNING id', [assignedValueId]);
      if (result.rowCount === 0) {
        return next(new NotFoundError(`Product assigned option value with ID ${assignedValueId} not found.`));
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
