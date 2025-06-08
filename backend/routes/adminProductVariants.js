const express = require('express');
// Ensure mergeParams is true to access :productId from the parent router's path
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

router.use(isAuthenticated, isAdmin);

// Helper function to fetch and format option values for a variant (used in GET and after POST/PUT)
async function getVariantOptionDetails(client, variantId) {
    const query = `
        SELECT pov.id as option_value_id, pov.value, po.name as option_name, po.id as option_id
        FROM product_variant_option_values pvov
        JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
        JOIN product_options po ON pov.product_option_id = po.id
        WHERE pvov.product_variant_id = $1
        ORDER BY po.name, pov.value;
    `;
    const result = await client.query(query, [variantId]);
    return result.rows.map(r => ({
        option_id: r.option_id,
        option_name: r.option_name,
        option_value_id: r.option_value_id,
        value: r.value
    }));
}


// POST /api/admin/products/:productId/variants - Create a new variant for a product
router.post('/', async (req, res) => {
  const { productId } = req.params;
  const { sku, price_modifier = 0.00, stock_quantity = 0, image_url, option_value_ids } = req.body;

  // --- Validations ---
  if (isNaN(parseInt(productId))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }
  if (!option_value_ids || !Array.isArray(option_value_ids) || option_value_ids.length === 0) {
    return res.status(400).json({ message: 'At least one option_value_id is required to define a variant.' });
  }
  if (option_value_ids.some(id => isNaN(parseInt(id)))) {
    return res.status(400).json({ message: 'All option_value_ids must be integers.' });
  }
  const stock = parseInt(stock_quantity);
  if (isNaN(stock) || stock < 0) {
    return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.' });
  }
  const priceMod = parseFloat(price_modifier);
  if (isNaN(priceMod)) {
    return res.status(400).json({ message: 'Price modifier must be a valid number.'});
  }
  // Ensure SKU is null if empty string
  const finalSku = sku && sku.trim() !== '' ? sku.trim() : null;


  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if product exists
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Product with ID ${productId} not found.` });
    }

    // 2. Validate option_value_ids: ensure they exist and belong to options of this product
    const validOptionValuesCheckQuery = `
        SELECT pov.id
        FROM product_option_values pov
        JOIN product_options po ON pov.product_option_id = po.id
        WHERE po.product_id = $1 AND pov.id = ANY($2::int[]);
    `;
    const validOptionValuesResult = await client.query(validOptionValuesCheckQuery, [productId, option_value_ids]);
    if (validOptionValuesResult.rows.length !== option_value_ids.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'One or more option_value_ids are invalid or do not belong to this product.' });
    }

    // 3. Uniqueness of SKU (if provided) across product_variants and products table
    if (finalSku) {
        const skuCheckVariants = await client.query('SELECT id FROM product_variants WHERE sku = $1', [finalSku]);
        if (skuCheckVariants.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `SKU "${finalSku}" already exists for another product variant.` });
        }
        const skuCheckProducts = await client.query('SELECT id FROM products WHERE sku = $1 AND id != $2', [finalSku, productId]);
        if (skuCheckProducts.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `SKU "${finalSku}" already exists for another base product.` });
        }
    }

    // 4. Uniqueness of Variant (combination of option_value_ids for this product_id)
    // This is complex. Fetch all existing variants for the product and their option values.
    // Then check if any existing variant has the exact same set of option_value_ids.
    const existingVariantsQuery = `
        SELECT pv.id, array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id) as existing_option_values
        FROM product_variants pv
        JOIN product_variant_option_values pvov ON pv.id = pvov.product_variant_id
        WHERE pv.product_id = $1
        GROUP BY pv.id;
    `;
    const existingVariantsResult = await client.query(existingVariantsQuery, [productId]);
    const sortedInputOptionValueIds = [...option_value_ids].map(id => parseInt(id)).sort((a, b) => a - b);

    for (const variant of existingVariantsResult.rows) {
        const sortedExistingValues = [...variant.existing_option_values].sort((a,b) => a - b);
        if (JSON.stringify(sortedExistingValues) === JSON.stringify(sortedInputOptionValueIds)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'This combination of option values already exists for another variant of this product.' });
        }
    }

    // 5. Insert into product_variants
    const insertVariantQuery = `
      INSERT INTO product_variants
        (product_id, sku, price_modifier, stock_quantity, image_url, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const variantResult = await client.query(insertVariantQuery, [
      productId, finalSku, priceMod, stock, image_url || null
    ]);
    const newVariant = variantResult.rows[0];

    // 6. Insert into product_variant_option_values
    const insertVariantOptionValuesQuery = `
      INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id)
      VALUES ($1, $2);
    `;
    for (const optionValueId of option_value_ids) {
      await client.query(insertVariantOptionValuesQuery, [newVariant.id, parseInt(optionValueId)]);
    }

    await client.query('COMMIT');

    // Fetch full variant details including option names/values for the response
    newVariant.options = await getVariantOptionDetails(client, newVariant.id); // Use client from this transaction
    res.status(201).json(newVariant);

  } catch (error) {
    await client.query('ROLLBACK'); // Ensure rollback on any error
    console.error(`Error creating variant for product ${productId}:`, error);
    if (error.code === '23505' && error.constraint === 'product_variants_sku_key') { // Check specific constraint name for SKU
        return res.status(409).json({ message: `SKU "${finalSku}" already exists.` });
    }
    res.status(500).json({ message: 'Failed to create product variant.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/products/:productId/variants - List all variants for a product
router.get('/', async (req, res) => {
  const { productId } = req.params;
  if (isNaN(parseInt(productId))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  try {
    const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${productId} not found.` });
    }

    const variantsResult = await db.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [productId]);
    const variants = variantsResult.rows;

    for (const variant of variants) {
      variant.options = await getVariantOptionDetails(db, variant.id); // Use db for new client from pool
    }

    res.status(200).json(variants);
  } catch (error) {
    console.error(`Error fetching variants for product ${productId}:`, error);
    res.status(500).json({ message: 'Failed to retrieve product variants.' });
  }
});

module.exports = router;
