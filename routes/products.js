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
    if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned upload due to validation fail:", err);});
    return res.status(400).json({ message: 'Name and price are required.' });
  }
  if (category_id && isNaN(parseInt(category_id))) {
    if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned upload due to validation fail:", err);});
    return res.status(400).json({ message: 'Valid category_id (integer) is required if provided.' });
  }

  let imageUrl = null;
  if (req.file) {
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

// GET /products - Get all products with filtering, sorting, and pagination
router.get('/', async (req, res) => {
  const {
    search_term,
    category_id,
    min_price,
    max_price,
    sort_by,
    page = 1,
    limit = 10
  } = req.query;

  const queryValues = [];
  let paramIndex = 1;

  let baseQuery = `
    SELECT p.id, p.name, p.description, p.price, p.category_id, p.image_url, p.stock_quantity, p.created_at,
           c.name as category_name,
           COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

  let countBaseQuery = `
    SELECT COUNT(DISTINCT p.id) as total_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

  let whereClauses = [];

  if (search_term) {
    whereClauses.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
    queryValues.push(`%${search_term}%`);
    paramIndex++;
  }
  if (category_id) {
    if (isNaN(parseInt(category_id))) return res.status(400).json({message: "Invalid category_id format."});
    whereClauses.push(`p.category_id = $${paramIndex}`);
    queryValues.push(parseInt(category_id));
    paramIndex++;
  }
  if (min_price) {
    if (isNaN(parseFloat(min_price))) return res.status(400).json({message: "Invalid min_price format."});
    whereClauses.push(`p.price >= $${paramIndex}`);
    queryValues.push(parseFloat(min_price));
    paramIndex++;
  }
  if (max_price) {
    if (isNaN(parseFloat(max_price))) return res.status(400).json({message: "Invalid max_price format."});
    whereClauses.push(`p.price <= $${paramIndex}`);
    queryValues.push(parseFloat(max_price));
    paramIndex++;
  }

  if (whereClauses.length > 0) {
    const whereString = " WHERE " + whereClauses.join(" AND ");
    baseQuery += whereString;
    countBaseQuery += whereString;
  }

  baseQuery += " GROUP BY p.id, c.name ";

  let orderByClause = " ORDER BY p.created_at DESC "; // Default sort
  const allowedSorts = {
    'price_asc': 'p.price ASC NULLS LAST', // Handle NULLS if price can be null
    'price_desc': 'p.price DESC NULLS LAST',
    'name_asc': 'p.name ASC',
    'name_desc': 'p.name DESC',
    'created_at_desc': 'p.created_at DESC',
    'created_at_asc': 'p.created_at ASC',
  };
  if (sort_by && allowedSorts[sort_by]) {
    orderByClause = ` ORDER BY ${allowedSorts[sort_by]} `;
  } else if (sort_by && !allowedSorts[sort_by]) {
    return res.status(400).json({message: "Invalid sort_by parameter."});
  }
  baseQuery += orderByClause;

  const numPage = parseInt(page);
  const numLimit = parseInt(limit);
  if (isNaN(numPage) || numPage < 1) return res.status(400).json({message: "Invalid page number."});
  if (isNaN(numLimit) || numLimit < 1 || numLimit > 100) return res.status(400).json({message: "Invalid limit value (must be 1-100)."});
  const offset = (numPage - 1) * numLimit;

  baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1} `;
  const finalQueryValues = [...queryValues, numLimit, offset];

  try {
    const productsResult = await db.query(baseQuery, finalQueryValues);
    const countResult = await db.query(countBaseQuery, queryValues); // queryValues for count doesn't include limit/offset

    const totalProducts = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalProducts / numLimit);

    res.status(200).json({
      products: productsResult.rows,
      pagination: {
        total_products: totalProducts,
        current_page: numPage,
        limit: numLimit,
        total_pages: totalPages,
      }
    });
  } catch (error) {
    console.error('Error getting products with filters:', error);
    res.status(500).json({ message: 'Error getting products.' });
  }
});

// GET /products/:id - Get a single product by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT p.*, c.name as category_name, COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
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

    // Build SET clause dynamically for partial updates
    const setClauses = [];
    const queryUpdateValues = [];
    let currentParamIndex = 1;

    if (name !== undefined) {
        setClauses.push(`name = $${currentParamIndex++}`);
        queryUpdateValues.push(name);
    }
    if (description !== undefined) {
        setClauses.push(`description = $${currentParamIndex++}`);
        queryUpdateValues.push(description);
    }
    if (price !== undefined) {
        setClauses.push(`price = $${currentParamIndex++}`);
        queryUpdateValues.push(parseFloat(price));
    }
    if (category_id !== undefined) {
        setClauses.push(`category_id = $${currentParamIndex++}`);
        queryUpdateValues.push(category_id === null ? null : parseInt(category_id));
    }
    if (req.file || (newImageUrl === null && oldImageUrl !== null) ) { // if new image uploaded or image explicitly set to null
        setClauses.push(`image_url = $${currentParamIndex++}`);
        queryUpdateValues.push(newImageUrl);
    }

    if (setClauses.length === 0 && tagNames === undefined) { // No actual fields to update and no tags to update
        await client.query('ROLLBACK'); // Or COMMIT if no change is fine
        // Return current product data or a 304 Not Modified
        const productData = await client.query( `
            SELECT p.*, c.name as category_name, COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_tags pt ON p.id = pt.product_id
            LEFT JOIN tags t ON pt.tag_id = t.id
            WHERE p.id = $1
            GROUP BY p.id, c.name;
        `, [id]);
        return res.status(200).json(productData.rows[0]);
    }


    if (setClauses.length > 0) {
        const updateQuery = `
          UPDATE products
          SET ${setClauses.join(", ")}
          WHERE id = $${currentParamIndex}
          RETURNING *
        `;
        queryUpdateValues.push(id);
        const productResult = await client.query(updateQuery, queryUpdateValues);
        // updatedProduct = productResult.rows[0]; // Will be fetched later for consistent tag data
    }


    if (tagNames !== undefined) {
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [id]);
        if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
            const tagIds = await getOrCreateTagIds(tagNames, client);
            for (const tagId of tagIds) {
                await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [id, tagId]);
            }
        }
    }

    // Fetch the product again to get updated tags and consistent data structure
    const finalProductQuery = `
        SELECT p.*, c.name as category_name, COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE p.id = $1
        GROUP BY p.id, c.name;
    `;
    const finalProductResult = await client.query(finalProductQuery, [id]);
    const updatedProduct = finalProductResult.rows[0];


    await client.query('COMMIT');

    if (req.file && oldImageUrl && oldImageUrl !== newImageUrl) {
      const oldImageServerPath = path.join(__dirname, '..', oldImageUrl);
      fs.unlink(oldImageServerPath, (err) => {
        if (err) console.error(`Error deleting old image ${oldImageServerPath}:`, err);
        else console.log(`Successfully deleted old image: ${oldImageServerPath}`);
      });
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    if (req.file) {
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
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const productDataResult = await client.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (productDataResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Product not found.' });
    }
    const imageUrlToDelete = productDataResult.rows[0].image_url;

    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

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
