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
const { getOrCreateTagIds, getS3KeyFromUrl } = require('../utils/productHelpers'); // Import helpers
const taxService = require('../services/taxService'); // Import tax service

// GET /products - Get all products with filtering, sorting, and pagination
router.get('/', [
    query('search_term').optional().isString().trim(),
    query('category_id').optional().isInt({ gt: 0 }).toInt(),
    query('min_price').optional().isDecimal(),
    query('max_price').optional().isDecimal(),
    query('sort_by').optional().isString().trim(),
    query('optionValueId').optional().isInt({ gt: 0 }).toInt(), // New validator
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('on_sale').optional().isIn(['true', 'false']).toBoolean(),
    query('new_arrivals').optional().isIn(['true', 'false']).toBoolean()
  ],
  async (req, res, next) => {
    console.log('[DEBUG] /api/products route received query:', JSON.stringify(req.query)); // Log received query
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Map validation errors to a more structured format if desired
      return res.status(400).json({ errors: errors.array().map(e => ({ field: e.param, message: e.msg })) });
    }
  try {
    // Use validated and sanitized values from req.query
    const { search_term, category_id, min_price, max_price, sort_by, optionValueId, page, limit, on_sale, new_arrivals } = req.query; // Added on_sale here for clarity

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
      limit: parsedLimit,
      is_admin_request: false, // Ensure public access rules are applied
      stock_status: 'in_stock', // Add this line
      onSale: on_sale === 'true', // Add on_sale parameter
      newArrivals: new_arrivals === 'true' // Add new_arrivals parameter
    });

    // Transform the response
    res.status(200).json({
      products: result.products,
      pagination: {
        total_products: result.totalProducts,
        current_page: result.page,
        limit: result.limit,
        total_pages: result.totalPages,
        // Optional: hasNextPage and hasPrevPage can be derived by frontend or here
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1
      }
    });
  } catch (error)
 {
    next(error); // Pass errors to the global error handler
  }
});

// GET /api/products/best-sellers - Get best selling products
router.get('/best-sellers', [
    query('limit').optional().isInt({ min: 1, max: 20 }).toInt().default(8),
    // Potentially add query param for order status filter if needed by frontend:
    // query('order_statuses').optional().isString().customSanitizer(value => value.split(',').map(s => s.trim()))
  ], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array().map(e => ({ field: e.param, message: e.msg })) });
    }
    try {
      const { limit } = req.query;
      // const orderStatuses = req.query.order_statuses; // Example if using query param for status
      // For now, service uses default ['completed', 'shipped']
      const bestSellers = await productService.getBestSellingProducts(limit);
      res.status(200).json({ products: bestSellers });
    } catch (error) {
      next(error);
    }
});


