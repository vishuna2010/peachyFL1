const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service');
const path = require('path'); // For parsing S3 keys from URLs if needed.

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

// POST /products - Create a new product with S3 Upload
router.post('/', isAuthenticated, isAdmin, productImageUploadMiddleware, handleMulterError, async (req, res) => {
  const { name, description, price, category_id, tags: tagNames, stock_quantity = 0 } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Name and price are required.' });
  }
  if (category_id && isNaN(parseInt(category_id))) {
    return res.status(400).json({ message: 'Valid category_id (integer) is required if provided.' });
  }
  const stock = parseInt(stock_quantity);
  if (isNaN(stock) || stock < 0) {
    return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.' });
  }


  let imageUrl = null;
  let s3FileKey = null;

  if (req.file) {
    if (isS3Configured()) {
      try {
        const uniqueFileName = `product-images/product-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
        const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
        imageUrl = s3Data.Location; // Use S3 URL
        s3FileKey = s3Data.Key;
      } catch (s3Error) {
        console.error("S3 Upload Error on product creation:", s3Error);
        return res.status(500).json({ message: "Failed to upload image to S3." });
      }
    } else {
      console.warn("Attempted to upload image, but S3 is not configured. Product will be created without an image.");
      // Option A: Fail if image provided but S3 not configured
      // return res.status(500).json({ message: "Image upload service is not configured. Cannot process product with image." });
      // Option B: Proceed without image (current choice by setting imageUrl to null)
      imageUrl = null;
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const productQuery = `
      INSERT INTO products (name, description, price, category_id, image_url, stock_quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const productResult = await client.query(productQuery, [name, description, parseFloat(price), category_id ? parseInt(category_id) : null, imageUrl, stock]);
    const newProduct = productResult.rows[0];

    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client);
      for (const tagId of tagIds) {
        await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [newProduct.id, tagId]);
      }
      // Fetch tags for consistent response
      const tagsResult = await client.query('SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = $1', [newProduct.id]);
      newProduct.tags = tagsResult.rows.map(t => t.name);
    } else {
      newProduct.tags = [];
    }

    await client.query('COMMIT');
    res.status(201).json(newProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    if (s3FileKey && isS3Configured()) { // If DB transaction failed after S3 upload
      try {
        await deleteFileFromS3(s3FileKey);
        console.log(`Rolled back S3 upload for key: ${s3FileKey} due to DB error.`);
      } catch (s3DeleteError) {
        console.error(`Failed to rollback S3 upload for key ${s3FileKey}:`, s3DeleteError);
      }
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

// GET /products - Get all products with filtering, sorting, and pagination (as previously updated)
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

  let orderByClause = " ORDER BY p.created_at DESC ";
  const allowedSorts = {
    'price_asc': 'p.price ASC NULLS LAST',
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
    const countResult = await db.query(countBaseQuery, queryValues);

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

// GET /products/:id - Get a single product by ID (includes stock_quantity due to p.*)
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

// Helper function to parse S3 Key from URL
functiongetS3KeyFromUrl(url) {
    if (!url) return null;
    try {
        const parsedUrl = new URL(url);
        // Key is the pathname without the leading slash
        return parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.substring(1) : parsedUrl.pathname;
    } catch (error) {
        console.error("Error parsing S3 URL to get key:", error);
        // If it's not a valid URL, it might be a local path or already a key (though less likely for image_url)
        // For robustness, one might check if it looks like a path (e.g., starts with 'product-images/')
        if (url.startsWith('product-images/') || url.startsWith('/uploads/')) { // Basic check
             console.warn("Treating image_url as a potential key or local path:", url);
             return url.startsWith('/') ? url.substring(1) : url; // Attempt to treat as key
        }
        return null;
    }
}


// PUT /products/:id - Update a product with S3 Upload
router.put('/:id', isAuthenticated, isAdmin, productImageUploadMiddleware, handleMulterError, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category_id, tags: tagNames, stock_quantity, image_url: newImageUrlFromRequest } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  const client = await db.pool.connect();
  let s3FileKeyToStore = null; // This will be the S3 Key if a new file is uploaded
  let finalImageUrlToStoreInDb = null; // This will be the S3 URL or null
  let oldS3KeyToDelete = null;

  try {
    await client.query('BEGIN');

    const currentProductResult = await client.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (currentProductResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Product not found.' });
    }
    const currentImageUrl = currentProductResult.rows[0].image_url;
    finalImageUrlToStoreInDb = currentImageUrl; // Assume current image initially

    if (req.file) { // New image uploaded
      if (isS3Configured()) {
        try {
          const uniqueFileName = `product-images/product-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
          const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
          finalImageUrlToStoreInDb = s3Data.Location;
          s3FileKeyToStore = s3Data.Key; // Keep track in case of rollback
          if (currentImageUrl) {
            oldS3KeyToDelete = getS3KeyFromUrl(currentImageUrl);
          }
        } catch (s3Error) {
          await client.query('ROLLBACK');
          console.error("S3 Upload Error on product update:", s3Error);
          return res.status(500).json({ message: "Failed to upload new image to S3." });
        }
      } else {
        await client.query('ROLLBACK');
        console.warn("Attempted to upload new image, but S3 is not configured.");
        return res.status(500).json({ message: "Image upload service is not configured." });
      }
    } else if (newImageUrlFromRequest === null && currentImageUrl) {
      // Explicitly setting image to null, so delete existing S3 image
      if (isS3Configured()) {
         oldS3KeyToDelete = getS3KeyFromUrl(currentImageUrl);
      }
      finalImageUrlToStoreInDb = null;
    }
    // If no req.file and newImageUrlFromRequest is not null, it means image_url is not being changed (or client sends existing URL)
    // In that case, finalImageUrlToStoreInDb remains currentImageUrl.

    const setClauses = [];
    const queryUpdateValues = [];
    let currentParamIndex = 1;

    if (name !== undefined) { setClauses.push(`name = $${currentParamIndex++}`); queryUpdateValues.push(name); }
    if (description !== undefined) { setClauses.push(`description = $${currentParamIndex++}`); queryUpdateValues.push(description); }
    if (price !== undefined) { setClauses.push(`price = $${currentParamIndex++}`); queryUpdateValues.push(parseFloat(price)); }
    if (category_id !== undefined) { setClauses.push(`category_id = $${currentParamIndex++}`); queryUpdateValues.push(category_id === null ? null : parseInt(category_id)); }
    if (stock_quantity !== undefined) {
      const stock = parseInt(stock_quantity);
      if (isNaN(stock) || stock < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.'});
      }
      setClauses.push(`stock_quantity = $${currentParamIndex++}`);
      queryUpdateValues.push(stock);
    }
    // Only update image_url if a new file was uploaded OR if it was explicitly set to null
    if (req.file || newImageUrlFromRequest === null) {
        setClauses.push(`image_url = $${currentParamIndex++}`);
        queryUpdateValues.push(finalImageUrlToStoreInDb);
    }

    if (setClauses.length > 0) {
      const updateQuery = `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${currentParamIndex} RETURNING *`;
      queryUpdateValues.push(id);
      await client.query(updateQuery, queryUpdateValues);
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

    const finalProductQuery = `
        SELECT p.*, c.name as category_name, COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
        FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN product_tags pt ON p.id = pt.product_id LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE p.id = $1 GROUP BY p.id, c.name;
    `;
    const finalProductResult = await client.query(finalProductQuery, [id]);

    await client.query('COMMIT');

    if (oldS3KeyToDelete && isS3Configured()) {
      try {
        await deleteFileFromS3(oldS3KeyToDelete);
        console.log(`Successfully deleted old S3 image: ${oldS3KeyToDelete}`);
      } catch (s3DeleteError) {
        console.error(`Failed to delete old S3 image ${oldS3KeyToDelete}:`, s3DeleteError);
        // Log this error, but the main product update was successful.
      }
    }
    res.status(200).json(finalProductResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (s3FileKeyToStore && isS3Configured()) { // If a new file was uploaded to S3 before DB error
      try {
        await deleteFileFromS3(s3FileKeyToStore);
        console.log(`Rolled back S3 upload for key: ${s3FileKeyToStore} due to DB error on update.`);
      } catch (s3DeleteError) {
        console.error(`Failed to rollback S3 upload for key ${s3FileKeyToStore} on update:`, s3DeleteError);
      }
    }
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product.' });
  } finally {
    client.release();
  }
});


// DELETE /products/:id - Delete a product with S3 Image Deletion
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
    const s3KeyToDelete = getS3KeyFromUrl(imageUrlToDelete);

    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    await client.query('COMMIT');

    if (s3KeyToDelete && isS3Configured()) {
      try {
        await deleteFileFromS3(s3KeyToDelete);
        console.log(`Successfully deleted S3 image ${s3KeyToDelete} for deleted product ${id}`);
      } catch (s3DeleteError) {
        console.error(`Error deleting S3 image ${s3KeyToDelete} for deleted product ${id}:`, s3DeleteError);
        // Log error, but product deletion from DB was successful.
      }
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
