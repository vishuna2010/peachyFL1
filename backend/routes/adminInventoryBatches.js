const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { param, body, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/AppError');

router.use(isAuthenticated, isAdmin);

router.put(
  '/:batchId',
  [
    param('batchId').isInt({ gt: 0 }).toInt(),
    body('current_quantity').optional().isInt({ min: 0 }).toInt().withMessage('Current quantity must be a non-negative integer.'),
    body('expiry_date').optional({ nullable: true }).isDate().withMessage('Expiry date must be a valid date (YYYY-MM-DD) or null.'),
    body('batch_number').optional().isString().trim().notEmpty().withMessage('Batch number cannot be empty string if provided.'),
    body('reason_for_change').isString().trim().notEmpty().withMessage('Reason for change is required.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { batchId } = req.params;
    const { current_quantity, expiry_date, batch_number, reason_for_change } = req.body;
    const userId = req.user.userId;

    // Check if at least one updatable field (other than reason) is provided
    if (current_quantity === undefined && expiry_date === undefined && batch_number === undefined) {
      // Allow if only reason_for_change is provided but no actual data fields are changing - useful for just logging a reason if current_quantity is re-asserted
      // However, the task implies an actual data change should be intended.
      // For strictness, let's require at least one data field change intention.
      // If the frontend sends current_quantity === old_current_quantity, it will pass this and log if it's different from old (which it won't be).
      // The prompt's intention of "If no valid fields to update (other than reason), return 400" is better.
      // This check is a simplified version. A more robust check would be done after fetching the current batch.
      // The provided code already handles this by checking `setClauses.length > 0` later.
      // So, this initial check can be less strict or removed.
      // Let's stick to the provided code's structure where it checks setClauses.length later.
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const batchResult = await client.query('SELECT * FROM inventory_batches WHERE id = $1 FOR UPDATE', [batchId]);
      if (batchResult.rows.length === 0) {
        throw new NotFoundError(`Inventory batch with ID ${batchId} not found.`);
      }
      const currentBatch = batchResult.rows[0];
      const old_current_quantity = currentBatch.current_quantity;

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      let new_current_quantity_value = current_quantity;

      if (current_quantity !== undefined) {
        if (current_quantity > currentBatch.initial_quantity) {
          throw new BadRequestError(`New current quantity (${current_quantity}) cannot exceed initial quantity (${currentBatch.initial_quantity}).`);
        }
        setClauses.push(`current_quantity = $${paramIndex++}`);
        values.push(current_quantity);
      } else {
        // If current_quantity is not provided in body, it means no change to quantity from client's perspective for this update operation
        new_current_quantity_value = old_current_quantity; // Use for logging logic consistency
      }

      if (expiry_date !== undefined) {
        // express-validator's isDate() ensures it's a valid date string.
        // If it was an empty string or null and passed optional({nullable:true}), it will be handled.
        // For actual DB storage, if it's an empty string that should be null:
        const finalExpiryDate = (expiry_date === '' || expiry_date === null) ? null : expiry_date;
        setClauses.push(`expiry_date = $${paramIndex++}`);
        values.push(finalExpiryDate);
      }

      if (batch_number !== undefined && batch_number !== currentBatch.batch_number) {
        const trimmedBatchNumber = batch_number.trim();
        if(trimmedBatchNumber === ''){
             throw new BadRequestError('Batch number cannot be an empty string.');
        }
        // Check for uniqueness conflict if batch_number is changing
        const conflictCheckQuery = `
          SELECT id FROM inventory_batches
          WHERE product_id = $1
            AND CASE WHEN $2::INT IS NULL THEN variant_id IS NULL ELSE variant_id = $2::INT END
            AND batch_number = $3
            AND id != $4`;
        const conflictCheck = await client.query(conflictCheckQuery,
          [currentBatch.product_id, currentBatch.variant_id, trimmedBatchNumber, batchId]
        );

        if (conflictCheck.rows.length > 0) {
          throw new ConflictError(`Batch number "${trimmedBatchNumber}" already exists for this product/variant.`);
        }
        setClauses.push(`batch_number = $${paramIndex++}`);
        values.push(trimmedBatchNumber);
      }

      let updatedBatch = currentBatch;

      if (setClauses.length > 0) {
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(batchId); // The ID for the WHERE clause
        const updateQuery = `UPDATE inventory_batches SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
        const updateResult = await client.query(updateQuery, values);
        updatedBatch = updateResult.rows[0];
      } else {
        // No actual data fields were changed.
        // As per prompt: "If no valid fields to update (other than reason), return 400 or existing record."
        // Since reason_for_change is mandatory, and we might want to log even if data didn't change (e.g., audit),
        // we could proceed to log if reason implies an audit action.
        // However, for this implementation, returning 400 if no data fields are updated is clearer.
        // The prompt's initial check for "No updatable fields" can be reinstated here effectively.
         await client.query('ROLLBACK'); // No changes to commit, but good to release lock if any was held long
         return next(new BadRequestError('No updatable data fields (current_quantity, expiry_date, batch_number) provided or values are the same as current. Reason for change logged only if data changes.'));
      }

      // Log quantity change if it actually happened
      // new_current_quantity_value holds the value from req.body if provided, otherwise it's old_current_quantity
      // updatedBatch.current_quantity is the value now in the DB
      if (current_quantity !== undefined && updatedBatch.current_quantity !== old_current_quantity) {
        const quantity_difference = updatedBatch.current_quantity - old_current_quantity;
        // Only log if there's an actual difference.
        if (quantity_difference !== 0) {
            const logMovementQuery = `
              INSERT INTO stock_movement_logs
                (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `;
            await client.query(logMovementQuery, [
              updatedBatch.product_id,
              updatedBatch.variant_id,
              userId,
              'batch_adjustment',
              quantity_difference,
              updatedBatch.current_quantity, // New quantity on hand for this batch
              reason_for_change,
              `batch_id:${batchId}`
            ]);
        }
      }

      await client.query('COMMIT');
      res.status(200).json(updatedBatch);

    } catch (error) {
      if(client) await client.query('ROLLBACK');
      // Ensure specific error types are passed to next for correct status codes
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError) {
        return next(error);
      }
      // For other errors, pass them to the generic error handler
      next(error);
    } finally {
      if(client) client.release();
    }
  }
);

module.exports = router;
