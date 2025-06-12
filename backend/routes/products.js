const express = require('express');
const router = express.Router();
const db = require('../db'); // Kept for other routes, but not used by GET /products
const { BadRequestError, NotFoundError } = require('../utils/AppError');
const productService = require('../services/productService'); // Import product service
const { isAuthenticated, isAdmin } = require('../auth');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service');
const path = require('path');
const { query, validationResult } = require('express-validator'); // Import express-validator

// Helper function to get or create tag IDs
async function getOrCreateTagIds(tagNames, client) {
  const tagIds = [];
  if (!tagNames || tagNames.length === 0) { return tagIds; }
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

// Helper function to parse S3 Key from URL
function getS3KeyFromUrl(url) {
    if (!url) return null;
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.substring(1) : parsedUrl.pathname;
    } catch (error) {
        console.warn("Could not parse S3 URL, might be a local path or already a key:", url, error);
        if (url.startsWith('product-images/') || url.startsWith('/uploads/')) {
             return url.startsWith('/') ? url.substring(1) : url;
        }
        return null;
    }
}

// POST /products - Create a new product
router.post('/', isAuthenticated, isAdmin, productImageUploadMiddleware, handleMulterError, async (req, res) => {
  const {
    name, description, price, category_id, tags: tagNames,
    stock_quantity = 0, supplier_id, sku, reorder_threshold
  } = req.body;

  if (!name || price === undefined) { return res.status(400).json({ message: 'Name and price are required.' }); }
  if (category_id !== undefined && category_id !== null && isNaN(parseInt(category_id))) { return res.status(400).json({ message: 'Valid category_id (integer or null) is required if provided.' });}
  const stock = parseInt(stock_quantity);
  if (isNaN(stock) || stock < 0) { return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.' });}
  if (supplier_id !== undefined && supplier_id !== null && isNaN(parseInt(supplier_id))) { return res.status(400).json({ message: 'Valid supplier_id (integer or null) is required if provided.' });}
  if (reorder_threshold !== undefined && reorder_threshold !== null) {
    const rt = parseInt(reorder_threshold);
    if (isNaN(rt) || rt < 0) { return res.status(400).json({ message: 'Reorder threshold must be a non-negative integer if provided.' }); }
  }

  let imageUrl = null; let s3FileKey = null;
  if (req.file) {
    if (isS3Configured()) {
      try {
        const uniqueFileName = `product-images/product-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
        const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
        imageUrl = s3Data.Location; s3FileKey = s3Data.Key;
      } catch (s3Error) { console.error("S3 Upload Error on product creation:", s3Error); return res.status(500).json({ message: "Failed to upload image to S3." }); }
    } else {
      console.warn("Attempted to upload image, but S3 is not configured. Product will be created without an image.");
      imageUrl = null;
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const productQuery = `
      INSERT INTO products (name, description, price, category_id, image_url, stock_quantity, supplier_id, sku, reorder_threshold, updated_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING * `;
    const productResult = await client.query(productQuery, [
      name, description, parseFloat(price), category_id ? parseInt(category_id) : null, imageUrl, stock,
      supplier_id ? parseInt(supplier_id) : null, sku || null,
      reorder_threshold !== undefined && reorder_threshold !== null ? parseInt(reorder_threshold) : null
    ]);
    const newProduct = productResult.rows[0];

    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client);
      for (const tagId of tagIds) { await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [newProduct.id, tagId]); }
      const tagsResult = await client.query('SELECT t.name FROM tags t JOIN product_tags pt ON t.id = pt.tag_id WHERE pt.product_id = $1', [newProduct.id]);
      newProduct.tags = tagsResult.rows.map(t => t.name);
    } else { newProduct.tags = []; }

    await client.query('COMMIT');
    res.status(201).json(newProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    if (s3FileKey && isS3Configured()) {
      try { await deleteFileFromS3(s3FileKey); console.log(`Rolled back S3 upload for key: ${s3FileKey} due to DB error.`); }
      catch (s3DeleteError) { console.error(`Failed to rollback S3 upload for key ${s3FileKey}:`, s3DeleteError); }
    }
    console.error('Error creating product:', error);
    if (error.code === '23505' && (error.constraint === 'products_sku_key' || error.constraint === 'product_variants_sku_key')) { // Check both product and variant SKU constraints
        return res.status(409).json({ message: `SKU "${sku}" already exists.` });
    }
    if (error.code === '23503' && error.constraint === 'products_category_id_fkey') { return res.status(400).json({ message: 'Invalid category_id.' });}
    if (error.code === '23503' && error.constraint === 'products_supplier_id_fkey') { return res.status(400).json({ message: 'Invalid supplier_id.' });}
    res.status(500).json({ message: 'Error creating product.' });
  } finally { client.release(); }
});

// GET /products - Get all products with filtering, sorting, and pagination
router.get('/', [
    query('search_term').optional().isString().trim(),
    query('category_id').optional().isInt({ gt: 0 }).toInt(),
    query('min_price').optional().isDecimal(),
    query('max_price').optional().isDecimal(),
    query('sort_by').optional().isString().trim(),
    query('optionValueId').optional().isInt({ gt: 0 }).toInt(), // New validator
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Map validation errors to a more structured format if desired
      return res.status(400).json({ errors: errors.array().map(e => ({ field: e.param, message: e.msg })) });
    }
  try {
    // Use validated and sanitized values from req.query
    const { search_term, category_id, min_price, max_price, sort_by, optionValueId, page, limit } = req.query;

    // Validation and Parsing (some parsing already handled by express-validator's toInt/toFloat)
    // Re-parsing might not be strictly necessary if trusting express-validator output, but explicit parsing ensures type.
    let parsedPage = page; // Already an int due to .toInt().default(1)
    let parsedLimit = limit; // Already an int due to .toInt().default(10)
    let parsedCategoryId = category_id; // Already an int or undefined
    let parsedMinPrice = min_price ? parseFloat(min_price) : undefined; // parseFloat for decimals
    let parsedMaxPrice = max_price ? parseFloat(max_price) : undefined;
    let parsedOptionValueId = optionValueId; // Already an int or undefined

    // Additional custom validation not easily covered by express-validator (like min_price <= max_price)
    if (parsedMinPrice !== undefined && parsedMaxPrice !== undefined && parsedMinPrice > parsedMaxPrice) {
      throw new BadRequestError('min_price cannot be greater than max_price.');
    }

    // sort_by validation is handled by the service, which might throw BadRequestError if invalid

    const result = await productService.getAllProducts({
      searchTerm: search_term,
      categoryId: parsedCategoryId,
      minPrice: parsedMinPrice,
      maxPrice: parsedMaxPrice,
      sortBy: sort_by,
      optionValueId: parsedOptionValueId, // Pass to service
      page: parsedPage,
      limit: parsedLimit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
});

// GET /products/:id - Get a single product by ID with variants
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);

    if (isNaN(productId) || productId < 1) {
      throw new BadRequestError('Invalid product ID format. Must be a positive integer.');
    }

    const product = await productService.getProductById(productId);
    // NotFoundError will be thrown by the service if product is not found, and caught here.
    res.status(200).json(product);
  } catch (error) {
    next(error); // Pass errors (including NotFoundError from service) to global error handler
  }
});


// PUT /products/:id - Update a product
router.put('/:id', isAuthenticated, isAdmin, productImageUploadMiddleware, handleMulterError, async (req, res) => {
  const { id } = req.params;
  const {
    name, description, price, category_id, tags: tagNames,
    stock_quantity, image_url: newImageUrlFromRequest, supplier_id, sku, reorder_threshold
  } = req.body;

  if (isNaN(parseInt(id))) { return res.status(400).json({ message: 'Invalid product ID.' }); }

  const client = await db.pool.connect();
  let s3FileKeyToStore = null;
  let finalImageUrlToStoreInDb = undefined;
  let oldS3KeyToDelete = null;

  try {
    await client.query('BEGIN');
    const currentProductResult = await client.query('SELECT image_url, sku FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (currentProductResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Product not found.' }); }
    const currentProduct = currentProductResult.rows[0];
    finalImageUrlToStoreInDb = currentProduct.image_url;

    if (req.file) {
      if (isS3Configured()) {
        try {
          const uniqueFileName = `product-images/product-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
          const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
          finalImageUrlToStoreInDb = s3Data.Location; s3FileKeyToStore = s3Data.Key;
          if (currentProduct.image_url) { oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url); }
        } catch (s3Error) { await client.query('ROLLBACK'); console.error("S3 Upload Error on product update:", s3Error); return res.status(500).json({ message: "Failed to upload new image to S3." }); }
      } else { await client.query('ROLLBACK'); console.warn("Attempted to upload new image, but S3 is not configured."); return res.status(500).json({ message: "Image upload service is not configured." }); }
    } else if (newImageUrlFromRequest === null && currentProduct.image_url) {
      if (isS3Configured()) { oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url); }
      finalImageUrlToStoreInDb = null;
    }

    const setClauses = []; const queryUpdateValues = []; let currentParamIndex = 1;
    const addClause = (field, value, isNumeric = false, isInt = false) => {
      if (value !== undefined) {
        setClauses.push(`${field} = $${currentParamIndex++}`);
        if (value === null) queryUpdateValues.push(null);
        else if (isNumeric) queryUpdateValues.push(parseFloat(value));
        else if (isInt) queryUpdateValues.push(parseInt(value));
        else queryUpdateValues.push(value);
      }
    };

    addClause('name', name); addClause('description', description); addClause('price', price, true);
    addClause('category_id', category_id, false, true);
    if (stock_quantity !== undefined) {
      const stock = parseInt(stock_quantity);
      if (isNaN(stock) || stock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.'}); }
      addClause('stock_quantity', stock, false, true);
    }
    addClause('supplier_id', supplier_id, false, true);
    const finalSku = sku === '' ? null : sku; // Allow unsetting SKU with empty string
    if (sku !== undefined) { addClause('sku', finalSku); }

    if (reorder_threshold !== undefined) {
        const rt = reorder_threshold === null || reorder_threshold === '' ? null : parseInt(reorder_threshold);
        if (rt !== null && (isNaN(rt) || rt < 0)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Reorder threshold must be a non-negative integer or null.' });}
        addClause('reorder_threshold', rt, false, true);
    }
    if (req.file || newImageUrlFromRequest === null) { addClause('image_url', finalImageUrlToStoreInDb); }

    let updatedProduct = currentProduct; // Start with current, overwrite with fetched if update happens

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      const updateQuery = `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${currentParamIndex} RETURNING id`;
      queryUpdateValues.push(id);
      const updateResult = await client.query(updateQuery, queryUpdateValues);
      if (updateResult.rowCount === 0) { // Should not happen due to previous check and FOR UPDATE
          await client.query('ROLLBACK'); return res.status(404).json({ message: 'Product update failed unexpectedly.'});
      }
    }

    if (tagNames !== undefined) {
      await client.query('DELETE FROM product_tags WHERE product_id = $1', [id]);
      if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
        const tagIds = await getOrCreateTagIds(tagNames, client);
        for (const tagId of tagIds) { await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [id, tagId]); }
      }
       // If setClauses was empty but tags changed, we still need to update updated_at
       if (setClauses.length === 0) {
           await client.query('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
       }
    }

    // Re-fetch the product with all joins for consistent response
    const finalProductQuery = `
        SELECT p.*, c.name as category_name, s.name as supplier_name,
               COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags,
               EXISTS(SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id) AS has_variants
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE p.id = $1 GROUP BY p.id, c.name, s.name;
    `;
    const finalProductResult = await client.query(finalProductQuery, [id]);
    updatedProduct = finalProductResult.rows[0];

    await client.query('COMMIT');

    if (oldS3KeyToDelete && isS3Configured()) {
      try { await deleteFileFromS3(oldS3KeyToDelete); console.log(`Successfully deleted old S3 image: ${oldS3KeyToDelete}`); }
      catch (s3DeleteError) { console.error(`Failed to delete old S3 image ${oldS3KeyToDelete}:`, s3DeleteError); }
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    if (s3FileKeyToStore && isS3Configured()) {
      try { await deleteFileFromS3(s3FileKeyToStore); console.log(`Rolled back S3 upload for key: ${s3FileKeyToStore} due to DB error on update.`); }
      catch (s3DeleteError) { console.error(`Failed to rollback S3 upload for key ${s3FileKeyToStore} on update:`, s3DeleteError); }
    }
    console.error('Error updating product:', error);
    if (error.code === '23505' && (error.constraint === 'products_sku_key' || error.constraint === 'product_variants_sku_key')) {
        return res.status(409).json({ message: `SKU "${sku}" already exists.` });
    }
    res.status(500).json({ message: 'Error updating product.' });
  } finally { client.release(); }
});


