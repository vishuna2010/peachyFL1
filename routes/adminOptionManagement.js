const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// --- Product Option Management ---

// PUT /api/admin/product-options/:optionId - Update an option's name
router.put('/product-options/:optionId', async (req, res) => {
  const { optionId } = req.params;
  const { name } = req.body;

  if (isNaN(parseInt(optionId))) {
    return res.status(400).json({ message: 'Invalid option ID.' });
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'Option name is required.' });
  }

  const client = await db.pool.connect();
  try {
    // Fetch the option to get its product_id for unique name check scope
    const currentOptionResult = await client.query('SELECT product_id FROM product_options WHERE id = $1', [optionId]);
    if (currentOptionResult.rows.length === 0) {
      return res.status(404).json({ message: `Product option with ID ${optionId} not found.` });
    }
    const { product_id } = currentOptionResult.rows[0];

    const updateQuery = `
      UPDATE product_options
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND product_id = $3
      RETURNING *;
    `;
    const result = await client.query(updateQuery, [name.trim(), optionId, product_id]);

    if (result.rows.length === 0) { // Should not happen if previous check passed, but as safeguard
        return res.status(404).json({ message: `Product option with ID ${optionId} not found or update failed.` });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uk_product_option_name') {
      return res.status(409).json({ message: `Option name "${name.trim()}" already exists for this product.` });
    }
    console.error(`Error updating product option ${optionId}:`, error);
    res.status(500).json({ message: 'Failed to update product option.' });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/product-options/:optionId - Delete an option
router.delete('/product-options/:optionId', async (req, res) => {
  const { optionId } = req.params;
  if (isNaN(parseInt(optionId))) {
    return res.status(400).json({ message: 'Invalid option ID.' });
  }
  try {
    // CASCADE on product_option_id in product_option_values will delete associated values.
    // CASCADE on product_option_value_id in product_variant_option_values will delete links to variants.
    const result = await db.query('DELETE FROM product_options WHERE id = $1 RETURNING *;', [optionId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Product option with ID ${optionId} not found.` });
    }
    res.status(200).json({ message: 'Product option and its values deleted successfully.', deletedOption: result.rows[0] });
  } catch (error) {
    console.error(`Error deleting product option ${optionId}:`, error);
    res.status(500).json({ message: 'Failed to delete product option.' });
  }
});


// --- Product Option Value Management ---

// POST /api/admin/product-options/:optionId/values - Create a new value for an option
router.post('/product-options/:optionId/values', async (req, res) => {
  const { optionId } = req.params;
  const { value } = req.body;

  if (isNaN(parseInt(optionId))) {
    return res.status(400).json({ message: 'Invalid option ID.' });
  }
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return res.status(400).json({ message: 'Option value is required.' });
  }

  const client = await db.pool.connect();
  try {
    // Check if product_option exists
    const optionCheck = await client.query('SELECT id FROM product_options WHERE id = $1', [optionId]);
    if (optionCheck.rows.length === 0) {
      return res.status(404).json({ message: `Product option with ID ${optionId} not found.` });
    }

    const insertQuery = `
      INSERT INTO product_option_values (product_option_id, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [optionId, value.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uk_option_value') {
      return res.status(409).json({ message: `Value "${value.trim()}" already exists for this option.` });
    }
    console.error(`Error creating value for option ${optionId}:`, error);
    res.status(500).json({ message: 'Failed to create option value.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/product-options/:optionId/values - List values for a specific option
router.get('/product-options/:optionId/values', async (req, res) => {
  const { optionId } = req.params;
  if (isNaN(parseInt(optionId))) {
    return res.status(400).json({ message: 'Invalid option ID.' });
  }
  try {
    // Check if product_option exists
    const optionCheck = await db.query('SELECT id FROM product_options WHERE id = $1', [optionId]);
    if (optionCheck.rows.length === 0) {
      return res.status(404).json({ message: `Product option with ID ${optionId} not found.` });
    }

    const result = await db.query('SELECT * FROM product_option_values WHERE product_option_id = $1 ORDER BY value ASC', [optionId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(`Error fetching values for option ${optionId}:`, error);
    res.status(500).json({ message: 'Failed to retrieve option values.' });
  }
});

// PUT /api/admin/product-option-values/:valueId - Update an option value's string
router.put('/product-option-values/:valueId', async (req, res) => {
  const { valueId } = req.params;
  const { value } = req.body;

  if (isNaN(parseInt(valueId))) {
    return res.status(400).json({ message: 'Invalid option value ID.' });
  }
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return res.status(400).json({ message: 'New value is required.' });
  }

  const client = await db.pool.connect();
  try {
    // Fetch the option value to get its product_option_id for unique name check scope
    const currentValueResult = await client.query('SELECT product_option_id FROM product_option_values WHERE id = $1', [valueId]);
    if (currentValueResult.rows.length === 0) {
      return res.status(404).json({ message: `Product option value with ID ${valueId} not found.` });
    }
    const { product_option_id } = currentValueResult.rows[0];


    const updateQuery = `
      UPDATE product_option_values
      SET value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND product_option_id = $3
      RETURNING *;
    `;
    const result = await client.query(updateQuery, [value.trim(), valueId, product_option_id]);

    if (result.rows.length === 0) { // Should not happen if previous check passed
        return res.status(404).json({ message: `Product option value with ID ${valueId} not found or update failed.` });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uk_option_value') {
      return res.status(409).json({ message: `Value "${value.trim()}" already exists for this option.` });
    }
    console.error(`Error updating option value ${valueId}:`, error);
    res.status(500).json({ message: 'Failed to update option value.' });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/product-option-values/:valueId - Delete an option value
router.delete('/product-option-values/:valueId', async (req, res) => {
  const { valueId } = req.params;
  if (isNaN(parseInt(valueId))) {
    return res.status(400).json({ message: 'Invalid option value ID.' });
  }
  try {
    // CASCADE on product_option_value_id in product_variant_option_values will delete links to variants.
    const result = await db.query('DELETE FROM product_option_values WHERE id = $1 RETURNING *;', [valueId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Product option value with ID ${valueId} not found.` });
    }
    res.status(200).json({ message: 'Product option value deleted successfully.', deletedValue: result.rows[0] });
  } catch (error) {
    console.error(`Error deleting option value ${valueId}:`, error);
    // Check for foreign key violation if a variant still uses it (though CASCADE should handle)
    // This might occur if a product_variant_option_values entry was somehow orphaned or constraint issue.
    if (error.code === '23503') {
        return res.status(409).json({ message: 'Cannot delete option value: It is currently in use by product variants.' });
    }
    res.status(500).json({ message: 'Failed to delete option value.' });
  }
});


module.exports = router;