// GET /api/products/pos - Get products with tax-inclusive prices for POS
router.get('/pos', async (req, res, next) => {
  try {
    const { limit = 100, page = 1, search, category_id, supplier_id } = req.query;
    
    // Use the existing getAllProducts service but with additional processing
    const productsResult = await productService.getAllProducts({
      limit: parseInt(limit),
      page: parseInt(page),
      search,
      category_id: category_id ? parseInt(category_id) : undefined,
      supplier_id: supplier_id ? parseInt(supplier_id) : undefined,
    });

    // Calculate tax-inclusive prices and include variants for each product
    const productsWithTaxAndVariants = await Promise.all(
      productsResult.products.map(async (product) => {
        const basePrice = parseFloat(product.price);
        let taxDetails = {
          basePrice: basePrice.toFixed(2),
          taxAmount: 0,
          priceWithTax: basePrice.toFixed(2),
          appliedRates: []
        };

        // Calculate tax if product has a tax class
        if (product.tax_class_id) {
          try {
            // Get system locale settings for tax calculation
            const systemSettings = await db.query(`
              SELECT setting_key, setting_value FROM site_settings 
              WHERE setting_key IN ('system_country', 'system_state', 'system_postal_code')
            `);
            
            let systemAddress = null;
            if (systemSettings.rows.length > 0) {
              const country = systemSettings.rows.find(row => row.setting_key === 'system_country')?.setting_value;
              const state = systemSettings.rows.find(row => row.setting_key === 'system_state')?.setting_value;
              const postalCode = systemSettings.rows.find(row => row.setting_key === 'system_postal_code')?.setting_value;
              
              if (country) {
                systemAddress = {
                  country: country,
                  state_province: state || null,
                  postalCode: postalCode || null
                };
              }
            }
            
            taxDetails = await taxService.calculatePriceWithAppliedTaxes(
              basePrice, 
              product.tax_class_id,
              systemAddress // Use system locale for tax calculation
            );
          } catch (taxError) {
            console.error(`Error calculating tax for product ${product.id}:`, taxError);
            // Keep default taxDetails if calculation fails
          }
        }

        // Get variants if product has them
        let variants = [];
        if (product.has_variants) {
          try {
            const fullProduct = await productService.getProductById(product.id);
            variants = fullProduct.variants || [];
            
            // Calculate tax for each variant
            variants = await Promise.all(variants.map(async (variant) => {
              const variantBasePrice = parseFloat(variant.final_price);
              let variantTaxDetails = {
                basePrice: variantBasePrice.toFixed(2),
                taxAmount: 0,
                priceWithTax: variantBasePrice.toFixed(2),
                appliedRates: []
              };

              if (product.tax_class_id) {
                try {
                  // Get system locale settings for tax calculation
                  const systemSettings = await db.query(`
                    SELECT setting_key, setting_value FROM site_settings 
                    WHERE setting_key IN ('system_country', 'system_state', 'system_postal_code')
                  `);
                  
                  let systemAddress = null;
                  if (systemSettings.rows.length > 0) {
                    const country = systemSettings.rows.find(row => row.setting_key === 'system_country')?.setting_value;
                    const state = systemSettings.rows.find(row => row.setting_key === 'system_state')?.setting_value;
                    const postalCode = systemSettings.rows.find(row => row.setting_key === 'system_postal_code')?.setting_value;
                    
                    if (country) {
                      systemAddress = {
                        country: country,
                        state_province: state || null,
                        postalCode: postalCode || null
                      };
                    }
                  }
                  
                  variantTaxDetails = await taxService.calculatePriceWithAppliedTaxes(
                    variantBasePrice,
                    product.tax_class_id,
                    systemAddress // Use system locale for tax calculation
                  );
                } catch (taxError) {
                  console.error(`Error calculating tax for variant ${variant.id}:`, taxError);
                }
              }

              // Get option values for this variant
              let optionValues = [];
              if (variant.option_value_ids && variant.option_value_ids.length > 0) {
                try {
                  optionValues = await getVariantOptionValues(variant.option_value_ids);
                } catch (optionError) {
                  console.error(`Error getting option values for variant ${variant.id}:`, optionError);
                }
              }

              return {
                ...variant,
                price: variantBasePrice,
                price_exclusive: parseFloat(variantTaxDetails.basePrice),
                price_inclusive: parseFloat(variantTaxDetails.priceWithTax),
                tax_amount: parseFloat(variantTaxDetails.taxAmount),
                applied_tax_rates: variantTaxDetails.appliedRates,
                display_price: parseFloat(variantTaxDetails.priceWithTax).toFixed(2),
                option_values: optionValues
              };
            }));
          } catch (variantError) {
            console.error(`Error loading variants for product ${product.id}:`, variantError);
          }
        }

        return {
          ...product,
          price_exclusive: parseFloat(taxDetails.basePrice),
          price_inclusive: parseFloat(taxDetails.priceWithTax),
          tax_amount: parseFloat(taxDetails.taxAmount),
          applied_tax_rates: taxDetails.appliedRates,
          display_price: parseFloat(taxDetails.priceWithTax).toFixed(2), // For display purposes
          variants: variants
        };
      })
    );

    res.status(200).json({
      data: productsWithTaxAndVariants,
      totalProducts: productsResult.totalProducts,
      page: productsResult.page,
      limit: productsResult.limit,
      totalPages: productsResult.totalPages
    });

  } catch (error) {
    next(error);
  }
});

