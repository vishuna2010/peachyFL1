const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { param, body, query, validationResult } = require('express-validator'); // Added 'query'
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/AppError');
const inventoryService = require('../services/inventoryService'); // Moved import to top

router.use(isAuthenticated, isAdmin);

// Validation rules for POST / (create batch)
const validateCreateBatchParams = [
  body('product_id').isInt({ gt: 0 }).toInt().withMessage('Product ID must be a positive integer.'),
  body('variant_id').optional({ nullable: true }).isInt({ gt: 0 }).toInt().withMessage('Variant ID must be a positive integer if provided.'),
  body('batch_number').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 100 }).withMessage('Batch number must be between 1 and 100 characters if provided.'),
  body('initial_quantity').isInt({ gt: 0 }).toInt().withMessage('Initial quantity must be a positive integer.'),
  body('current_quantity').optional().isInt({ min: 0 }).toInt().withMessage('Current quantity must be a non-negative integer. Defaults to initial_quantity if not provided.'),
  body('expiry_date').optional({ nullable: true }).isDate().withMessage('Expiry date must be a valid date (YYYY-MM-DD) or null.'),
  body('cost_price_at_receipt').isDecimal({ decimal_digits: '0,2' }).toFloat().withMessage('Cost price at receipt must be a decimal value.'),
  body('currency_code_at_receipt').isString().trim().isLength({ min: 3, max: 3 }).toUpperCase().withMessage('Currency code must be a 3-letter string.'),
  body('purchase_order_item_id').optional({ nullable: true }).isInt({ gt: 0 }).toInt().withMessage('PO Item ID must be a positive integer if provided.'),
  // Note: base_currency_cost_price_at_receipt and exchange_rate_used might be calculated or defaulted rather than direct input for manual creation
];

