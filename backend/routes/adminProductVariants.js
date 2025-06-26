const express = require('express');
const router = express.Router(); // Will be mounted with /api/admin prefix
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, param, validationResult } = require('express-validator');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

// Protect all routes in this file
router.use(isAuthenticated, isAdmin);

// Helper function to get variant details (options and values)
// This function is non-transactional (uses the pool directly or a new client)
async function getVariantDetailsForResponse(variantId) {
    const detailsQuery = `
        SELECT
            pov.id as option_value_id,
            pov.value as option_value_name,
            po.id as option_id,
            po.name as option_name
        FROM product_variant_option_values pvov
        JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
        JOIN product_options po ON pov.product_option_id = po.id
        WHERE pvov.product_variant_id = $1
        ORDER BY po.name, pov.value;
    `;
    const { rows } = await db.query(detailsQuery, [variantId]); // Uses the pool implicitly
    return rows;
}

// POST /products/:productId/variants - Create a Product Variant
router.post(
  '/products/:productId/variants',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.'),
    body('price_modifier').isDecimal().withMessage('Price modifier must be a valid decimal value.'),
    body('stock_quantity').isInt({ gt: -1 }).withMessage('Stock quantity must be an integer (0 or more).'),
    body('sku').optional({ checkFalsy: true }).isString().trim().isLength({ min: 1, max: 100 }).withMessage('SKU must be between 1 and 100 characters if provided.'),
    body('image_url').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Image URL must be a valid URL or null.'),
    body('option_value_ids').isArray({ min: 1 }).withMessage('At least one global option value ID is required.'),
    body('option_value_ids.*').isInt({ gt: 0 }).withMessage('Each option value ID must be a positive integer.'),
    body('cost_price').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().custom(value => {
      // checkFalsy allows 0, custom validator ensures it's not negative.
      // null is allowed by nullable:true
      if (value < 0) {
        throw new Error('Cost price must be a non-negative decimal.');
      }
      return true;
    }).withMessage('Cost price must be a non-negative decimal or null.'),
    body('wholesale_price_modifier').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().withMessage('Wholesale price modifier must be a decimal value.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    // cost_price and wholesale_price_modifier are now validated and coerced by express-validator if provided
    const { sku, price_modifier, stock_quantity, image_url, option_value_ids, cost_price, wholesale_price_modifier } = req.body;
    const finalSku = sku && sku.trim() !== '' ? sku.trim() : null;

    // Manual validation for cost_price is no longer needed here due to express-validator
    // let parsed_cost_price = null;
    // if (cost_price !== undefined && cost_price !== null && cost_price !== '') {
    //   parsed_cost_price = parseFloat(cost_price);
    //   if (isNaN(parsed_cost_price) || parsed_cost_price < 0) {
    //     return next(new BadRequestError('Cost price must be a non-negative number.'));
    //   }
    // }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const productResult = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productResult.rows.length === 0) {
        throw new NotFoundError(`Product with ID ${productId} not found.`);
      }

      const uniqueOptionValueIds = [...new Set(option_value_ids.map(id => parseInt(id)))];
      if (uniqueOptionValueIds.length !== option_value_ids.length) {
          throw new BadRequestError('Duplicate option value IDs provided.');
      }

      const selectedGlobalOptionTypes = new Set();
      for (const globalValueId of uniqueOptionValueIds) {
        const valueCheck = await client.query(
          `SELECT pov.product_option_id, po.name AS option_name
           FROM product_option_values pov
           JOIN product_options po ON pov.product_option_id = po.id
           WHERE pov.id = $1`, [globalValueId]
        );
        if (valueCheck.rows.length === 0) throw new NotFoundError(`Global option value ID ${globalValueId} not found.`);

        const globalOptionId = valueCheck.rows[0].product_option_id;
        const globalOptionName = valueCheck.rows[0].option_name;

        if (selectedGlobalOptionTypes.has(globalOptionId)) {
            throw new BadRequestError(`Multiple values selected for the same global option type "${globalOptionName}".`);
        }
        selectedGlobalOptionTypes.add(globalOptionId);

        // Check if this global option value is assigned to this product through product_assigned_options & product_assigned_option_specific_values
        const assignmentCheck = await client.query(
          `SELECT paosv.id FROM product_assigned_option_specific_values paosv
           JOIN product_assigned_options pao ON paosv.product_assigned_option_id = pao.id
           WHERE pao.product_id = $1 AND pao.option_id = $2 AND paosv.product_option_value_id = $3`,
          [productId, globalOptionId, globalValueId]
        );
        if (assignmentCheck.rows.length === 0) {
          throw new BadRequestError(`Option value ID ${globalValueId} (for option ${globalOptionName}) is not specifically assigned/allowed for product ID ${productId}.`);
        }
      }

      const sortedIds = [...uniqueOptionValueIds].sort((a, b) => a - b);
      const existingVariantsCheckQuery = `
        SELECT pv.id FROM product_variants pv
        WHERE pv.product_id = $1 AND (
            SELECT array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id)
            FROM product_variant_option_values pvov
            WHERE pvov.product_variant_id = pv.id
        ) = $2::int[];
      `;
      const duplicateCheckResult = await client.query(existingVariantsCheckQuery, [productId, sortedIds]);
      if (duplicateCheckResult.rows.length > 0) {
          throw new ConflictError('A variant with this exact combination of option values already exists for this product.');
      }

      if (finalSku) {
        const skuCheck = await client.query('SELECT id FROM product_variants WHERE sku = $1 UNION SELECT id FROM products WHERE sku = $1', [finalSku]);
        if (skuCheck.rows.length > 0) {
            throw new ConflictError(`SKU "${finalSku}" already exists.`);
        }
      }

      const variantInsertResult = await client.query(
        `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, wholesale_price_modifier)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [productId, finalSku, price_modifier, stock_quantity, image_url || null, cost_price === undefined ? null : cost_price, wholesale_price_modifier === undefined ? null : wholesale_price_modifier]
      );
      const newVariant = variantInsertResult.rows[0];

      for (const ovId of uniqueOptionValueIds) {
        await client.query(
          'INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2)',
          [newVariant.id, ovId]
        );
      }
      await client.query('UPDATE products SET has_variants = TRUE, updated_at = NOW() WHERE id = $1', [productId]);

      // If initial stock is provided for the new variant, create a batch for it.
      if (newVariant.stock_quantity > 0) {
        const batchNumber = `INITIAL-${newVariant.sku || `VAR${newVariant.id}`}-${Date.now()}`;
        const costPriceAtReceipt = newVariant.cost_price !== null ? newVariant.cost_price : 0; // Default if not set
        // Assuming BASE_CURRENCY_CODE is available or can be defaulted
        const currencyCodeAtReceipt = process.env.BASE_CURRENCY_CODE || 'USD';

        const batchInsertQuery = `
          INSERT INTO inventory_batches
            (product_id, variant_id, batch_number, initial_quantity, current_quantity,
             cost_price_at_receipt, currency_code_at_receipt, received_date, expiry_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
          RETURNING id;
        `;
        await client.query(batchInsertQuery, [
          newVariant.product_id, newVariant.id, batchNumber,
          newVariant.stock_quantity, newVariant.stock_quantity,
          costPriceAtReceipt, currencyCodeAtReceipt,
          null // expiry_date - assuming null for initial stock batch
        ]);
        console.log(`Created initial inventory batch for new variant ID ${newVariant.id} with stock ${newVariant.stock_quantity}`);

        // Log stock movement (this part was already there and is good)
        try {
          const logMovementQuery = `
            INSERT INTO stock_movement_logs
              (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `;
          const userIdForLog = req.user ? req.user.userId : null;
          await client.query(logMovementQuery, [
            newVariant.product_id, newVariant.id, userIdForLog,
            'initial_stock_setup', newVariant.stock_quantity, newVariant.stock_quantity,
            'Initial stock for new variant', `variant_id:${newVariant.id}`
          ]);
          console.log(`Initial stock movement logged for variant ID ${newVariant.id}`);
        } catch (logError) {
          console.error(`Error logging initial stock movement for variant ID ${newVariant.id}:`, logError);
        }
      }

      await client.query('COMMIT');

      const variantDetails = await getVariantDetailsForResponse(newVariant.id);
      res.status(201).json({ ...newVariant, selected_options: variantDetails });

    } catch (error) {
      // Ensure client.query('ROLLBACK') is only called if transaction was actually started and client is valid
      if (client && !client._hadError && client._queryable) {
          try { await client.query('ROLLBACK'); } catch (rbError) { console.error("Rollback error on variant creation:", rbError); }
      }
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError) {
        return next(error);
      }
      next(error);
    } finally {
      client.release();
    }
  }
);

// GET /products/:productId/variants - List Variants for a Product
router.get(
  '/products/:productId/variants',
  [param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { productId } = req.params;
    try {
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);

      const variantsResult = await db.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id', [productId]);
      const variants = [];
      for (const variant of variantsResult.rows) {
        const details = await getVariantDetailsForResponse(variant.id);
        variants.push({ ...variant, selected_options: details });
      }
      res.json(variants);
    } catch (error) { next(error); }
  }
);

// GET /variants/:variantId - Get a Specific Variant
router.get(
  '/variants/:variantId',
  [param('variantId').isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { variantId } = req.params;
    try {
      const variantResult = await db.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
      if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
      const variant = variantResult.rows[0];
      const details = await getVariantDetailsForResponse(variant.id);
      res.json({ ...variant, selected_options: details });
    } catch (error) { next(error); }
  }
);

// PUT /variants/:variantId - Update a Product Variant
router.put(
  '/variants/:variantId',
  [
    param('variantId').isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer.'),
    body('sku').optional({ checkFalsy: true }).isString().trim().isLength({ min: 1, max: 100 }).withMessage('SKU must be between 1 and 100 characters.'),
    body('price_modifier').optional().isDecimal().withMessage('Price modifier must be a valid decimal.'),
    body('stock_quantity').optional().isInt({ gt: -1 }).withMessage('Stock quantity must be an integer (0 or more).'),
    body('image_url').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Image URL must be a valid URL or null.'),
    body('option_value_ids').optional().isArray({min:1}).withMessage('Option values must be a non-empty array if provided.'),
    body('option_value_ids.*').optional().isInt({ gt: 0 }).withMessage('Each option value ID must be a positive integer.'),
    body('reason').optional().isString().trim().withMessage('Reason must be a string if provided.'),
    body('cost_price').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().custom(value => {
      if (value < 0) { // checkFalsy allows 0
        throw new Error('Cost price must be a non-negative decimal.');
      }
      return true;
    }).withMessage('Cost price must be a non-negative decimal or null.'),
    body('wholesale_price_modifier').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().withMessage('Wholesale price modifier must be a decimal value.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { variantId } = req.params;
    // cost_price and wholesale_price_modifier are now validated and coerced by express-validator if provided
    const { sku, price_modifier, stock_quantity, image_url, option_value_ids, reason, cost_price, wholesale_price_modifier } = req.body;

    if (Object.keys(req.body).length === 0) {
        return next(new BadRequestError("No fields provided for update."));
    }
    const finalSku = sku && sku.trim() !== '' ? sku.trim() : (sku === null || sku === '' ? null : undefined);


    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const currentVariantResult = await client.query('SELECT * FROM product_variants WHERE id = $1 FOR UPDATE', [variantId]);
      if (currentVariantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
      const currentVariant = currentVariantResult.rows[0];
      const oldAggregateStockQuantity = currentVariant.stock_quantity; // The value stored on product_variants table

      let newAggregateStockQuantity = oldAggregateStockQuantity; // Default to old if not provided in request

      // Handle stock_quantity update specifically to interact with inventory_batches
      if (stock_quantity !== undefined) {
        newAggregateStockQuantity = parseInt(stock_quantity); // This is the new desired total stock
        if (isNaN(newAggregateStockQuantity) || newAggregateStockQuantity < 0) {
          throw new BadRequestError('Stock quantity must be a non-negative integer.');
        }

        // Get current total stock from batches for this variant
        const existingBatchStockResult = await client.query(
          `SELECT COALESCE(SUM(current_quantity), 0) AS total_batch_stock FROM inventory_batches WHERE variant_id = $1 AND product_id = $2`,
          [variantId, currentVariant.product_id]
        );
        const currentTotalBatchStock = parseInt(existingBatchStockResult.rows[0].total_batch_stock, 10);

        const stockChange = newAggregateStockQuantity - currentTotalBatchStock;
        const userId = req.user && req.user.userId ? req.user.userId : null;
        const changeReason = reason || 'Manual stock adjustment via variant edit';

        if (stockChange > 0) { // Increase stock - add to a new or existing manual batch
          const manualBatchNumber = `MANUAL-${currentVariant.sku || `VAR${variantId}`}`;
          // Try to find an existing manual batch for this variant
          const existingManualBatch = await client.query(
            `SELECT id, current_quantity, initial_quantity FROM inventory_batches
             WHERE variant_id = $1 AND product_id = $2 AND batch_number = $3 FOR UPDATE`,
            [variantId, currentVariant.product_id, manualBatchNumber]
          );

          if (existingManualBatch.rows.length > 0) {
            // Update existing manual batch
            const batchToUpdate = existingManualBatch.rows[0];
            await client.query(
              `UPDATE inventory_batches SET current_quantity = current_quantity + $1,
               initial_quantity = initial_quantity + $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [stockChange, stockChange, batchToUpdate.id] // Increment initial_quantity as well for this simple model
            );
            console.log(`[SeedDB/VariantUpdate] Increased stock in existing manual batch ${manualBatchNumber} by ${stockChange} for variant ${variantId}`);
          } else {
            // Create new manual batch
            const costPriceAtReceipt = currentVariant.cost_price !== null ? currentVariant.cost_price : 0;
            const currencyCodeAtReceipt = process.env.BASE_CURRENCY_CODE || 'USD';
            await client.query(
              `INSERT INTO inventory_batches
                (product_id, variant_id, batch_number, initial_quantity, current_quantity,
                 cost_price_at_receipt, currency_code_at_receipt, received_date, expiry_date, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [currentVariant.product_id, variantId, manualBatchNumber, stockChange, stockChange,
               costPriceAtReceipt, currencyCodeAtReceipt, null]
            );
            console.log(`[SeedDB/VariantUpdate] Created new manual batch ${manualBatchNumber} with stock ${stockChange} for variant ${variantId}`);
          }
        } else if (stockChange < 0) {
          // Decrease stock - This is complex. For now, we only log and update the aggregate.
          // The actual batch decrement should happen via a dedicated UI or process.
          // The stock_movement_log below will capture this intended reduction.
          console.warn(`[SeedDB/VariantUpdate] Stock decrease of ${-stockChange} requested for variant ${variantId}. This operation does not automatically decrement specific batches. Ensure manual batch adjustment if needed.`);
        }

        // Log movement if there was any change based on batch calculation vs new target
        if (stockChange !== 0) {
            const logMovementQuery = `
              INSERT INTO stock_movement_logs
                  (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            await client.query(logMovementQuery, [
                currentVariant.product_id, variantId, userId,
                'manual_adjustment', stockChange, newAggregateStockQuantity, // Log against the new aggregate target
                changeReason, `variant_id:${variantId}`
            ]);
        }
      }
      // The product_variants.stock_quantity will be updated later with newAggregateStockQuantity

      let newOptionValueIds = null;
      if (option_value_ids) {
        newOptionValueIds = [...new Set(option_value_ids.map(id => parseInt(id)))].sort((a,b)=>a-b);
        // Validation for new option_value_ids (similar to POST)
        const selectedGlobalOptionTypes = new Set();
        for (const globalValueId of newOptionValueIds) {
            const valueCheck = await client.query(`SELECT pov.product_option_id, po.name AS option_name FROM product_option_values pov JOIN product_options po ON pov.product_option_id = po.id WHERE pov.id = $1`, [globalValueId]);
            if (valueCheck.rows.length === 0) throw new NotFoundError(`Global option value ID ${globalValueId} not found.`);
            const globalOptionId = valueCheck.rows[0].product_option_id;
            if (selectedGlobalOptionTypes.has(globalOptionId)) throw new BadRequestError(`Multiple values selected for the same global option type "${valueCheck.rows[0].option_name}".`);
            selectedGlobalOptionTypes.add(globalOptionId);

            const assignmentCheck = await client.query(
              `SELECT paosv.id FROM product_assigned_option_specific_values paosv
               JOIN product_assigned_options pao ON paosv.product_assigned_option_id = pao.id
               WHERE pao.product_id = $1 AND pao.option_id = $2 AND paosv.product_option_value_id = $3`,
              [currentVariant.product_id, globalOptionId, globalValueId]
            );
            if (assignmentCheck.rows.length === 0) {
              throw new BadRequestError(`Option value ID ${globalValueId} (for option ${valueCheck.rows[0].option_name}) is not assigned/allowed for product ID ${currentVariant.product_id}.`);
            }
        }
        // Check for duplicate variant with the new combination
        const duplicateCheck = await client.query(`
            SELECT pv.id FROM product_variants pv WHERE pv.product_id = $1 AND pv.id != $2 AND (
                SELECT array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id)
                FROM product_variant_option_values pvov WHERE pvov.product_variant_id = pv.id
            ) = $3::int[];`,
            [currentVariant.product_id, variantId, newOptionValueIds]
        );
        if (duplicateCheck.rows.length > 0) throw new ConflictError('Another variant with this exact combination of option values already exists.');

        await client.query('DELETE FROM product_variant_option_values WHERE product_variant_id = $1', [variantId]);
        for (const ovId of newOptionValueIds) {
            await client.query('INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2)', [variantId, ovId]);
        }
      }

      const effectiveSku = finalSku !== undefined ? finalSku : currentVariant.sku;
      if (effectiveSku) { // Check SKU uniqueness only if it's being set or changed to a non-null value
        const skuCheck = await client.query(
            'SELECT id FROM product_variants WHERE sku = $1 AND id != $2 UNION SELECT id FROM products WHERE sku = $1',
            [effectiveSku, variantId]
        );
        if (skuCheck.rows.length > 0) {
            throw new ConflictError(`SKU "${effectiveSku}" already exists.`);
        }
      }

      const updatedVariantResult = await client.query(
        `UPDATE product_variants
         SET sku = $1, price_modifier = $2, stock_quantity = $3, image_url = $4, cost_price = $6, wholesale_price_modifier = $7, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [
          effectiveSku,
          price_modifier !== undefined ? price_modifier : currentVariant.price_modifier,
          stock_quantity !== undefined ? stock_quantity : currentVariant.stock_quantity,
          image_url !== undefined ? image_url : currentVariant.image_url,
          variantId,
          cost_price !== undefined ? cost_price : currentVariant.cost_price,
          wholesale_price_modifier !== undefined ? wholesale_price_modifier : currentVariant.wholesale_price_modifier
        ]
      );
      await client.query('COMMIT');
      const updatedVariant = updatedVariantResult.rows[0];
      const details = await getVariantDetailsForResponse(updatedVariant.id);
      res.json({ ...updatedVariant, selected_options: details });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError) return next(error);
      next(error);
    } finally {
      client.release();
    }
  }
);

// DELETE /variants/:variantId - Delete a Product Variant
router.delete(
  '/variants/:variantId',
  [param('variantId').isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { variantId } = req.params;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const variantDataResult = await client.query('SELECT product_id FROM product_variants WHERE id = $1', [variantId]);
      if (variantDataResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
      const { product_id: baseProductId } = variantDataResult.rows[0];

      // ON DELETE CASCADE handles product_variant_option_values
      const deleteResult = await client.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
      if (deleteResult.rowCount === 0) throw new NotFoundError(`Variant with ID ${variantId} not found during delete.`);

      const remainingVariantsResult = await client.query('SELECT COUNT(*) AS count FROM product_variants WHERE product_id = $1', [baseProductId]);
      if (parseInt(remainingVariantsResult.rows[0].count, 10) === 0) {
        await client.query('UPDATE products SET has_variants = FALSE, updated_at = NOW() WHERE id = $1', [baseProductId]);
      }
      await client.query('COMMIT');
      res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
