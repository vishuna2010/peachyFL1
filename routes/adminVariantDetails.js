const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

router.use(isAuthenticated, isAdmin);

// Helper function to fetch and format option values for a variant (can be shared or duplicated if needed)
async function getVariantOptionDetails(clientOrDb, variantId) {
    const query = `
        SELECT pov.id as option_value_id, pov.value, po.name as option_name, po.id as option_id
        FROM product_variant_option_values pvov
        JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
        JOIN product_options po ON pov.product_option_id = po.id
        WHERE pvov.product_variant_id = $1
        ORDER BY po.name, pov.value;
    `;
    const result = await clientOrDb.query(query, [variantId]); // clientOrDb can be a client or the db pool
    return result.rows.map(r => ({
        option_id: r.option_id,
        option_name: r.option_name,
        option_value_id: r.option_value_id,
        value: r.value
    }));
}

// GET /api/admin/variants/:variantId - Get a specific variant by its ID
router.get('/:variantId', async (req, res) => {
  const { variantId } = req.params;
  if (isNaN(parseInt(variantId))) {
    return res.status(400).json({ message: 'Invalid variant ID format.' });
  }

  try {
    const variantResult = await db.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
    if (variantResult.rows.length === 0) {
      return res.status(404).json({ message: `Product variant with ID ${variantId} not found.` });
    }
    const variant = variantResult.rows[0];
    variant.options = await getVariantOptionDetails(db, variant.id); // Use db for new client from pool

    res.status(200).json(variant);
  } catch (error) {
    console.error(`Error fetching variant ${variantId}:`, error);
    res.status(500).json({ message: 'Failed to retrieve product variant.' });
  }
});

// PUT /api/admin/variants/:variantId - Update variant details (SKU, price_modifier, stock, image)
router.put('/:variantId', async (req, res) => {
  const { variantId } = req.params;
  const { sku, price_modifier, stock_quantity, image_url } = req.body;

  if (isNaN(parseInt(variantId))) {
    return res.status(400).json({ message: 'Invalid variant ID format.' });
  }

  // Validations
  if (sku !== undefined && typeof sku !== 'string' && sku !== null) { // Allow null to clear SKU
    return res.status(400).json({ message: 'SKU must be a string or null.' });
  }
  const finalSku = sku && sku.trim() !== '' ? sku.trim() : null;

  if (price_modifier !== undefined && isNaN(parseFloat(price_modifier))) {
    return res.status(400).json({ message: 'Price modifier must be a valid number.' });
  }
  if (stock_quantity !== undefined) {
      const stock = parseInt(stock_quantity);
      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.' });
      }
  }
  if (image_url !== undefined && typeof image_url !== 'string' && image_url !== null) {
      return res.status(400).json({ message: 'Image URL must be a string or null.' });
  }
  const finalImageUrl = image_url === '' ? null : image_url;


  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if variant exists and get its product_id for SKU uniqueness check scope
    const variantCheck = await client.query('SELECT product_id FROM product_variants WHERE id = $1 FOR UPDATE', [variantId]);
    if (variantCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product variant with ID ${variantId} not found.`});
    }
    const { product_id: originalProductId } = variantCheck.rows[0];

    // SKU Uniqueness Check (if SKU is provided and changing)
    if (finalSku) {
        const skuCheckVariants = await client.query('SELECT id FROM product_variants WHERE sku = $1 AND id != $2', [finalSku, variantId]);
        if (skuCheckVariants.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `SKU "${finalSku}" already exists for another product variant.` });
        }
        const skuCheckProducts = await client.query('SELECT id FROM products WHERE sku = $1 AND id != $2', [finalSku, originalProductId]);
         if (skuCheckProducts.rows.length > 0) { // Check against base products too
            // This check assumes SKUs should be globally unique or at least not conflict with base product SKUs
            // if base product is not the one this variant belongs to.
            // If the variant belongs to product X, and product X has this SKU, that's an issue.
            // If product Y has this SKU, that's also an issue.
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `SKU "${finalSku}" already exists for a base product or another variant.` });
        }
    }

    // Build dynamic SET clause
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (finalSku !== undefined) { setClauses.push(`sku = $${paramIndex++}`); values.push(finalSku); } // finalSku already handles empty string to null
    if (price_modifier !== undefined) { setClauses.push(`price_modifier = $${paramIndex++}`); values.push(parseFloat(price_modifier)); }
    if (stock_quantity !== undefined) { setClauses.push(`stock_quantity = $${paramIndex++}`); values.push(parseInt(stock_quantity)); }
    // Check if image_url is explicitly being set (even to null)
    if (Object.prototype.hasOwnProperty.call(req.body, 'image_url')) {
        setClauses.push(`image_url = $${paramIndex++}`); values.push(finalImageUrl);
    }


    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    const updateQuery = `UPDATE product_variants SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    values.push(variantId);

    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');

    const updatedVariant = result.rows[0];
    updatedVariant.options = await getVariantOptionDetails(db, updatedVariant.id); // Use db for fresh client

    res.status(200).json(updatedVariant);

  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' && error.constraint === 'product_variants_sku_key') {
      return res.status(409).json({ message: `SKU "${finalSku}" already exists.` });
    }
    console.error(`Error updating variant ${variantId}:`, error);
    res.status(500).json({ message: 'Failed to update product variant.' });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/variants/:variantId - Delete a specific variant
router.delete('/:variantId', async (req, res) => {
  const { variantId } = req.params;
  if (isNaN(parseInt(variantId))) {
    return res.status(400).json({ message: 'Invalid variant ID format.' });
  }

  try {
    // ON DELETE CASCADE in product_variant_option_values will clean up join table entries.
    const result = await db.query('DELETE FROM product_variants WHERE id = $1 RETURNING *', [variantId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Product variant with ID ${variantId} not found.` });
    }
    res.status(200).json({ message: 'Product variant deleted successfully.', deletedVariant: result.rows[0] });
  } catch (error) {
    console.error(`Error deleting variant ${variantId}:`, error);
    // Handle potential FK issues if other tables directly reference product_variants without ON DELETE CASCADE
    res.status(500).json({ message: 'Failed to delete product variant.' });
  }
});


module.exports = router;
