const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const productService = require('../services/productService');
const { query, param, validationResult } = require('express-validator');
const { NotFoundError } = require('../utils/AppError');
const { generateProductLabelPdf } = require('../services/pdfService'); // Ensured at top


// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// Validators for GET /api/admin/products
const validateGetProductsParams = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
  query('search_term').optional().isString().trim(),
  query('category_id').optional().isInt({ gt: 0 }).toInt(),
  query('sort_by').optional().isString().trim(), // Specific validation is done in productService
  query('status').optional().isString().trim().isIn(['active', 'draft', 'archived', 'all', 'inactive']).default('all'), // 'inactive' is alias for 'draft' perhaps, or its own state. 'all' means no status filter.
  query('stock_status').optional().isString().trim().isIn(['in_stock', 'out_of_stock', 'low_stock', 'all']).default('all'),
  // ensure sort_order is also accepted if sent by client, even if productService has a default
  query('sort_order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).toUpperCase(),
];

// GET /api/admin/products - List all products (admin)
router.get('/', validateGetProductsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      search_term: req.query.search_term,
      category_id: req.query.category_id,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order, // Pass this to service
      status: req.query.status === 'all' ? undefined : req.query.status, // productService should handle undefined as "no filter"
      stock_status: req.query.stock_status === 'all' ? undefined : req.query.stock_status, // productService should handle this
      include_variants: true, // Admin list likely wants to know about variants
      include_total_stock: true, // For products with variants, sum up variant stock
      is_admin_request: true, // Flag for service layer if special logic needed
    };

    const result = await productService.getAllProducts(options);

    // productService.getAllProducts is expected to return { products, totalProducts, page, limit, totalPages }
    // Adapt to the frontend's expectation: { data: [], pagination: {} }
    res.status(200).json({
      data: result.products,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.totalProducts,
        limit: result.limit,
        // Optionally include other info if productService provides it and frontend can use it
        // sort_by: result.sort_by,
        // sort_order: result.sort_order
      }
    });
  } catch (error) {
    next(error);
  }
});


const validateGetStockLevelsParams = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'),
  query('search_term').optional().isString().trim().escape(),
  query('category_id').optional().isInt({ min: 1 }).toInt().withMessage('Category ID must be a positive integer.'),
  query('supplier_id').optional().isInt({ min: 1 }).toInt().withMessage('Supplier ID must be a positive integer.'),
  query('low_stock_only').optional().isBoolean().toBoolean().withMessage('low_stock_only must be a boolean.'),
  query('sort_by').optional().isIn(['product_name', 'sku', 'stock_quantity', 'reorder_threshold']).withMessage("Invalid sort_by value."),
  query('sort_order').optional().isIn(['ASC', 'DESC']).withMessage("Invalid sort_order value. Allowed: 'ASC', 'DESC'.")
];

