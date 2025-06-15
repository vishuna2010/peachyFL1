const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { param, body, query, validationResult } = require('express-validator'); // Added 'query'
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/AppError');

router.use(isAuthenticated, isAdmin);

// Validation rules for GET / (list batches)
const validateGetBatchesParams = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'),
  query('product_id').optional().isInt({ min: 1 }).toInt().withMessage('Product ID must be a positive integer.'),
  query('variant_id').optional().isInt({ min: 1 }).toInt().withMessage('Variant ID must be a positive integer.'),
  query('batch_number').optional().isString().trim().escape(),
  query('has_expired').optional().isBoolean().toBoolean(),
  query('expires_soon_days').optional().isInt({ min: 1 }).toInt().withMessage('Expires soon days must be a positive integer.'),
  query('sort_by').optional().isIn(['expiry_date', 'received_date', 'product_id', 'batch_number', 'current_quantity']).withMessage("Invalid sort_by value."),
  query('sort_order').optional().isIn(['ASC', 'DESC']).withMessage("Invalid sort_order value. Allowed: 'ASC', 'DESC'.")
];

// GET / - List inventory batches with filtering, sorting, and pagination
router.get('/', validateGetBatchesParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    page = 1,
    limit = 20,
    product_id,
    variant_id,
    batch_number,
    has_expired,
    expires_soon_days,
    sort_by = 'expiry_date', // Default sort
    sort_order = 'ASC'     // Default order
  } = req.query;

  const offset = (page - 1) * limit;
  const queryParams = [];
  const conditions = [];
  let paramIndex = 1; // For explicit parameter numbering in SQL

  let baseQueryStringPart = `
    FROM inventory_batches ib
    LEFT JOIN products p ON ib.product_id = p.id
    LEFT JOIN product_variants pv ON ib.variant_id = pv.id
  `;

  if (product_id) {
    conditions.push(`ib.product_id = $${paramIndex++}`);
    queryParams.push(product_id);
  }
  if (variant_id) {
    conditions.push(`ib.variant_id = $${paramIndex++}`);
    queryParams.push(variant_id);
  }
  if (batch_number) {
    conditions.push(`ib.batch_number ILIKE $${paramIndex++}`);
    queryParams.push(`%${batch_number}%`);
  }
  if (has_expired !== undefined) {
    if (has_expired === true) {
      conditions.push(`ib.expiry_date IS NOT NULL AND ib.expiry_date < CURRENT_DATE`);
    } else { // has_expired === false
      conditions.push(`(ib.expiry_date IS NULL OR ib.expiry_date >= CURRENT_DATE)`);
    }
  }
  if (expires_soon_days) {
    conditions.push(`ib.expiry_date IS NOT NULL AND ib.expiry_date >= CURRENT_DATE AND ib.expiry_date <= (CURRENT_DATE + ($${paramIndex++} * INTERVAL '1 day'))`);
    queryParams.push(expires_soon_days);
  }

  if (conditions.length > 0) {
    baseQueryStringPart += ' WHERE ' + conditions.join(' AND ');
  }

  // Sanitize sort_by to prevent SQL injection, though isIn validation already helps.
  // The fields are known and validated.
  const validSortColumns = ['expiry_date', 'received_date', 'product_id', 'batch_number', 'current_quantity'];
  const safeSortBy = validSortColumns.includes(sort_by) ? sort_by : 'expiry_date'; // Default to expiry_date if invalid
  const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Default to ASC

  const countQuerySql = 'SELECT COUNT(ib.id) as total_count ' + baseQueryStringPart;

  const dataSelectSql = 'SELECT ib.*, p.name as product_name, p.sku as product_sku, pv.sku as variant_sku ';
  const dataOrderSql = ` ORDER BY ib.${safeSortBy} ${safeSortOrder}, ib.id ${safeSortOrder} `; // Added secondary sort by id for stable pagination

  // For data query, parameter indices continue from where conditions left off
  const dataLimitOffsetSql = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  const dataQuerySql = dataSelectSql + baseQueryStringPart + dataOrderSql + dataLimitOffsetSql;

  // Parameters for count query are just the filter conditions
  const countFinalParams = [...queryParams];
  // Parameters for data query include filter conditions, then limit, then offset
  const dataFinalParams = [...queryParams, limit, offset];


  try {
    const countResult = await db.query(countQuerySql, countFinalParams);
    const totalBatches = parseInt(countResult.rows[0].total_count, 10);

    let batchesResultRows = [];
    if (totalBatches > 0) {
        const batchesResult = await db.query(dataQuerySql, dataFinalParams);
        batchesResultRows = batchesResult.rows;
    }

    res.status(200).json({
      data: batchesResultRows,
      pagination: {
        total: totalBatches,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalBatches / limit),
        hasNextPage: page < Math.ceil(totalBatches / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching inventory batches:', error);
    next(error); // Pass to global error handler
  }
});


// PUT /:batchId - Update an existing inventory batch
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
