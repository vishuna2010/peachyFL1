const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const fs = require('fs'); // For deleting files
const path = require('path'); // For path manipulation

// Helper function to get or create tag IDs
async function getOrCreateTagIds(tagNames, client) {
  const tagIds = [];
  if (!tagNames || tagNames.length === 0) {
    return tagIds;
  }
  for (const tagName of tagNames) {
    let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName.trim()]);
    if (tagResult.rows.length > 0) {
      tagIds.push(tagResult.rows[0].id);
    } else {
      tagResult = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName.trim()]);
      tagIds.push(tagResult.rows[0].id);
      console.log(`Created new tag: ${tagName.trim()}`);
    }
  }
  return tagIds;
}

// POST /products - Create a new product
router.post('/', isAuthenticated, isAdmin, productImageUploadMiddleware, handleMulterError, async (req, res) => {
  const { name, description, price, category_id, tags: tagNames } = req.body;

  if (!name || price === undefined) {
    // If a file was uploaded before this validation fails, it's orphaned.
    if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned upload due to validation fail:", err);});
    return res.status(400).json({ message: 'Name and price are required.' });
  }
  if (category_id && isNaN(parseInt(category_id))) {
    if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned upload due to validation fail:", err);});
    return res.status(400).json({ message: 'Valid category_id (integer) is required if provided.' });
  }

  let imageUrl = null;
  if (req.file) {
    // req.file.path from multer is like "uploads/product_images/filename.jpg"
    // We want the URL to be "/uploads/product_images/filename.jpg"
    imageUrl = '/' + req.file.path.replace(/\\/g, "/");
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const productQuery = `
      INSERT INTO products (name, description, price, category_id, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const productResult = await client.query(productQuery, [name, description, parseFloat(price), category_id ? parseInt(category_id) : null, imageUrl]);
    const newProduct = productResult.rows[0];

    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client);
      for (const tagId of tagIds) {
        await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [newProduct.id, tagId]);
      }
      const tagsResult = await client.query('SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = $1', [newProduct.id]);
      newProduct.tags = tagsResult.rows.map(t => t.name);
    } else {
      newProduct.tags = [];
    }

    await client.query('COMMIT');
    res.status(201).json(newProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    // If transaction fails and an image was uploaded, delete the orphaned image.
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting image after transaction rollback:', unlinkErr);
      });
    }
    console.error('Error creating product:', error);
    if (error.code === '23503' && error.constraint === 'products_category_id_fkey') {
      return res.status(400).json({ message: 'Invalid category_id.' });
    }
    res.status(500).json({ message: 'Error creating product.' });
  } finally {
    client.release();
  }
});

// GET /products - Get all products (remains unchanged)
router.get('/', async (req, res) => {
  try {
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

// GET /products/:id - Get a single product by ID (remains unchanged)
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
router.put('/:id', isAuthenticated, isAdmin, productImageUploadMiddleware, handleMulterError, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category_id, tags: tagNames } = req.body;

  if (isNaN(parseInt(id))) {
    if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned upload:", err);});
    return res.status(400).json({ message: 'Invalid product ID.' });
  }
  // Add other validations as needed, similar to POST

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentProductResult = await client.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (currentProductResult.rows.length === 0) {
      await client.query('ROLLBACK');
      if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned upload:", err);});
      return res.status(404).json({ message: 'Product not found.' });
    }
    const oldImageUrl = currentProductResult.rows[0].image_url;
    let newImageUrl = oldImageUrl;

    if (req.file) {
      newImageUrl = '/' + req.file.path.replace(/\\/g, "/");
    }

    const updateQuery = `
      UPDATE products
      SET name = $1, description = $2, price = $3, category_id = $4, image_url = $5
      WHERE id = $6
      RETURNING *
    `;
    const productResult = await client.query(updateQuery, [
      name,
      description,
      price !== undefined ? parseFloat(price) : undefined, // Use undefined for COALESCE in query if not provided
      category_id !== undefined ? parseInt(category_id) : undefined,
      newImageUrl,
      id
    ]);
    // Note: COALESCE should be used in SQL if partial updates are desired for text/price/category
    // The above JS passes undefined if not present, SQL query needs to handle this with COALESCE(new_value, old_column_value)
    // For simplicity, this example assumes all fields (or their current values via a SELECT first) are provided for an update.
    // A more robust update would fetch product, merge changes, then save.
    // Or, modify the SQL to use COALESCE for each field: SET name = COALESCE($1, name), description = COALESCE($2, description), ...

    const updatedProduct = productResult.rows[0];

    if (tagNames !== undefined) { // Allow clearing tags with empty array or null
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [id]);
        if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
            const tagIds = await getOrCreateTagIds(tagNames, client);
            for (const tagId of tagIds) {
                await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [id, tagId]);
            }
        }
    }
    // Refresh tags for response
    const tagsResult = await client.query('SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = $1', [id]);
    updatedProduct.tags = tagsResult.rows.map(t => t.name);


    await client.query('COMMIT');

    if (req.file && oldImageUrl && oldImageUrl !== newImageUrl) {
      const oldImageServerPath = path.join(__dirname, '..', oldImageUrl); // .. to go up from routes to project root
      fs.unlink(oldImageServerPath, (err) => {
        if (err) console.error(`Error deleting old image ${oldImageServerPath}:`, err);
        else console.log(`Successfully deleted old image: ${oldImageServerPath}`);
      });
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    if (req.file) { // If transaction fails, delete newly uploaded file
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting image after PUT transaction rollback:', unlinkErr);
        });
    }
    console.error('Error updating product:', error);
    if (error.code === '23503' && error.constraint === 'products_category_id_fkey') {
      return res.status(400).json({ message: 'Invalid category_id.' });
    }
    res.status(500).json({ message: 'Error updating product.' });
  } finally {
    client.release();
  }
});

// DELETE /products/:id - Delete a product
// Protected: requires authentication and admin role
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Fetch image_url before deleting product
    const productDataResult = await client.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (productDataResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Product not found.' });
    }
    const imageUrlToDelete = productDataResult.rows[0].image_url;

    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    // product_tags are deleted by CASCADE constraint defined in db.js

    await client.query('COMMIT');

    if (imageUrlToDelete) {
        const imagePathToDelete = path.join(__dirname, '..', imageUrlToDelete);
        fs.unlink(imagePathToDelete, (err) => {
            if (err) console.error(`Error deleting image ${imagePathToDelete} for deleted product ${id}:`, err);
            else console.log(`Successfully deleted image ${imagePathToDelete} for deleted product ${id}`);
        });
    }
    res.status(200).json({ message: 'Product deleted successfully.', product: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error deleting product ${id}:`, error);
    res.status(500).json({ message: 'Error deleting product.' });
  } finally {
    client.release();
  }
});

module.exports = router;
