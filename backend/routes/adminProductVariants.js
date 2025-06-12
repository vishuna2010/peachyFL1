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
    body('option_value_ids.*').isInt({ gt: 0 }).withMessage('Each option value ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { sku, price_modifier, stock_quantity, image_url, option_value_ids } = req.body;
    const finalSku = sku && sku.trim() !== '' ? sku.trim() : null;

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

        // Check if this global option value is assigned to this product through product_assigned_options & product_assigned_option_values
        const assignmentCheck = await client.query(
          `SELECT paov.id FROM product_assigned_option_values paov
           JOIN product_assigned_options pao ON paov.product_assigned_option_id = pao.id
           WHERE pao.product_id = $1 AND pao.option_id = $2 AND paov.option_value_id = $3`,
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
        `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [productId, finalSku, price_modifier, stock_quantity, image_url || null]
      );
      const newVariant = variantInsertResult.rows[0];

      for (const ovId of uniqueOptionValueIds) {
        await client.query(
          'INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2)',
          [newVariant.id, ovId]
        );
      }
      await client.query('UPDATE products SET has_variants = TRUE, updated_at = NOW() WHERE id = $1', [productId]);
      await client.query('COMMIT');

      const variantDetails = await getVariantDetailsForResponse(newVariant.id);
      res.status(201).json({ ...newVariant, selected_options: variantDetails });

    } catch (error) {
      await client.query('ROLLBACK');
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
    body('option_value_ids.*').optional().isInt({ gt: 0 }).withMessage('Each option value ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { variantId } = req.params;
    const { sku, price_modifier, stock_quantity, image_url, option_value_ids } = req.body;

    if (Object.keys(req.body).length === 0) {
        return next(new BadRequestError("No fields provided for update."));
    }
    const finalSku = sku && sku.trim() !== '' ? sku.trim() : (sku === null || sku === '' ? null : undefined);


    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const currentVariantResult = await client.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
      if (currentVariantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
      const currentVariant = currentVariantResult.rows[0];

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
              `SELECT paov.id FROM product_assigned_option_values paov
               JOIN product_assigned_options pao ON paov.product_assigned_option_id = pao.id
               WHERE pao.product_id = $1 AND pao.option_id = $2 AND paov.option_value_id = $3`,
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
         SET sku = $1, price_modifier = $2, stock_quantity = $3, image_url = $4, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [
          effectiveSku,
          price_modifier !== undefined ? price_modifier : currentVariant.price_modifier,
          stock_quantity !== undefined ? stock_quantity : currentVariant.stock_quantity,
          image_url !== undefined ? image_url : currentVariant.image_url,
          variantId
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
