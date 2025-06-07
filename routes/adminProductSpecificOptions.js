const express = require('express');
// Ensure mergeParams is true to access :productId from the parent router's path
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// POST /api/admin/products/:productId/options - Create a new option for a specific product
router.post('/', async (req, res) => {
  const { productId } = req.params; // From the path, due to mergeParams
  const { name } = req.body;

  if (isNaN(parseInt(productId))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'Option name is required.' });
  }

  const client = await db.pool.connect();
  try {
    // Check if product exists
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${productId} not found.` });
    }

    const insertQuery = `
      INSERT INTO product_options (product_id, name, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [productId, name.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'uk_product_option_name') {
      return res.status(409).json({ message: `Option name "${name.trim()}" already exists for this product.` });
    }
    console.error(`Error creating product option for product ${productId}:`, error);
    res.status(500).json({ message: 'Failed to create product option.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/products/:productId/options - List all options and their values for a specific product
router.get('/', async (req, res) => {
  const { productId } = req.params;
  if (isNaN(parseInt(productId))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  try {
    // Check if product exists
    const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${productId} not found.` });
    }

    // Fetch options and their values using a JOIN or subqueries.
    // Using a JOIN and aggregating values is efficient.
    const query = `
      SELECT
        po.id,
        po.name,
        po.product_id,
        po.created_at,
        po.updated_at,
        COALESCE(
          json_agg(
            json_build_object('id', pov.id, 'value', pov.value, 'created_at', pov.created_at, 'updated_at', pov.updated_at)
          ) FILTER (WHERE pov.id IS NOT NULL),
          '[]'::json
        ) AS "option_values"
      FROM product_options po
      LEFT JOIN product_option_values pov ON po.id = pov.product_option_id
      WHERE po.product_id = $1
      GROUP BY po.id, po.name, po.product_id, po.created_at, po.updated_at
      ORDER BY po.name ASC;
    `;
    const result = await db.query(query, [productId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(`Error fetching options for product ${productId}:`, error);
    res.status(500).json({ message: 'Failed to retrieve product options.' });
  }
});

module.exports = router;