// Helper function to get option values for variants
async function getVariantOptionValues(optionValueIds) {
  if (!optionValueIds || optionValueIds.length === 0) return [];
  
  const client = await db.pool.connect();
  try {
    const query = `
      SELECT value 
      FROM product_option_values 
      WHERE id = ANY($1)
      ORDER BY id ASC;
    `;
    const result = await client.query(query, [optionValueIds]);
    return result.rows.map(row => row.value);
  } finally {
    client.release();
  }
}

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
    stock_quantity, image_url: newImageUrlFromRequest, supplier_id, sku, reorder_threshold,
    brand_manufacturer, supplier_reference, product_status,
    cost_price, wholesale_price, tax_class_id, specifications // Add specifications
  } = req.body;

  if (isNaN(parseInt(id))) { return res.status(400).json({ message: 'Invalid product ID.' }); }

  const client = await db.pool.connect();
  let s3FileKeyToStore = null;
  let finalImageUrlToStoreInDb = undefined;
  let oldS3KeyToDelete = null;

  try {
    await client.query('BEGIN');
    const currentProductResult = await client.query('SELECT image_url, sku, has_variants, tax_class_id FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (currentProductResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Product not found.' }); }
    const currentProduct = currentProductResult.rows[0];
    finalImageUrlToStoreInDb = currentProduct.image_url;

    if (product_status !== undefined) {
      const validStatuses = ['active', 'inactive', 'archived'];
      if (typeof product_status !== 'string' || !validStatuses.includes(product_status.toLowerCase())) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid product_status. Must be one of: ${validStatuses.join(', ')}.` });
      }
    }

    let parsed_cost_price_update = undefined;
    if (cost_price !== undefined) {
      if (cost_price === null || cost_price === '') {
        parsed_cost_price_update = null;
      } else {
        parsed_cost_price_update = parseFloat(cost_price);
        if (isNaN(parsed_cost_price_update) || parsed_cost_price_update < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Cost price must be a non-negative number or null.' });
        }
      }
    }

    let parsed_wholesale_price_update = undefined;
    if (wholesale_price !== undefined) {
      if (wholesale_price === null || wholesale_price === '') {
        parsed_wholesale_price_update = null;
      } else {
        parsed_wholesale_price_update = parseFloat(wholesale_price);
        if (isNaN(parsed_wholesale_price_update) || parsed_wholesale_price_update < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Wholesale price must be a non-negative number or null.' });
        }
      }
    }

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
    // tax_class_id validation and clause addition
    if (tax_class_id !== undefined) {
        if (tax_class_id === null || tax_class_id === '') {
            addClause('tax_class_id', null);
        } else {
            const tcId = parseInt(tax_class_id);
            if (isNaN(tcId) || tcId <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Invalid tax_class_id format. Must be a positive integer or null/empty to clear.' });
            }
            const taxClassCheck = await client.query('SELECT id FROM tax_classes WHERE id = $1', [tcId]);
            if (taxClassCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Invalid tax_class_id: Tax class with ID ${tcId} not found.` });
            }
            addClause('tax_class_id', tcId, false, true);
        }
    }
    addClause('brand_manufacturer', brand_manufacturer);
    addClause('supplier_reference', supplier_reference);
    if (product_status !== undefined) {
        addClause('product_status', product_status.toLowerCase());
    }
    if (parsed_cost_price_update !== undefined) {
        addClause('cost_price', parsed_cost_price_update, true);
    }
    if (parsed_wholesale_price_update !== undefined) {
        addClause('wholesale_price', parsed_wholesale_price_update, true);
    }
    if (stock_quantity !== undefined) {
      if (currentProduct.has_variants) {
        console.warn(`Attempted to update base stock for product ${id} which has variants. Base stock update ignored.`);
      } else {
        const stock = parseInt(stock_quantity);
        if (isNaN(stock) || stock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Stock quantity must be a non-negative integer.'}); }
        addClause('stock_quantity', stock, false, true);
      }
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

    let parsedSpecificationsUpdate = undefined; // Important: use undefined if not provided
    if (specifications !== undefined) {
       if (specifications === null || (typeof specifications === 'string' && specifications.trim() === '')) {
           parsedSpecificationsUpdate = null; // Explicitly set to null
       } else if (typeof specifications === 'string') {
           try {
               parsedSpecificationsUpdate = JSON.parse(specifications);
               if (typeof parsedSpecificationsUpdate !== 'object' || parsedSpecificationsUpdate === null) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Specifications must be a valid JSON object string or a direct JSON object to update.' });
               }
           } catch (e) {
               await client.query('ROLLBACK');
               return res.status(400).json({ message: 'Invalid JSON string for specifications update.' });
           }
       } else if (typeof specifications === 'object') {
           parsedSpecificationsUpdate = specifications; // Already an object
       } else {
           await client.query('ROLLBACK');
           return res.status(400).json({ message: 'Specifications must be a valid JSON object string, a direct JSON object, or null/empty to clear for update.' });
       }
       addClause('specifications', parsedSpecificationsUpdate); // addClause handles JS objects for JSONB
    }

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
