const express = require('express');
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { param, body, validationResult } = require('express-validator'); // Needs body for PUT
const { NotFoundError } = require('../utils/AppError');

const router = express.Router();
router.use(isAuthenticated, isAdmin); // Protect all routes

// GET /api/admin/assigned-options/:assignedOptionId/values
router.get(
  '/:assignedOptionId/values',
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
      // 1. Fetch the product_assigned_options record and the global option name
      const assignedOptionQuery = `
        SELECT
          pao.id AS assigned_option_id,
          pao.product_id,
          pao.option_id AS global_option_id,
          po.name AS global_option_name
        FROM product_assigned_options pao
        JOIN product_options po ON pao.option_id = po.id
        WHERE pao.id = $1;
      `;
      const assignedOptionResult = await db.query(assignedOptionQuery, [assignedOptionId]);

      if (assignedOptionResult.rows.length === 0) {
        return next(new NotFoundError(`Assigned option with ID ${assignedOptionId} not found.`));
      }
      const assignedOptionDetails = assignedOptionResult.rows[0];
      const globalOptionId = assignedOptionDetails.global_option_id;

      // 2. Fetch all global values for the associated global option type
      const allPossibleValuesQuery = `
        SELECT
          pov.id,
          pov.value AS value_name -- Frontend expects value_name
        FROM product_option_values pov
        WHERE pov.product_option_id = $1
        ORDER BY pov.value ASC;
      `;
      const allPossibleValuesResult = await db.query(allPossibleValuesQuery, [globalOptionId]);
      const allPossibleValuesFromDB = allPossibleValuesResult.rows;

      // 3. Fetch the IDs of currently selected values for this specific assigned option
      const selectedValueIdsQuery = `
        SELECT product_option_value_id
        FROM product_assigned_option_specific_values
        WHERE product_assigned_option_id = $1;
      `;
      const selectedValueIdsResult = await db.query(selectedValueIdsQuery, [assignedOptionId]);
      const selectedValueIds = new Set(selectedValueIdsResult.rows.map(row => row.product_option_value_id));

      // 4. Combine all_possible_values with selection status (Explicit Mapping)
      const combinedValues = allPossibleValuesFromDB.map(dbRow => {
        // Log each row from the database to see its exact structure
        // console.log('Processing dbRow:', dbRow);
        return {
          id: dbRow.id,
          value_name: dbRow.value_name, // Explicitly access value_name which should be aliased from pov.value
          is_selected: selectedValueIds.has(dbRow.id)
        };
      });

      // Optional: Log the final combinedValues to see what's being sent
      // console.log('Final combinedValues for frontend:', combinedValues);

      res.status(200).json({
        data: {
          assigned_option_id: assignedOptionDetails.assigned_option_id,
          global_option_name: assignedOptionDetails.global_option_name,
          product_id: assignedOptionDetails.product_id, // Potentially useful for frontend context
          all_possible_values: combinedValues
        }
      });

    } catch (error) {
      console.error(`Error fetching values for assigned option ID ${assignedOptionId}:`, error);
      next(error);
    }
  }
);

// DELETE /api/admin/assigned-options/:assignedOptionId
router.delete(
  '/:assignedOptionId',
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignedOptionId } = req.params;
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // First, delete associated specific values (child table)
      // This is crucial if there's no ON DELETE CASCADE from product_assigned_options to these.
      // If ON DELETE CASCADE is set up, this explicit delete is not strictly necessary but is safer.
      await client.query(
        'DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1',
        [assignedOptionId]
      );

      // Then, delete the product_assigned_options record itself
      const deleteAssignedOptionResult = await client.query(
        'DELETE FROM product_assigned_options WHERE id = $1 RETURNING id',
        [assignedOptionId]
      );

      if (deleteAssignedOptionResult.rowCount === 0) {
        await client.query('ROLLBACK');
        // This means the assigned option was not found, potentially already deleted or invalid ID.
        return next(new NotFoundError(`Assigned option with ID ${assignedOptionId} not found.`));
      }

      // Also consider impact on product_variants. If variants are defined by combinations of
      // assigned option values, deleting an assignment might require variants to be updated or deleted.
      // The current frontend message "may affect variants" suggests this.
      // For now, this backend operation only deletes the assignment and its specific values.
      // A more robust solution might involve a service layer function that handles cascading impacts on variants.
      // However, the immediate request is to make the "Remove" button functional for the assignment itself.

      await client.query('COMMIT');
      res.status(204).send(); // Standard success response for DELETE with no content

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error deleting assigned option ID ${assignedOptionId}:`, error);
      // Check for specific errors, e.g., if it's referenced by another table that prevents deletion
      // For example, if product_variant_option_values directly referenced product_assigned_options (unlikely).
      next(error);
    } finally {
      client.release();
    }
  }
);

// PUT /api/admin/assigned-options/:assignedOptionId/values
router.put(
  '/:assignedOptionId/values',
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.'),
    body('value_ids').isArray().withMessage('value_ids must be an array.'),
    body('value_ids.*').isInt({ gt: 0 }).withMessage('Each value_id must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignedOptionId } = req.params;
    const { value_ids } = req.body;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if the assigned option ID exists
      const assignedOptionCheck = await client.query(
        'SELECT id FROM product_assigned_options WHERE id = $1',
        [assignedOptionId]
      );
      if (assignedOptionCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return next(new NotFoundError(`Assigned option with ID ${assignedOptionId} not found.`));
      }

      // Delete existing specific values for this assigned option
      await client.query(
        'DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1',
        [assignedOptionId]
      );

      // Insert new specific values
      if (value_ids && value_ids.length > 0) {
        // Optional: Validate that all value_ids belong to the correct global_option_id
        // For simplicity, this is omitted here but would be good for robustness.

        const insertPromises = value_ids.map(valueId => {
          return client.query(
            'INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id) VALUES ($1, $2)',
            [assignedOptionId, valueId]
          );
        });
        await Promise.all(insertPromises);
      }

      await client.query('COMMIT');
      res.status(200).json({ message: 'Assigned option values updated successfully.' });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error updating values for assigned option ID ${assignedOptionId}:`, error);
      // Check for foreign key constraint errors if a value_id is invalid
      if (error.code === '23503') { // foreign_key_violation
          return res.status(400).json({ message: 'One or more option value IDs are invalid or do not belong to the correct option type.' });
      }
      next(error);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