// POST / - Create a new inventory batch
router.post('/', validateCreateBatchParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    product_id, variant_id, batch_number, initial_quantity,
    expiry_date, cost_price_at_receipt, currency_code_at_receipt,
    purchase_order_item_id
  } = req.body;

  // current_quantity defaults to initial_quantity if not provided or if less than 0 (though validator ensures >=0)
  const current_quantity = (req.body.current_quantity !== undefined && req.body.current_quantity >= 0)
                           ? parseInt(req.body.current_quantity)
                           : initial_quantity;

  if (current_quantity > initial_quantity) {
    return next(new BadRequestError('Current quantity cannot exceed initial quantity for a new batch.'));
  }

  const finalBatchNumber = batch_number ? batch_number.trim() : `MANUAL-${Date.now()}`;
  const finalExpiryDate = (expiry_date === '' || expiry_date === null) ? null : expiry_date;
  const userId = req.user.userId;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Validate product_id
    const productCheck = await client.query('SELECT id, sku, has_variants FROM products WHERE id = $1 FOR UPDATE', [product_id]);
    if (productCheck.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${product_id} not found.`);
    }
    const product = productCheck.rows[0];

    // Validate variant_id if provided
    let variantSku = null;
    if (variant_id) {
      if (!product.has_variants) {
        throw new BadRequestError(`Product ID ${product_id} does not have variants, so variant_id should not be provided.`);
      }
      const variantCheck = await client.query('SELECT id, sku FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE', [variant_id, product_id]);
      if (variantCheck.rows.length === 0) {
        throw new NotFoundError(`Variant with ID ${variant_id} not found for product ID ${product_id}.`);
      }
      variantSku = variantCheck.rows[0].sku;
    } else {
      if (product.has_variants) {
        throw new BadRequestError(`Product ID ${product_id} has variants. A specific variant_id is required to create a batch for it.`);
      }
    }

    // Check for batch number uniqueness (product_id, variant_id, batch_number)
     const conflictCheck = await client.query(
        `SELECT id FROM inventory_batches
         WHERE product_id = $1
           AND ${variant_id ? `variant_id = $2` : 'variant_id IS NULL'}
           AND batch_number = $${variant_id ? 3 : 2}`,
        variant_id ? [product_id, variant_id, finalBatchNumber] : [product_id, finalBatchNumber]
      );
      if (conflictCheck.rows.length > 0) {
        throw new ConflictError(`Batch number "${finalBatchNumber}" already exists for this product/variant.`);
      }


    const insertQuery = `
      INSERT INTO inventory_batches
        (product_id, variant_id, batch_number, expiry_date, initial_quantity, current_quantity,
         cost_price_at_receipt, currency_code_at_receipt, base_currency_cost_price_at_receipt, exchange_rate_used,
         purchase_order_item_id, received_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    // For manual creation, base_currency_cost_price and exchange_rate might be same as cost_price_at_receipt and 1 if currency is base, or need input.
    // Assuming cost_price_at_receipt IS in base currency for manual entry simplicity for now.
    const newBatchResult = await client.query(insertQuery, [
      product_id, variant_id || null, finalBatchNumber, finalExpiryDate, initial_quantity, current_quantity,
      cost_price_at_receipt, currency_code_at_receipt, cost_price_at_receipt, 1.0, // Assuming cost is in base currency
      purchase_order_item_id || null
    ]);
    const newBatch = newBatchResult.rows[0];

    // Update aggregate stock on product or variant
    let old_aggregate_stock = 0;
    if (variant_id) {
      const vr = await client.query('SELECT stock_quantity FROM product_variants WHERE id=$1', [variant_id]);
      old_aggregate_stock = vr.rows[0].stock_quantity;
      await client.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newBatch.current_quantity, variant_id]
      );
    } else {
      const pr = await client.query('SELECT stock_quantity FROM products WHERE id=$1', [product_id]);
      old_aggregate_stock = pr.rows[0].stock_quantity;
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newBatch.current_quantity, product_id]
      );
    }

    // Log stock movement
    const logMovementQuery = `
      INSERT INTO stock_movement_logs
        (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `;
    await client.query(logMovementQuery, [
      newBatch.product_id, newBatch.variant_id, userId, 'manual_batch_creation',
      newBatch.current_quantity, old_aggregate_stock + newBatch.current_quantity,
      `Manual batch entry: ${finalBatchNumber}`, `batch_id:${newBatch.id}`
    ]);

    await client.query('COMMIT');
    res.status(201).json(newBatch);

  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError) {
      return next(error);
    }
    next(error);
  } finally {
    if(client) client.release();
  }
});


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
    body('expiry_date').optional({ nullable: true })
      .isISO8601().withMessage('Expiry date must be a valid date (YYYY-MM-DD) or null.')
      .toDate(), // Convert to Date object if valid
    body('batch_number').optional().isString().trim().notEmpty().withMessage('Batch number cannot be empty string if provided.')
      .isLength({ min: 1, max: 100 }).withMessage('Batch number must be between 1 and 100 characters.'),
    body('reason_for_change').isString().trim().notEmpty().withMessage('Reason for change is required.')
      .isLength({ min: 1, max: 255 }).withMessage('Reason for change must be between 1 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { batchId } = req.params;
    const { current_quantity, expiry_date, batch_number, reason_for_change } = req.body;
    const adminUserId = req.user.userId;

    // Construct the updateData object for the service
    const updateData = { reason_for_change };
    if (current_quantity !== undefined) {
      updateData.current_quantity = current_quantity;
    }
    if (expiry_date !== undefined) {
      updateData.expiry_date = expiry_date;
    }
    if (batch_number !== undefined) {
      updateData.batch_number = batch_number;
    }

    // An initial check if any updatable field (other than reason) is provided.
    // The service will do a more thorough check against current values.
    if (current_quantity === undefined && expiry_date === undefined && batch_number === undefined) {
        return next(new BadRequestError('At least one field (current_quantity, expiry_date, or batch_number) must be provided for update along with reason_for_change.'));
    }

    try {
      const updatedBatch = await inventoryService.updateInventoryBatch(batchId, updateData, adminUserId);
      res.status(200).json(updatedBatch);
    } catch (error) {
      // The service function is expected to throw NotFoundError, BadRequestError, ConflictError, or AppError.
      // These will be handled by the global errorHandler if passed to next().
      next(error);
    }
  }
);

module.exports = router;
