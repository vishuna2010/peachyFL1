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
      const query = `
        SELECT
            pao.id,
            pao.product_id,
            pao.option_id,
            po.name AS option_name,
            COALESCE(
                (SELECT json_agg(json_build_object('id', pov.id, 'value', pov.value ORDER BY pov.value))
                 FROM product_assigned_option_specific_values paosv
                 JOIN product_option_values pov ON paosv.product_option_value_id = pov.id
                 WHERE paosv.product_assigned_option_id = pao.id),
                '[]'::json
            ) AS selected_values
        FROM
            product_assigned_options pao
        JOIN
            product_options po ON pao.option_id = po.id
        WHERE
            pao.product_id = $1
        GROUP BY
            pao.id, po.id, po.name
        ORDER BY
            po.name;
      `;
      const result = await db.query(query, [productId]);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// GET /assigned-options/:assignedOptionId - Get a specific product_assigned_options record
router.get(
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
      const result = await db.query(
        `SELECT pao.id, pao.product_id, pao.option_id, po.name as option_name, pao.created_at, pao.updated_at
         FROM product_assigned_options pao
         JOIN product_options po ON pao.option_id = po.id
         WHERE pao.id = $1`,
        [assignedOptionId]
      );
      if (result.rows.length === 0) {
        return next(new NotFoundError(`Product assigned option with ID ${assignedOptionId} not found.`));
      }
      res.json(result.rows[0]);
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
    const { assignedOptionId } = req.params; // Correctly use assignedOptionId from route param

    try {
      // 1. Fetch the product_assigned_options record to get option_id and global_option_name
      const assignedOptionInfoQuery = await db.query(
        `SELECT pao.option_id, po.name as global_option_name
         FROM product_assigned_options pao
         JOIN product_options po ON pao.option_id = po.id
         WHERE pao.id = $1`,
        [assignedOptionId]
      );

      if (assignedOptionInfoQuery.rows.length === 0) {
        return next(new NotFoundError(`Product assigned option with ID ${assignedOptionId} not found.`));
      }
      const { option_id: globalOptionId, global_option_name } = assignedOptionInfoQuery.rows[0];

      // 2. Fetch all global product_option_values for this global_option_id
      const allGlobalValuesQuery = await db.query(
        `SELECT id, value FROM product_option_values
         WHERE product_option_id = $1 ORDER BY value ASC`,
        [globalOptionId]
      );
      const allGlobalValues = allGlobalValuesQuery.rows;

      // 3. Fetch currently selected product_option_value_ids for this productAssignedOptionId
      const selectedValuesQuery = await db.query(
        `SELECT product_option_value_id FROM product_assigned_option_specific_values
         WHERE product_assigned_option_id = $1`,
        [assignedOptionId]
      );
      const selectedValueIds = new Set(selectedValuesQuery.rows.map(r => r.product_option_value_id));

      // 4. Construct all_possible_values with is_selected flag
      const allPossibleValuesWithSelection = allGlobalValues.map(globalVal => ({
        ...globalVal, // id (global value id), value (global value name)
        is_selected: selectedValueIds.has(globalVal.id)
      }));

      res.status(200).json({
        data: {
          assigned_option_id: parseInt(assignedOptionId), // Use corrected variable
          global_option_name: global_option_name,
          all_possible_values: allPossibleValuesWithSelection
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// PUT /assigned-options/:assignedOptionId/values - Update specific values for an assigned option
router.put(
  '/assigned-options/:assignedOptionId/values', // Changed param name here
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.').toInt(), // Changed param name here
    body('value_ids').isArray().withMessage('value_ids must be an array.'),
    body('value_ids.*').optional().isInt({ gt: 0 }).withMessage('Each value_id in value_ids must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignedOptionId } = req.params; // Changed variable name here
    const { value_ids } = req.body; // Array of product_option_value_id

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify product_assigned_options record exists and get its global option_id
      const assignedOptionResult = await client.query(
        'SELECT option_id FROM product_assigned_options WHERE id = $1',
        [assignedOptionId] // Changed variable name here
      );
      if (assignedOptionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return next(new NotFoundError(`Product assigned option with ID ${assignedOptionId} not found.`)); // Changed variable name here
      }
      const globalOptionIdForAssigned = assignedOptionResult.rows[0].option_id;

      // Delete existing specific values for this product_assigned_option_id
      await client.query(
        'DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1',
        [assignedOptionId] // Changed variable name here
      );

      const insertedValues = [];
      if (value_ids && value_ids.length > 0) {
        // Verify each value_id belongs to the correct global option type
        const uniqueValueIds = [...new Set(value_ids)]; // Ensure unique IDs

        for (const valueId of uniqueValueIds) {
          if (valueId === null || valueId === undefined) continue; // Skip null/undefined if any

          const globalValueCheck = await client.query(
            'SELECT product_option_id FROM product_option_values WHERE id = $1',
            [valueId]
          );
          if (globalValueCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new NotFoundError(`Global option value with ID ${valueId} not found.`));
          }
          if (globalValueCheck.rows[0].product_option_id !== globalOptionIdForAssigned) {
            await client.query('ROLLBACK');
            return next(new BadRequestError(`Option value ID ${valueId} does not belong to the global option type (ID ${globalOptionIdForAssigned}) associated with this product assignment.`));
          }

          // Insert new specific value
          const insertResult = await client.query(
            'INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id) VALUES ($1, $2) RETURNING product_option_value_id',
            [assignedOptionId, valueId] // Changed variable name here
          );
          insertedValues.push(insertResult.rows[0].product_option_value_id);
        }
      }

      await client.query('COMMIT');
      res.status(200).json({
        message: 'Assigned option values updated successfully.',
        assigned_option_id: assignedOptionId, // Changed variable name here
        set_value_ids: insertedValues
      });

    } catch (error) {
      await client.query('ROLLBACK');
      // Handle potential unique constraint errors if ON CONFLICT is not used and somehow a duplicate slips through logic
      if (error.code === '23505' && error.constraint === 'product_assigned_option_specific_values_product_assigned_option_id_product_option_value_id_key') {
         return next(new ConflictError('Attempted to assign a duplicate value. This should not happen with the delete-then-insert logic.'));
      }
      next(error);
    } finally {
      client.release();
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