router.get('/stock-levels', validateGetStockLevelsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    page = 1,
    limit = 20,
    search_term,
    category_id,
    supplier_id,
    low_stock_only,
    sort_by = 'product_name',
    sort_order = 'ASC'
  } = req.query;

  const offset = (page - 1) * limit;
  let queryParams = [];

  let baseCteQuery = `
    WITH stock_items AS (
        SELECT
            p.id as product_id,
            NULL::INT as variant_id,
            p.name as item_name,
            p.sku as item_sku,
            p.stock_quantity,
            p.reorder_threshold,
            p.has_variants,
            p.category_id,
            c.name as category_name,
            p.supplier_id,
            s.name as supplier_name,
            'product' as item_type,
            p.name as sort_product_name,
            p.sku as sort_sku
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.has_variants = FALSE
        UNION ALL
        SELECT
            p.id as product_id,
            pv.id as variant_id,
            p.name || ' - ' || pv.sku as item_name,
            pv.sku as item_sku,
            pv.stock_quantity,
            p.reorder_threshold,
            TRUE as has_variants,
            p.category_id,
            c.name as category_name,
            p.supplier_id,
            s.name as supplier_name,
            'variant' as item_type,
            p.name as sort_product_name,
            pv.sku as sort_sku
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
    )
  `;

  let conditions = [];
  let paramIndex = 1;

  if (search_term) {
    conditions.push(`(item_name ILIKE $${paramIndex} OR item_sku ILIKE $${paramIndex})`);
    queryParams.push(`%${search_term}%`);
    paramIndex++;
  }
  if (category_id) {
    conditions.push(`category_id = $${paramIndex}`);
    queryParams.push(category_id);
    paramIndex++;
  }
  if (supplier_id) {
    conditions.push(`supplier_id = $${paramIndex}`);
    queryParams.push(supplier_id);
    paramIndex++;
  }
  if (low_stock_only === true) {
    conditions.push(`(stock_quantity <= reorder_threshold AND reorder_threshold > 0)`);
  }

  let whereClause = "";
  if (conditions.length > 0) {
    whereClause = " WHERE " + conditions.join(" AND ");
  }

  try {
    const countQueryString = baseCteQuery + `SELECT COUNT(*) as total_count FROM stock_items` + whereClause;
    const countResult = await db.query(countQueryString, queryParams);
    const totalItems = parseInt(countResult.rows[0].total_count);

    let sortColumn = 'sort_product_name';
    if (sort_by === 'sku') sortColumn = 'item_sku';
    else if (sort_by === 'stock_quantity') sortColumn = 'stock_quantity';
    else if (sort_by === 'reorder_threshold') sortColumn = 'reorder_threshold';

    const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const dataQueryString = baseCteQuery +
      `SELECT * FROM stock_items` +
      whereClause +
      ` ORDER BY ${sortColumn} ${safeSortOrder}, product_id ${safeSortOrder}, variant_id ${safeSortOrder} NULLS LAST ` +
      `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const dataFinalParams = [...queryParams, limit, offset];
    const itemsResult = await db.query(dataQueryString, dataFinalParams);

    res.status(200).json({
        data: itemsResult.rows,
        pagination: {
            total: totalItems,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalItems / limit),
            hasNextPage: page < Math.ceil(totalItems / limit),
            hasPrevPage: page > 1,
            sort_by: sort_by,
            sort_order: sort_order
        }
    });
  } catch (error) {
    console.error('Error fetching stock levels:', error);
    next(error);
  }
});

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

    // Fetch product details to check has_variants
    const productDetailsResult = await client.query('SELECT id, has_variants FROM products WHERE id = $1', [id]);
    // This check is technically redundant due to productExistsResult, but good for clarity
    if (productDetailsResult.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${id} not found (unexpected after initial check).` });
    }
    const product = productDetailsResult.rows[0];

    if (product.has_variants) {
      return res.status(400).json({ message: `Stock for product ID ${id} is managed at the variant level. Please update variant stock instead.` });
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
      SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id;
      -- Only need to know it succeeded, will re-fetch full details.
    `;
    const updatedProductResult = await client.query(updateQuery, [stockQuantity, id]);

    if (updatedProductResult.rowCount === 0) {
        // This case should ideally not be hit if the existence check passed and ID is valid.
        return res.status(404).json({ message: `Product with ID ${id} found but update failed to apply.`});
    }

    // Re-fetch the product with all details including supplier, category, and tags
    const finalProductQuery = `
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
    const finalProductResponse = await client.query(finalProductQuery, [id]);

    if (finalProductResponse.rows.length === 0) {
        // Should not happen if update was successful
        return res.status(404).json({ message: `Product with ID ${id} could not be re-fetched after update.`});
    }

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

// GET /api/admin/products/:id/label - Generate a PDF label for a product
router.get(
  '/:id/label',
  [
    param('id').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    query('variant_id').optional().isInt({ gt: 0 }).toInt().withMessage('Variant ID must be a positive integer if provided.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id: productId } = req.params; // productId is now an integer
    const { variant_id: requestedVariantId } = req.query; // requestedVariantId is int or undefined

    // Placeholders for currency and base URL - ensure consistency with /label-data or use a config service
    const STORE_CURRENCY_CODE = process.env.STORE_CURRENCY_CODE || 'USD';
    const STORE_CURRENCY_SYMBOL = process.env.STORE_CURRENCY_SYMBOL || '$';
    const PRODUCT_PAGE_BASE_URL = process.env.FRONTEND_URL || 'https://yourstore.com';

    try {
      const product = await productService.getProductById(productId);

      let labelDataItem = null;

      if (product.has_variants && product.variants && product.variants.length > 0) {
        if (!requestedVariantId) {
          return res.status(400).json({ message: 'This product has multiple variants. Please specify a variant_id query parameter to generate a label for a specific variant.' });
        }
        const variant = product.variants.find(v => v.id === requestedVariantId);
        if (!variant) {
          return res.status(404).json({ message: `Variant with ID ${requestedVariantId} not found for product ${productId}.` });
        }

        let suffixParts = [];
        if (product.available_options && variant.option_value_ids) {
          for (const valId of variant.option_value_ids) {
            for (const opt of product.available_options) {
              const foundValue = opt.values.find(v => v.value_id === valId);
              if (foundValue) { suffixParts.push(`${opt.option_name}: ${foundValue.value_name}`); break; }
            }
          }
        }
        const constructed_suffix = suffixParts.length > 0 ? ` - ${suffixParts.join(', ')}` : '';

        labelDataItem = {
          product_id: product.id,
          variant_id: variant.id,
          product_name: product.name, // Base product name
          variant_name_suffix: constructed_suffix,
          full_display_name: `${product.name}${constructed_suffix}`,
          sku: variant.sku || product.sku, // Prioritize variant SKU
          barcode_value: variant.sku || product.sku || `${product.id}-${variant.id}`, // Unique barcode value
          selling_price: parseFloat(variant.final_price).toFixed(2), // Already calculated in getProductById
          currency_code: STORE_CURRENCY_CODE,
          currency_symbol: STORE_CURRENCY_SYMBOL,
          qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}?variantId=${variant.id}`
        };

      } else { // Base product or product treated as having no distinct variants for labeling
        if (requestedVariantId) {
            return res.status(400).json({ message: `Product ID ${productId} does not have variants, variant_id parameter is not applicable.` });
        }
        labelDataItem = {
          product_id: product.id,
          variant_id: null,
          product_name: product.name,
          variant_name_suffix: null,
          full_display_name: product.name,
          sku: product.sku,
          barcode_value: product.sku || product.id.toString(),
          selling_price: parseFloat(product.price).toFixed(2),
          currency_code: STORE_CURRENCY_CODE,
          currency_symbol: STORE_CURRENCY_SYMBOL,
          qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}`
        };
      }

      if (!labelDataItem) { // Should be caught by logic above, but as a safeguard
          // This path should ideally not be reached if logic is correct
          throw new Error("Could not determine data for label due to an unexpected issue.");
      }

      const pdfBuffer = await generateProductLabelPdf(labelDataItem);

      res.setHeader('Content-Type', 'application/pdf');
      // Sanitize filename
      const safeSku = (labelDataItem.sku || `product_${labelDataItem.product_id}`).replace(/[^a-z0-9_.-]/gi, '_');
      const fileName = `label_${safeSku}${labelDataItem.variant_id ? '_var_' + labelDataItem.variant_id : ''}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(pdfBuffer);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      next(error); // Pass to global error handler
    }
  }
);

// GET /api/admin/products/:productId/inventory-batches - Get inventory batch information
router.get(
  '/:productId/inventory-batches',
  [
    param('productId').isInt({ gt: 0 }).toInt().withMessage('Product ID must be a positive integer.'),
    query('variant_id').optional().isInt({ gt: 0 }).toInt().withMessage('Variant ID must be a positive integer if provided.'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('sort_by').optional().isIn([
      'received_date_desc', 'received_date_asc',
      'expiry_date_asc', 'expiry_date_desc',
      'current_quantity_asc', 'current_quantity_desc'
    ])
      .withMessage('Invalid sort_by value. Allowed values: received_date_desc, received_date_asc, expiry_date_asc, expiry_date_desc, current_quantity_asc, current_quantity_desc')
      .default('received_date_desc')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params; // isInt by validator
    const { variant_id, page, limit, sort_by } = req.query; // types validated
    const offset = (page - 1) * limit;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        throw new NotFoundError(`Product with ID ${productId} not found.`);
      }

      const queryParams = [productId];
      let whereClauses = ['ib.product_id = $1'];
      let currentParamIndex = 1;

      if (variant_id) {
        currentParamIndex++;
        queryParams.push(variant_id);
        whereClauses.push(`ib.variant_id = $${currentParamIndex}`);
      }

      const whereString = whereClauses.join(' AND ');

      let orderByClause = 'ORDER BY ib.received_date DESC, ib.id DESC'; // Default
      switch (sort_by) {
        case 'received_date_asc':
          orderByClause = 'ORDER BY ib.received_date ASC, ib.id ASC';
          break;
        case 'expiry_date_asc':
          orderByClause = 'ORDER BY ib.expiry_date ASC NULLS LAST, ib.id ASC';
          break;
        case 'expiry_date_desc':
          orderByClause = 'ORDER BY ib.expiry_date DESC NULLS FIRST, ib.id DESC';
          break;
        case 'current_quantity_asc':
          orderByClause = 'ORDER BY ib.current_quantity ASC, ib.id ASC';
          break;
        case 'current_quantity_desc':
          orderByClause = 'ORDER BY ib.current_quantity DESC, ib.id DESC';
          break;
        // Default case 'received_date_desc' is already set
      }

      const dataQuery = `
        SELECT
          ib.*,
          p.name as product_name,
          pv.sku as variant_sku,
          po.id as purchase_order_id,
          s.name as supplier_name
        FROM inventory_batches ib
        JOIN products p ON ib.product_id = p.id
        LEFT JOIN product_variants pv ON ib.variant_id = pv.id
        LEFT JOIN purchase_order_items poi ON ib.purchase_order_item_id = poi.id
        LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE ${whereString}
        ${orderByClause}
        LIMIT $${currentParamIndex + 1} OFFSET $${currentParamIndex + 2};
      `;
      const dataParams = [...queryParams, limit, offset];

      const countQuery = `
        SELECT COUNT(*)
        FROM inventory_batches ib
        WHERE ${whereString};
      `;
      // Count query uses only filter params (productId, variant_id)
      const countParams = queryParams.slice(0, currentParamIndex);

      const dataResult = await db.query(dataQuery, dataParams);
      const countResult = await db.query(countQuery, countParams);

      const totalRecords = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalRecords / limit);

      res.status(200).json({
        data: dataResult.rows,
        pagination: {
          total: totalRecords,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          sort_by: sort_by
        }
      });

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      next(error); // Pass to global error handler
    }
  }
);

// GET /api/admin/products/:productId/label-data - Get structured data for product labels
router.get(
  '/:productId/label-data',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const PRODUCT_PAGE_BASE_URL = process.env.FRONTEND_URL || 'https://yourstore.com';

    try {
      const product = await productService.getProductById(parseInt(productId));
      // productService.getProductById should throw NotFoundError if product doesn't exist.

      // For now, assume a base store currency. This can be enhanced later.
      const STORE_CURRENCY_CODE = 'USD'; // Example, ideally from config
      const STORE_CURRENCY_SYMBOL = '$';   // Example, ideally from config or currency data

      const labelsData = [];

      if (product.has_variants && product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          let suffixParts = [];
          if (product.available_options && variant.option_value_ids) {
            for (const valId of variant.option_value_ids) {
              for (const opt of product.available_options) {
                const foundValue = opt.values.find(v => v.value_id === valId);
                if (foundValue) {
                  suffixParts.push(`${opt.option_name}: ${foundValue.value_name}`);
                  break;
                }
              }
            }
          }
          const constructed_suffix = suffixParts.length > 0 ? ` - ${suffixParts.join(', ')}` : '';

          labelsData.push({
            product_id: product.id,
            variant_id: variant.id,
            product_name: product.name,
            variant_name_suffix: constructed_suffix,
            full_display_name: `${product.name}${constructed_suffix}`,
            sku: variant.sku || product.sku, // Prioritize variant SKU
            // A more robust barcode might include product ID and variant ID if SKU is not guaranteed unique across all
            barcode_value: variant.sku || product.sku || `${product.id}${variant.id ? '-' + variant.id : ''}`,
            selling_price: parseFloat(variant.final_price).toFixed(2), // final_price is already calculated in getProductById
            currency_code: STORE_CURRENCY_CODE, // Assuming product/variant prices are in store's base currency
            currency_symbol: STORE_CURRENCY_SYMBOL,
            qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}?variantId=${variant.id}`,
            qr_code_data_reorder_url: `${PRODUCT_PAGE_BASE_URL}/cart?action=add&productId=${product.id}&variantId=${variant.id}&quantity=1`,
            qr_code_data_promotion_url: `${PRODUCT_PAGE_BASE_URL}/promotions?ref_product=${product.id}&ref_variant=${variant.id}`
          });
        }
      } else {
        labelsData.push({
          product_id: product.id,
          variant_id: null,
          product_name: product.name,
          variant_name_suffix: null,
          full_display_name: product.name,
          sku: product.sku,
          barcode_value: product.sku || product.id.toString(),
          selling_price: parseFloat(product.price).toFixed(2),
          currency_code: STORE_CURRENCY_CODE,
            currency_symbol: STORE_CURRENCY_SYMBOL,
            qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}`,
            qr_code_data_reorder_url: `${PRODUCT_PAGE_BASE_URL}/cart?action=add&productId=${product.id}&quantity=1`,
            qr_code_data_promotion_url: `${PRODUCT_PAGE_BASE_URL}/promotions?ref_product=${product.id}`
        });
      }
      res.status(200).json(labelsData);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      // Pass other errors to global error handler
      next(error);
    }
  }
);

// GET /api/admin/products/:productId/cost-history - Get cost history for a product (and optionally variant)
router.get(
  '/:productId/cost-history',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    query('variant_id').optional().isInt({ gt: 0 }).toInt().withMessage('Variant ID must be a positive integer if provided.'),
    query('supplier_id').optional().isInt({ gt: 0 }).toInt().withMessage('Supplier ID must be a positive integer if provided.'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params; // Now an integer
    const { variant_id, supplier_id, page, limit } = req.query; // variant_id, supplier_id, page, limit are integers or undefined
    const offset = (page - 1) * limit;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        throw new NotFoundError(`Product with ID ${productId} not found.`);
      }

      const queryParams = [];
      let whereClauses = ['pch.product_id = $1'];
      queryParams.push(productId);
      let currentParamIndex = 1; // For $1, $2 etc.

      if (variant_id) {
        currentParamIndex++;
        queryParams.push(variant_id);
        whereClauses.push(`pch.variant_id = $${currentParamIndex}`);
      }
      if (supplier_id) {
        currentParamIndex++;
        queryParams.push(supplier_id);
        whereClauses.push(`pch.supplier_id = $${currentParamIndex}`);
      }

      const whereString = whereClauses.join(' AND ');

      const dataQuery = `
        SELECT pch.id, pch.product_id, p.name as product_name,
               pch.variant_id, pv.sku as variant_sku,
               pch.supplier_id, s.name as supplier_name,
               pch.currency_code, pch.cost_price, pch.quantity_received,
               pch.purchase_order_item_id, poi.quantity_ordered as po_item_quantity_ordered,
               po.id as purchase_order_id,
               pch.effective_date, pch.created_at
        FROM product_cost_history pch
        JOIN products p ON pch.product_id = p.id
        LEFT JOIN product_variants pv ON pch.variant_id = pv.id
        LEFT JOIN suppliers s ON pch.supplier_id = s.id
        LEFT JOIN purchase_order_items poi ON pch.purchase_order_item_id = poi.id
        LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
        WHERE ${whereString}
        ORDER BY pch.effective_date DESC, pch.id DESC
        LIMIT $${currentParamIndex + 1} OFFSET $${currentParamIndex + 2};
      `;
      const dataParams = [...queryParams, limit, offset];

      const countQuery = `SELECT COUNT(*) FROM product_cost_history pch WHERE ${whereString};`;

      const dataResult = await db.query(dataQuery, dataParams);
      const countResult = await db.query(countQuery, queryParams); // Count query uses only filter params

      const totalRecords = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalRecords / limit);

      res.status(200).json({
        data: dataResult.rows,
        pagination: {
          total: totalRecords,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
);

module.exports = router;
