const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service');
const path = require('path');

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
router.get('/', async (req, res) => {
  const { search_term, category_id, min_price, max_price, sort_by, page = 1, limit = 10 } = req.query;
  const queryValues = []; let paramIndex = 1;

  let baseSelect = `
    SELECT p.id, p.name, p.description, p.price, p.category_id, p.image_url,
           p.stock_quantity, p.sku, p.supplier_id, p.reorder_threshold, p.created_at, p.updated_at,
           c.name as category_name,
           s.name as supplier_name,
           COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags,
           EXISTS(SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id) AS has_variants
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;
  let countBaseQuery = `SELECT COUNT(DISTINCT p.id) as total_count FROM products p `;

  let whereClauses = [];
  if (search_term) { whereClauses.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`); queryValues.push(`%${search_term}%`); paramIndex++; }
  if (category_id) { if (isNaN(parseInt(category_id))) return res.status(400).json({message: "Invalid category_id format."}); whereClauses.push(`p.category_id = $${paramIndex}`); queryValues.push(parseInt(category_id)); paramIndex++; }
  if (min_price) { if (isNaN(parseFloat(min_price))) return res.status(400).json({message: "Invalid min_price format."}); whereClauses.push(`p.price >= $${paramIndex}`); queryValues.push(parseFloat(min_price)); paramIndex++; }
  if (max_price) { if (isNaN(parseFloat(max_price))) return res.status(400).json({message: "Invalid max_price format."}); whereClauses.push(`p.price <= $${paramIndex}`); queryValues.push(parseFloat(max_price)); paramIndex++; }

  if (whereClauses.length > 0) {
    const whereString = " WHERE " + whereClauses.join(" AND ");
    baseSelect += whereString; // Apply to main query
    // For count query, only add WHERE clauses related to 'p' table directly if not joining for filters
    // If category_id filter is active, join is needed for count.
    if (category_id) { countBaseQuery += `LEFT JOIN categories c ON p.category_id = c.id `; }
    // For this setup, assume all filters might need their respective joins in count for accuracy, or simplify if not.
    // The provided count query already had some joins, let's keep it simple for now:
    countBaseQuery += whereString;
  }

  baseSelect += " GROUP BY p.id, c.name, s.name ";

  let orderByClause = " ORDER BY p.created_at DESC ";
  const allowedSorts = {'price_asc': 'p.price ASC NULLS LAST', 'price_desc': 'p.price DESC NULLS LAST', 'name_asc': 'p.name ASC', 'name_desc': 'p.name DESC', 'created_at_desc': 'p.created_at DESC', 'created_at_asc': 'p.created_at ASC'};
  if (sort_by && allowedSorts[sort_by]) { orderByClause = ` ORDER BY ${allowedSorts[sort_by]} `; }
  else if (sort_by && !allowedSorts[sort_by]) { return res.status(400).json({message: "Invalid sort_by parameter."}); }
  baseSelect += orderByClause;

  const numPage = parseInt(page); const numLimit = parseInt(limit);
  if (isNaN(numPage) || numPage < 1) return res.status(400).json({message: "Invalid page number."});
  if (isNaN(numLimit) || numLimit < 1 || numLimit > 100) return res.status(400).json({message: "Invalid limit value (must be 1-100)."});
  const offset = (numPage - 1) * numLimit;

  baseSelect += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1} `;
  const finalQueryValues = [...queryValues, numLimit, offset];

  try {
    const productsResult = await db.query(baseSelect, finalQueryValues);
    const countResult = await db.query(countBaseQuery, queryValues);
    const totalProducts = parseInt(countResult.rows[0].total_count);
    res.status(200).json({
      products: productsResult.rows,
      pagination: { total_products: totalProducts, current_page: numPage, limit: numLimit, total_pages: Math.ceil(totalProducts / numLimit) }
    });
  } catch (error) { console.error('Error getting products with filters:', error); res.status(500).json({ message: 'Error getting products.' }); }
});

// Helper: Get variant selected options (can be moved to a shared service if used elsewhere)
async function getVariantSelectedOptions(variantId, client) {
    const query = `
        SELECT pov.id as option_value_id, pov.value as value_name,
               po.id as option_id, po.name as option_name
        FROM product_variant_option_values pvov
        JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
        JOIN product_options po ON pov.product_option_id = po.id
        WHERE pvov.product_variant_id = $1
        ORDER BY po.name, pov.value;
    `;
    const result = await client.query(query, [variantId]);
    return result.rows;
}

// GET /products/:id - Get a single product by ID with variants
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) { return res.status(400).json({ message: 'Invalid product ID format.' }); }

  const client = await db.pool.connect();
  try {
    const productQuery = `
      SELECT p.*,
             c.name as category_name,
             s.name as supplier_name,
             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, c.name, s.name;
    `;
    const productResult = await client.query(productQuery, [id]);
    if (productResult.rows.length === 0) { return res.status(404).json({ message: `Product with ID ${id} not found.` }); }
    const product = productResult.rows[0];

    const optionsQuery = `
      SELECT po.id, po.name,
             COALESCE(json_agg(json_build_object('id', pov.id, 'value', pov.value) ORDER BY pov.value) FILTER (WHERE pov.id IS NOT NULL), '[]'::json) AS "values"
      FROM product_options po
      LEFT JOIN product_option_values pov ON po.id = pov.product_option_id
      WHERE po.product_id = $1
      GROUP BY po.id, po.name ORDER BY po.name ASC;
    `;
    const optionsResult = await client.query(optionsQuery, [id]);
    product.options = optionsResult.rows;

    const variantsQuery = `
      SELECT id, sku, price_modifier, stock_quantity, image_url
      FROM product_variants WHERE product_id = $1 ORDER BY id ASC;
    `;
    const variantsResult = await client.query(variantsQuery, [id]);
    product.variants = variantsResult.rows;

    for (const variant of product.variants) {
      variant.selected_options = await getVariantSelectedOptions(variant.id, client);
      variant.final_price = (parseFloat(product.price) + parseFloat(variant.price_modifier)).toFixed(2);
    }

    res.status(200).json(product);
  } catch (error) { console.error(`Error getting product by ID ${id} with variants:`, error); res.status(500).json({ message: 'Error getting product details.' });
  } finally { if (client) client.release(); }
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
