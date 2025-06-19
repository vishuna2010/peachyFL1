const express = require('express');
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { param, body, validationResult } = require('express-validator');
const { NotFoundError } = require('../utils/AppError');

const router = express.Router();

// Router-level logging (added in a previous step)
router.use((req, res, next) => {
  console.log(`[adminAssignedOptionsRouter] Request received for path: ${req.originalUrl} with method: ${req.method}`);
  next();
});

router.use(isAuthenticated); // Temporarily removed isAdmin

// GET /api/admin/assigned-options/:assignedOptionId/values
router.get(
  '/:assignedOptionId/values',
  [
    param('assignedOptionId').isInt({ gt: 0 }).withMessage('Assigned Option ID must be a positive integer.')
  ],
  async (req, res, next) => {
    console.log(`[adminAssignedOptions GET /:assignedOptionId/values] Handler entered for assignedOptionId: ${req.params.assignedOptionId}`);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[adminAssignedOptions GET /:assignedOptionId/values] Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    const { assignedOptionId } = req.params;
    try {
      const assignedOptionQuery = `
        SELECT pao.id AS assigned_option_id, pao.product_id, pao.option_id AS global_option_id, po.name AS global_option_name
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
      const allPossibleValuesQuery = `
        SELECT pov.id, pov.value AS value_name
        FROM product_option_values pov
        WHERE pov.product_option_id = $1
        ORDER BY pov.value ASC;
      `;
      const allPossibleValuesResult = await db.query(allPossibleValuesQuery, [globalOptionId]);
      const allPossibleValuesFromDB = allPossibleValuesResult.rows;
      const selectedValueIdsQuery = `
        SELECT product_option_value_id
        FROM product_assigned_option_specific_values
        WHERE product_assigned_option_id = $1;
      `;
      const selectedValueIdsResult = await db.query(selectedValueIdsQuery, [assignedOptionId]);
      const selectedValueIds = new Set(selectedValueIdsResult.rows.map(row => row.product_option_value_id));
      const combinedValues = allPossibleValuesFromDB.map(dbRow => {
        console.log('Processing dbRow:', dbRow);
        return {
          id: dbRow.id,
          value_name: dbRow.value_name,
          is_selected: selectedValueIds.has(dbRow.id)
        };
      });
      console.log('Final combinedValues for frontend:', combinedValues);
      res.status(200).json({
        data: {
          assigned_option_id: assignedOptionDetails.assigned_option_id,
          global_option_name: assignedOptionDetails.global_option_name,
          product_id: assignedOptionDetails.product_id,
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
      await client.query(
        'DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1',
        [assignedOptionId]
      );
      const deleteAssignedOptionResult = await client.query(
        'DELETE FROM product_assigned_options WHERE id = $1 RETURNING id',
        [assignedOptionId]
      );
      if (deleteAssignedOptionResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return next(new NotFoundError(`Assigned option with ID ${assignedOptionId} not found.`));
      }
      await client.query('COMMIT');
      res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error deleting assigned option ID ${assignedOptionId}:`, error);
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
    console.log(`[adminAssignedOptions PUT /:assignedOptionId/values] Handler entered for assignedOptionId: ${req.params.assignedOptionId}`);
    console.log(`  Received value_ids: ${JSON.stringify(req.body.value_ids)}`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[adminAssignedOptions PUT /:assignedOptionId/values] Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignedOptionId } = req.params;
    const { value_ids } = req.body;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`  Transaction started for assignedOptionId: ${assignedOptionId}.`);

      const assignedOptionCheck = await client.query(
        'SELECT id, product_id, option_id FROM product_assigned_options WHERE id = $1', // Fetch more info for logging
        [assignedOptionId]
      );
      if (assignedOptionCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        console.log(`  Assigned option with ID ${assignedOptionId} not found. Rollback.`);
        return next(new NotFoundError(`Assigned option with ID ${assignedOptionId} not found.`));
      }
      console.log(`  Checked assigned option ID ${assignedOptionId}: Product ID ${assignedOptionCheck.rows[0].product_id}, Global Option ID ${assignedOptionCheck.rows[0].option_id}`);

      const deleteResult = await client.query(
        'DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1',
        [assignedOptionId]
      );
      console.log(`  Deleted ${deleteResult.rowCount} existing specific values for assignedOptionId: ${assignedOptionId}.`);

      if (value_ids && value_ids.length > 0) {
        console.log(`  Attempting to insert ${value_ids.length} new specific values.`);
        const insertPromises = value_ids.map(valueId => {
          return client.query(
            'INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id) VALUES ($1, $2) RETURNING *', // RETURNING * for logging
            [assignedOptionId, valueId]
          );
        });
        const insertedResults = await Promise.all(insertPromises);
        insertedResults.forEach((result, index) => {
          console.log(`    Inserted specific value: ${JSON.stringify(result.rows[0])} (for input value_id: ${value_ids[index]})`);
        });
      } else {
        console.log(`  No new specific values to insert (value_ids array is empty or null).`);
      }

      await client.query('COMMIT');
      console.log(`  Transaction committed for assignedOptionId: ${assignedOptionId}.`);
      res.status(200).json({ message: 'Assigned option values updated successfully.' });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[adminAssignedOptions PUT /:assignedOptionId/values] Error for assignedOptionId ${assignedOptionId}:`, error);
      console.log(`  Transaction rolled back for assignedOptionId: ${assignedOptionId}.`);
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