// DELETE /products/:id - Delete a product
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) { return res.status(400).json({ message: 'Invalid product ID.' }); }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const productDataResult = await client.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (productDataResult.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Product not found.' }); }
    const imageUrlToDelete = productDataResult.rows[0].image_url;
    const s3KeyToDelete = getS3KeyFromUrl(imageUrlToDelete);

    // ON DELETE CASCADE for product_options, product_variants, product_tags will handle related deletions.
    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    await client.query('COMMIT');

    if (s3KeyToDelete && isS3Configured()) {
      try { await deleteFileFromS3(s3KeyToDelete); console.log(`Successfully deleted S3 image ${s3KeyToDelete} for deleted product ${id}`); }
      catch (s3DeleteError) { console.error(`Error deleting S3 image ${s3KeyToDelete} for deleted product ${id}:`, s3DeleteError); }
    }
    res.status(200).json({ message: 'Product deleted successfully.', product: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error deleting product ${id}:`, error);
    // Handle potential FK issues if ON DELETE RESTRICT was used elsewhere for products.id
    if (error.code === '23503') { // foreign_key_violation
        return res.status(409).json({ message: 'Cannot delete product: It is referenced in other records (e.g., order items, PO items). Please remove those references first.' });
    }
    res.status(500).json({ message: 'Error deleting product.' });
  } finally { client.release(); }
});

module.exports = router;
