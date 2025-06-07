const express = require('express');
const router = express.Router();
const db = require('../db'); // Adjust path as necessary, assuming db.js is in the parent directory
const { isAdmin } = require('../auth'); // Adjust path for auth.js

// Helper function to get or create tag IDs
async function getOrCreateTagIds(tagNames, client) {
  const tagIds = [];
  if (!tagNames || tagNames.length === 0) {
    return tagIds;
  }

  for (const tagName of tagNames) {
    // Try to find existing tag
    let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName.trim()]);
    if (tagResult.rows.length > 0) {
      tagIds.push(tagResult.rows[0].id);
    } else {
      // Create new tag if not found
      tagResult = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName.trim()]);
      tagIds.push(tagResult.rows[0].id);
      console.log(`Created new tag: ${tagName.trim()}`);
    }
  }
  return tagIds;
}

// POST /products - Create a new product
router.post('/', isAdmin, async (req, res) => {
  const { name, description, price, category_id, tags: tagNames, image_path } = req.body; // tags is an array of names

  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Name and price are required.' });
  }
  if (category_id && isNaN(parseInt(category_id))) {
    return res.status(400).json({ message: 'Valid category_id (integer) is required if provided.'});
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    // Insert product
    const productQuery = `
      INSERT INTO products (name, description, price, category_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, price, category_id, created_at
    `;
    const productResult = await client.query(productQuery, [name, description, parseFloat(price), category_id ? parseInt(category_id) : null]);
    const newProduct = productResult.rows[0];

    // Handle tags
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client);
      for (const tagId of tagIds) {
        await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [newProduct.id, tagId]);
      }
      newProduct.tags = tagNames; // For response consistency
    }

    await client.query('COMMIT'); // Commit transaction

    if (image_path) {
      console.log(`Conceptual image upload: Image path "${image_path}" could be saved for product ID ${newProduct.id}.`);
      // In a real app, you'd save this path or a URL from an upload service.
      newProduct.image_path_conceptual = image_path;
    }

    res.status(201).json(newProduct);
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    console.error('Error creating product:', error);
    if (error.code === '23503' && error.constraint ==='products_category_id_fkey') {
        return res.status(400).json({ message: 'Invalid category_id.' });
    }
    res.status(500).json({ message: 'Error creating product.' });
  } finally {
    client.release();
  }
});

// GET /products - Get all products
router.get('/', async (req, res) => {
  try {
    // Query to fetch products and aggregate their tags
    const query = `
      SELECT p.*, c.name as category_name, COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY p.id, c.name
      ORDER BY p.created_at DESC;
    `;
    const result = await db.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ message: 'Error getting products.' });
  }
});

// GET /products/:id - Get a single product by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT p.*, c.name as category_name, COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, c.name;
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error getting product by ID:', error);
    res.status(500).json({ message: 'Error getting product.' });
  }
});

// PUT /products/:id - Update a product
router.put('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category_id, tags: tagNames, image_path } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }
  if (category_id && isNaN(parseInt(category_id))) {
    return res.status(400).json({ message: 'Valid category_id (integer) is required if provided.'});
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current product to see if it exists
    const currentProduct = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    if (currentProduct.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Update product details
    const updateQuery = `
      UPDATE products
      SET name = $1, description = $2, price = $3, category_id = $4
      WHERE id = $5
      RETURNING *
    `;
    const updatedProductResult = await client.query(updateQuery, [name, description, parseFloat(price), category_id ? parseInt(category_id) : null, id]);
    const updatedProduct = updatedProductResult.rows[0];

    // Update tags: Remove existing, then add new ones
    await client.query('DELETE FROM product_tags WHERE product_id = $1', [id]);
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client);
      for (const tagId of tagIds) {
        await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [id, tagId]);
      }
      updatedProduct.tags = tagNames; // For response
    } else {
      updatedProduct.tags = []; // For response
    }

    await client.query('COMMIT');

    if (image_path) {
      console.log(`Conceptual image upload: Image path "${image_path}" could be updated for product ID ${id}.`);
      updatedProduct.image_path_conceptual = image_path;
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', error);
     if (error.code === '23503' && error.constraint ==='products_category_id_fkey') {
        return res.status(400).json({ message: 'Invalid category_id.' });
    }
    res.status(500).json({ message: 'Error updating product.' });
  } finally {
    client.release();
  }
});

// DELETE /products/:id - Delete a product
router.delete('/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  const client = await db.pool.connect();
  try {
    // Related records in product_tags will be deleted by CASCADE
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Product not found.' });
    }
    await client.query('COMMIT');
    res.status(200).json({ message: 'Product deleted successfully.', product: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product.' });
  } finally {
    client.release();
  }
});

module.exports = router;
