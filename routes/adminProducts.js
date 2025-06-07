const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// PUT /api/admin/products/:id/stock - Update a product's stock quantity
router.put('/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { new_stock_quantity } = req.body;

  // Validate product ID
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID format.' });
  }

  // Validate new_stock_quantity
  if (new_stock_quantity === undefined) {
    return res.status(400).json({ message: 'new_stock_quantity is required in the request body.' });
  }
  const stockQuantity = parseInt(new_stock_quantity);
  if (isNaN(stockQuantity) || stockQuantity < 0) {
    return res.status(400).json({ message: 'new_stock_quantity must be a non-negative integer.' });
  }

  const client = await db.pool.connect();
  try {
    // We could start a transaction here if other operations were involved,
    // but for a single update, it's often optional unless strict atomicity with checks is needed.
    // For simplicity, let's proceed without an explicit transaction for this single update.
    // However, checking if product exists first is a good practice.

    // Check if product exists
    const productExistsResult = await client.query('SELECT id FROM products WHERE id = $1', [id]);
    if (productExistsResult.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${id} not found.` });
    }

    // Update the product's stock quantity and updated_at timestamp
    // Note: The products table does not have an updated_at column currently.
    // If it's needed, it should be added to the products table schema.
    // For now, we'll just update stock_quantity.
    // If an updated_at column (e.g., named 'updated_at') existed:
    // const updateQuery = `
    //   UPDATE products
    //   SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
    //   WHERE id = $2
    //   RETURNING *;
    // `;
    const updateQuery = `
      UPDATE products
      SET stock_quantity = $1
      WHERE id = $2
      RETURNING id, name, price, stock_quantity, category_id, image_url, description, created_at;
      -- Add other fields as needed for the response, or use RETURNING *
    `;
    const updatedProductResult = await client.query(updateQuery, [stockQuantity, id]);

    // The product is guaranteed to be found here due to the check above,
    // but update operations can return 0 rows if the WHERE clause didn't match (though unlikely here).
    if (updatedProductResult.rows.length === 0) {
        // This case should ideally not be hit if the existence check passed.
        return res.status(404).json({ message: `Product with ID ${id} found but update failed.`});
    }


    // To include tags and category_name in the response, similar to GET /api/products/:id
    const finalProductQuery = `
        SELECT p.*, c.name as category_name, COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE p.id = $1
        GROUP BY p.id, c.name;
    `;
    const finalProductResponse = await client.query(finalProductQuery, [id]);


    res.status(200).json({
      message: `Stock quantity for product #${id} updated to ${stockQuantity}.`,
      product: finalProductResponse.rows[0]
    });

  } catch (error) {
    console.error(`Error updating stock for product ID ${id}:`, error);
    res.status(500).json({ message: 'Failed to update product stock quantity.' });
  } finally {
    client.release();
  }
});

module.exports = router;
