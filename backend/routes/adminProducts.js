const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth'); // Replaced isAdmin with checkPermission
const productService = require('../services/productService');
const auditLogService = require('../services/auditLogService');
const { query, param, body, validationResult } = require('express-validator');
const { NotFoundError } = require('../utils/AppError');
const { generateProductLabelPdf } = require('../services/pdfService'); // Ensured at top
const taxService = require('../services/taxService');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload'); // Corrected path
const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service'); // Corrected path
const { getOrCreateTagIds, getS3KeyFromUrl } = require('../utils/productHelpers'); // Corrected path


// Middleware to log requests to this router
router.use((req, res, next) => {
  console.log(`[adminProductsRouter] Request received: ${req.method} ${req.originalUrl}`);
  next();
});

// Apply auth middleware to all routes in this router
// router.use(isAuthenticated, isAdmin); // REMOVED - will apply per route

// Validators for GET /api/admin/products
const validateGetProductsParams = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
  query('search_term').optional().isString().trim(),
  query('category_id').optional().isInt({ gt: 0 }).toInt(),
  query('supplier_id').optional().isInt({ gt: 0 }).toInt(), // <<<< NEW VALIDATOR
  query('sort_by').optional().isString().trim(), // Specific validation is done in productService
  query('status').optional().isString().trim().isIn(['active', 'draft', 'archived', 'all', 'inactive']).default('all'), // 'inactive' is alias for 'draft' perhaps, or its own state. 'all' means no status filter.
  query('stock_status').optional().isString().trim().isIn(['in_stock', 'out_of_stock', 'low_stock', 'all']).default('all'),
  // ensure sort_order is also accepted if sent by client, even if productService has a default
  query('sort_order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).toUpperCase(),
];

// GET /api/admin/products - List all products (admin)
router.get('/', isAuthenticated, checkPermission('products:view'), validateGetProductsParams, async (req, res, next) => {
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
      supplierId: req.query.supplier_id, // <<<< NEW: Pass supplier_id as supplierId
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

// GET /api/admin/products/stock-levels - Get paginated stock levels for all products/variants
const validateGetStockLevelsParams = [
  // Only validate parameters that are expected to be sent and are used by the frontend
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'),
  query('sort_by').optional().trim().isIn(['product_name', 'sku', 'stock_quantity', 'reorder_threshold']).withMessage("Invalid sort_by value. Allowed: product_name, sku, stock_quantity, reorder_threshold."),
  query('sort_order').optional().trim().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage("Invalid sort_order value. Allowed: ASC, DESC, asc, desc.")
  // Temporarily removed:
  // query('search_term').optional().isString().trim().escape(),
  // query('category_id').optional({ checkFalsy: true }).isInt({ min: 1 }).toInt().withMessage('Category ID must be a positive integer if provided.'),
  // query('supplier_id').optional({ checkFalsy: true }).isInt({ min: 1 }).toInt().withMessage('Supplier ID must be a positive integer if provided.'),
  // query('low_stock_only').optional().isBoolean().toBoolean().withMessage('low_stock_only must be a boolean.'),
];

router.get('/stock-levels', isAuthenticated, checkPermission('products:view'), validateGetStockLevelsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Use destructured defaults for page and limit if not provided or if validator's default didn't catch all edge cases
  const pageQuery = parseInt(req.query.page, 10);
  const limitQuery = parseInt(req.query.limit, 10);

  const page = (!isNaN(pageQuery) && pageQuery >= 1) ? pageQuery : 1;
  const limit = (!isNaN(limitQuery) && limitQuery >= 1 && limitQuery <= 100) ? limitQuery : 20; // Max 100 as per validator

  const {
    search_term, // Will be undefined if not present
    category_id, // Will be undefined if not present
    supplier_id, // Will be undefined if not present
    low_stock_only, // Will be undefined if not present, or boolean if present
  } = req.query;

  // For sort_by and sort_order, use validated values or handler defaults
  const sort_by = req.query.sort_by || 'product_name';
  let sort_order = req.query.sort_order || 'ASC';
  // Ensure sort_order is one of the accepted values after potential trim by validator
  if (!['ASC', 'DESC', 'asc', 'desc'].includes(sort_order)) {
      sort_order = 'ASC'; // Fallback if somehow an invalid value bypassed validator (e.g. from direct req.query use before this block)
  }


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

// GET /api/admin/products/:productId/assigned-options - List options assigned to a product, with their selected values
router.get(
  '/:productId/assigned-options',
  isAuthenticated,
  checkPermission('products:view'), // Or 'products:edit' if assigning options is part of editing
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    // Optional: A log to confirm entry if debugging is still needed by the user later
    // console.log(`Executing GET /:productId/assigned-options for Product ID: ${req.params.productId}`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        return next(new NotFoundError(`Product with ID ${productId} not found.`));
      }

      const optimizedQuery = `
        SELECT
          pao.id AS assigned_option_id,
          pao.option_id AS global_option_id,
          po.name AS global_option_name, // Intended final field name
          pao.created_at,
          pao.updated_at,
          COALESCE(
            (
              SELECT json_agg(json_build_object('id', pov.id, 'value', pov.value) ORDER BY pov.value ASC)
              FROM product_assigned_option_specific_values paosv
              JOIN product_option_values pov ON paosv.product_option_value_id = pov.id
              WHERE paosv.product_assigned_option_id = pao.id
            ),
            '[]'::json
          ) AS selected_values
        FROM product_assigned_options pao
        JOIN product_options po ON pao.option_id = po.id
        WHERE pao.product_id = $1
        ORDER BY po.name;
      `;
      const result = await db.query(optimizedQuery, [productId]);

      res.status(200).json(result.rows);

    } catch (error) {
      console.error(`Error fetching assigned options for product ID ${productId}:`, error);
      next(error);
    }
  }
);

// POST /api/admin/products - Create a new product
const validateCreateProductParams = [
  body('name').isString().trim().notEmpty().withMessage('Product name is required and cannot be empty.'),
  body('description').optional({ checkFalsy: true }).isString().trim(),
  body('price').isFloat({ gt: 0 }).withMessage('Price is required and must be greater than 0.').toFloat(),
  body('category_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.').toInt(),
  body('supplier_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Supplier ID must be a positive integer.').toInt(),
  body('sku').optional({ nullable: true }).isString().trim(),
  // stock_quantity for a new base product. If it has_variants, this will be ignored later or variants define stock.
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer.').default(0).toInt(),
  body('reorder_threshold').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Reorder threshold must be non-negative.').toInt(),
  body('product_status').optional().isIn(['active', 'inactive', 'archived', 'draft']).withMessage('Invalid product status.').default('draft'),
  body('tax_class_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Tax Class ID must be a positive integer.').toInt(),
  body('cost_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Cost price must be non-negative.').toFloat(),
  body('wholesale_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Wholesale price must be non-negative.').toFloat(),
  body('brand_manufacturer').optional({ nullable: true }).isString().trim(),
  body('supplier_reference').optional({ nullable: true }).isString().trim(),
  body('specifications').optional({ nullable: true }), // Can be JSON string or object
  body('tags').optional({ nullable: true }).isArray().withMessage('Tags must be an array of strings or null.'),
  body('tags.*').optional().isString().trim(),
  // image_url is not typically set directly on creation via this field; image upload is separate.
  // has_variants is determined by whether variants are created, not a direct input here.
];

router.post(
  '/',
  isAuthenticated,
  checkPermission('products:create'),
  productImageUploadMiddleware, // Handles req.file for optional image upload during creation
  handleMulterError,
  validateCreateProductParams,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name, description, price, category_id, supplier_id, sku,
      stock_quantity, reorder_threshold, product_status, tax_class_id,
      cost_price, wholesale_price, brand_manufacturer, supplier_reference,
      specifications, tags: tagNames
    } = req.body;

    const client = await db.pool.connect();
    let s3FileKeyToStore = null;
    let imageUrlToStoreInDb = null;

    try {
      await client.query('BEGIN');

      // Image handling if a file is uploaded
      if (req.file) {
        if (isS3Configured()) {
          try {
            const uniqueFileName = `product-images/product-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
            const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
            imageUrlToStoreInDb = s3Data.Location;
            s3FileKeyToStore = s3Data.Key;
          } catch (s3Error) {
            await client.query('ROLLBACK');
            console.error("S3 Upload Error on product creation:", s3Error);
            return res.status(500).json({ message: "Failed to upload image to S3." });
          }
        } else {
          await client.query('ROLLBACK');
          console.warn("Attempted to upload image during product creation, but S3 is not configured.");
          return res.status(500).json({ message: "Image upload service is not configured." });
        }
      }

      const insertQuery = `
        INSERT INTO products (
          name, description, price, category_id, supplier_id, sku, stock_quantity,
          reorder_threshold, product_status, image_url, tax_class_id, cost_price,
          wholesale_price, brand_manufacturer, supplier_reference, specifications,
          has_variants, average_rating, review_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          FALSE, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *;
      `;

      // Ensure correct handling of nulls for optional fields
      const values = [
        name,
        description || null,
        price,
        category_id || null,
        supplier_id || null,
        sku || null,
        stock_quantity, // Defaulted to 0 by validator if not provided
        reorder_threshold || null,
        product_status, // Defaulted by validator
        imageUrlToStoreInDb, // From S3 upload or null
        tax_class_id || null,
        cost_price || null,
        wholesale_price || null,
        brand_manufacturer || null,
        supplier_reference || null,
        specifications ? (typeof specifications === 'string' ? specifications : JSON.stringify(specifications)) : null,
      ];

      const result = await client.query(insertQuery, values);
      const newProduct = result.rows[0];

      // Tags handling
      if (Array.isArray(tagNames) && tagNames.length > 0) {
        const tagIds = await getOrCreateTagIds(tagNames, client);
        for (const tagId of tagIds) {
          await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [newProduct.id, tagId]);
        }
      }

      await client.query('COMMIT');

      // Fetch the newly created product with all necessary details for the response (including any generated tags)
      const createdProductDetails = await productService.getProductById(newProduct.id);

      auditLogService.recordAuditEvent(
        'PRODUCT_CREATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'PRODUCT', resourceId: newProduct.id },
        { inputData: req.body, createdProduct: createdProductDetails },
        req
      ).catch(err => console.error(`Audit log failed for PRODUCT_CREATE_SUCCESS (ID: ${newProduct.id}):`, err));

      res.status(201).json({ data: createdProductDetails });

    } catch (error) {
      await client.query('ROLLBACK');
      if (s3FileKeyToStore && isS3Configured()) {
        try {
          await deleteFileFromS3(s3FileKeyToStore);
          console.log(`Rolled back S3 upload for key: ${s3FileKeyToStore} due to DB error on product creation.`);
        } catch (s3RollbackError) {
          console.error(`Critical: Failed to rollback S3 upload for key ${s3FileKeyToStore} after DB error:`, s3RollbackError);
        }
      }
      if (error.code === '23505' && error.constraint === 'products_sku_key') {
        return res.status(409).json({ message: `SKU "${sku}" already exists.` });
      }
      next(error);
    } finally {
      client.release();
    }
  }
);

// GET /api/admin/products/:productId - Get a single product by ID (admin)
router.get(
  '/:productId',
  isAuthenticated,
  checkPermission('products:view'),
  [
    param('productId')
      .isInt({ gt: 0 })
      .withMessage('Product ID must be a positive integer.')
      .toInt() // Sanitize to integer
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // req.params.productId is now an integer due to .toInt()
      const product = await productService.getProductById(req.params.productId);
      // productService.getProductById is expected to throw NotFoundError if not found
      res.status(200).json({ data: product });
    } catch (error) {
      if (error instanceof NotFoundError) {
        // Log this specific case for admin, or just return 404
        console.log(`Admin request for non-existent product ID: ${req.params.productId}`);
        return res.status(404).json({ message: error.message });
      }
      // For other errors (e.g., database connection issues), pass to global handler
      next(error);
    }
  }
);

// PUT /api/admin/products/:productId - Update a product
const validateUpdateProductParams = [
  param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
  body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty when provided.'),
  body('description').optional({ checkFalsy: true }).isString().trim(),
  body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be greater than 0.').toFloat(),
  body('category_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.').toInt(),
  body('supplier_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Supplier ID must be a positive integer.').toInt(),
  body('sku').optional({ nullable: true }).isString().trim(),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer.').toInt(),
  body('reorder_threshold').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Reorder threshold must be non-negative.').toInt(),
  body('product_status').optional().isIn(['active', 'inactive', 'archived', 'draft']).withMessage('Invalid product status.'),
  body('tax_class_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Tax Class ID must be a positive integer.').toInt(),
  body('cost_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Cost price must be non-negative.').toFloat(),
  body('wholesale_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Wholesale price must be non-negative.').toFloat(),
  body('brand_manufacturer').optional({ nullable: true }).isString().trim(),
  body('supplier_reference').optional({ nullable: true }).isString().trim(),
  body('specifications').optional({ nullable: true }), // Validated as JSON string or object in handler
  body('tags').optional({ nullable: true }).isArray().withMessage('Tags must be an array of strings or null.'),
  body('tags.*').optional().isString().trim(),
  body('image_url').optional({ nullable: true }).isString().trim().withMessage('Image URL must be a string or null to remove.') // For explicit nullification
];

router.put(
  '/:productId',
  isAuthenticated,
  checkPermission('products:edit'),
  productImageUploadMiddleware, // Handles req.file
  handleMulterError,
  validateUpdateProductParams,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { /* extract all validated fields from req.body */
      name, description, price, category_id, tags: tagNames,
      stock_quantity, image_url: newImageUrlFromRequest, supplier_id, sku, reorder_threshold,
      brand_manufacturer, supplier_reference, product_status,
      cost_price, wholesale_price, tax_class_id, specifications
    } = req.body;

    const client = await db.pool.connect();
    let s3FileKeyToStore = null;
    let finalImageUrlToStoreInDb = undefined;
    let oldS3KeyToDelete = null;

    try {
      await client.query('BEGIN');

      const currentProductResult = await client.query('SELECT image_url, sku, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
      if (currentProductResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return next(new NotFoundError(`Product with ID ${productId} not found.`));
      }
      const currentProduct = currentProductResult.rows[0];
      finalImageUrlToStoreInDb = currentProduct.image_url; // Default to current image

      // Image handling
      if (req.file) { // New image uploaded
        if (isS3Configured()) {
          try {
            const uniqueFileName = `product-images/product-${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
            const s3Data = await uploadFileToS3(req.file.buffer, uniqueFileName, req.file.mimetype);
            finalImageUrlToStoreInDb = s3Data.Location;
            s3FileKeyToStore = s3Data.Key; // Keep track of new key for potential rollback
            if (currentProduct.image_url) {
              oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url);
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
      } else if (newImageUrlFromRequest === null && currentProduct.image_url) { // Explicitly removing image
        if (isS3Configured()) {
          oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url);
        }
        finalImageUrlToStoreInDb = null;
      }
      // If newImageUrlFromRequest is a string, it means client wants to keep the existing one or set a new one by URL (not supported by this flow directly, image_url field is for this)
      // If newImageUrlFromRequest is undefined, it means no change to image from form-data text fields, rely on req.file or current image.

      const setClauses = [];
      const queryUpdateValues = [];
      let currentParamIndex = 1;

      const addClause = (field, value) => {
        if (value !== undefined) {
          setClauses.push(`${field} = $${currentParamIndex++}`);
          queryUpdateValues.push(value);
        }
      };

      // Add fields from req.body to update query if they exist
      addClause('name', name);
      addClause('description', description === '' ? null : description); // Handle empty string for nullable text fields
      addClause('price', price);
      addClause('category_id', category_id === '' || category_id === null ? null : parseInt(category_id));
      addClause('supplier_id', supplier_id === '' || supplier_id === null ? null : parseInt(supplier_id));
      addClause('sku', sku === '' ? null : sku);

      if (stock_quantity !== undefined) {
        if (!currentProduct.has_variants) {
          addClause('stock_quantity', parseInt(stock_quantity));
        } else {
          console.warn(`Attempt to update base stock_quantity for product ID ${productId} which has variants. Update to stock_quantity ignored.`);
        }
      }

      addClause('reorder_threshold', reorder_threshold === '' || reorder_threshold === null ? null : parseInt(reorder_threshold));
      addClause('product_status', product_status);
      addClause('tax_class_id', tax_class_id === '' || tax_class_id === null ? null : parseInt(tax_class_id));
      addClause('cost_price', cost_price === '' || cost_price === null ? null : parseFloat(cost_price));
      addClause('wholesale_price', wholesale_price === '' || wholesale_price === null ? null : parseFloat(wholesale_price));
      addClause('brand_manufacturer', brand_manufacturer === '' ? null : brand_manufacturer);
      addClause('supplier_reference', supplier_reference === '' ? null : supplier_reference);

      if (specifications !== undefined) {
        if (specifications === '' || specifications === null) {
          addClause('specifications', null);
        } else {
          // Pass the string directly. The database will handle it based on column type (JSONB).
          addClause('specifications', specifications);
        }
      }

      // Ensure image_url is added to clauses only if it actually changed or was explicitly set to null
      if (req.file || (newImageUrlFromRequest === null && currentProduct.image_url !== null) || (newImageUrlFromRequest !== undefined && newImageUrlFromRequest !== currentProduct.image_url) ) {
         addClause('image_url', finalImageUrlToStoreInDb);
      }


      if (setClauses.length > 0) {
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        const updateQueryString = `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${currentParamIndex} RETURNING id`;
        queryUpdateValues.push(productId);

        const updateResult = await client.query(updateQueryString, queryUpdateValues);
        if (updateResult.rowCount === 0) {
          await client.query('ROLLBACK');
          // This should ideally not happen if FOR UPDATE lock was successful and ID is correct
          return next(new NotFoundError(`Product with ID ${productId} not found during update attempt.`));
        }
      }

      // Tags handling
      if (tagNames !== undefined) { // tagNames can be an empty array to remove all tags
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
        if (Array.isArray(tagNames) && tagNames.length > 0) {
          const tagIds = await getOrCreateTagIds(tagNames, client); // client from this scope
          for (const tagId of tagIds) {
            await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2)', [productId, tagId]);
          }
        }
        // If only tags changed, and no other fields, ensure updated_at is touched
        if (setClauses.length === 0) {
           await client.query('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [productId]);
        }
      }

      await client.query('COMMIT');

      // If commit was successful, delete old S3 image if applicable
      if (oldS3KeyToDelete && isS3Configured()) {
        try {
          await deleteFileFromS3(oldS3KeyToDelete);
          console.log(`Successfully deleted old S3 image: ${oldS3KeyToDelete}`);
        } catch (s3DeleteError) {
          // Log this error but don't fail the request as the main DB update was successful
          console.error(`Failed to delete old S3 image ${oldS3KeyToDelete} after product update:`, s3DeleteError);
        }
      }

      // Fetch the updated product with all necessary details for the response
      const updatedProduct = await productService.getProductById(productId); // Uses its own client connection

      // Prepare details for audit log
      const fieldsAttemptedToUpdate = { ...req.body };
      // Remove sensitive or very large data not suitable for a summary audit log, if necessary.
      // For example, if req.body might contain uploaded file objects or very large text fields:
      // delete fieldsAttemptedToUpdate.file; // Example if 'file' was a field
      // delete fieldsAttemptedToUpdate.description; // Example if description is too long for audit 'details' summary

      // It's also good to remove the password if it were ever part of a user update DTO,
      // though this is a product update. For products, most fields are probably fine.

      auditLogService.recordAuditEvent(
        'PRODUCT_UPDATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'PRODUCT', resourceId: productId },
        {
          inputData: fieldsAttemptedToUpdate,
          updatedDataSnapshot: {
              name: updatedProduct.name,
              description: updatedProduct.description,
              price: updatedProduct.price,
              sku: updatedProduct.sku,
              stock_quantity: updatedProduct.stock_quantity,
              product_status: updatedProduct.product_status
          }
        },
        req
      ).catch(err => console.error(`Audit log failed for PRODUCT_UPDATE_SUCCESS (ID: ${productId}):`, err));

      res.status(200).json({ data: updatedProduct });

    } catch (error) {
      await client.query('ROLLBACK');
      // If a new image was uploaded to S3 but DB transaction failed, delete the new S3 image
      if (s3FileKeyToStore && isS3Configured()) {
        try {
          await deleteFileFromS3(s3FileKeyToStore);
          console.log(`Rolled back S3 upload for key: ${s3FileKeyToStore} due to DB error on product update.`);
        } catch (s3RollbackError) {
          console.error(`Critical: Failed to rollback S3 upload for key ${s3FileKeyToStore} after DB error:`, s3RollbackError);
          // This situation might require manual cleanup in S3.
        }
      }
      // Handle specific DB errors like unique constraint violations (e.g., SKU)
      if (error.code === '23505' && error.constraint === 'products_sku_key') {
        return res.status(409).json({ message: `SKU "${sku}" already exists.` });
      }
      next(error); // Pass to global error handler
    } finally {
      client.release();
    }
  }
);

// PUT /api/admin/products/:id/stock - Update a product's stock quantity
router.put('/:id/stock', isAuthenticated, checkPermission('products:edit'), async (req, res) => {
  // Note: The permission 'products:edit' might be too broad if you want separate control over stock.
  // Could use a more specific 'products:edit_inventory' if defined and assigned.
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
  isAuthenticated,
  checkPermission('products:view'), // Or a more specific 'products:generate_label'
  [
    param('id').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    query('variant_id').optional().isInt({ gt: 0 }).toInt().withMessage('Variant ID must be a positive integer if provided.'),
    query('count').optional().isInt({ min: 1, max: 200 }).toInt().default(1) // Max 200 for safety
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id: productId } = req.params; // productId is now an integer
    const { variant_id: requestedVariantId, count } = req.query; // count is available here

    // Placeholders for currency and base URL - ensure consistency with /label-data or use a config service
    // const STORE_CURRENCY_CODE = process.env.STORE_CURRENCY_CODE || 'USD'; // Defined inside try
    // const STORE_CURRENCY_SYMBOL = process.env.STORE_CURRENCY_SYMBOL || '$'; // Defined inside try
    // const PRODUCT_PAGE_BASE_URL = process.env.FRONTEND_URL || 'https://yourstore.com'; // Defined inside try

    try {
      const product = await productService.getProductById(productId); // productId is from req.params
      let labelDataItem = null;

      // These constants should be defined within the try block or be accessible in this scope
      const STORE_CURRENCY_CODE = process.env.STORE_CURRENCY_CODE || 'USD';
      const STORE_CURRENCY_SYMBOL = process.env.STORE_CURRENCY_SYMBOL || '$';
      const PRODUCT_PAGE_BASE_URL = process.env.FRONTEND_URL || 'https://yourstore.com';
      // count is from req.query, requestedVariantId is from req.query.variant_id

      if (product.has_variants && requestedVariantId) {
        // Case 1: Product has variants, AND a specific variant_id was requested.
        const variant = product.variants.find(v => v.id === requestedVariantId);
        if (!variant) {
          return res.status(404).json({ message: `Variant with ID ${requestedVariantId} not found for product ${productId}.` });
        }

        // Construct labelDataItem for the specific variant
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

        labelDataItem = {
          product_id: product.id,
          variant_id: variant.id,
          product_name: product.name,
          variant_name_suffix: constructed_suffix,
          full_display_name: `${product.name}${constructed_suffix}`,
          sku: variant.sku || product.sku,
          barcode_value: variant.sku || product.sku || `${product.id}-${variant.id}`,
          selling_price: parseFloat(variant.final_price).toFixed(2),
          currency_code: STORE_CURRENCY_CODE,
          currency_symbol: STORE_CURRENCY_SYMBOL,
          qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}?variantId=${variant.id}`
        };

        let taxDetailsVariant = { priceWithTax: parseFloat(variant.final_price), taxAmount: 0, appliedRates: [] };
        if (product.tax_class_id) {
          try {
            taxDetailsVariant = await taxService.calculatePriceWithAppliedTaxes(parseFloat(variant.final_price), product.tax_class_id);
          } catch (taxError) {
            console.error(`Error calculating tax for variant ${variant.id}:`, taxError);
            // Decide if you want to proceed without tax or throw error. For labels, proceeding without tax might be acceptable.
          }
        }
        labelDataItem.price_incl_tax = parseFloat(taxDetailsVariant.priceWithTax).toFixed(2);
        labelDataItem.tax_amount = parseFloat(taxDetailsVariant.taxAmount).toFixed(2);
        // labelDataItem.selling_price should already be variant.final_price (base price for variant)

      } else {
        // Case 2: Handles multiple sub-cases:
        //   a) Product has no variants (`!product.has_variants`).
        //   b) Product has variants, but NO specific `requestedVariantId` was provided (default to base product).

        // Sub-case check: If product does NOT have variants, but a `requestedVariantId` was still sent. This is an error.
        if (!product.has_variants && requestedVariantId) {
            return res.status(400).json({ message: `Product ID ${productId} does not have variants; variant_id parameter is not applicable.` });
        }

        // Proceed to construct labelDataItem for the base product for sub-cases 2a and 2b.
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

        let taxDetailsBase = { priceWithTax: parseFloat(product.price), taxAmount: 0, appliedRates: [] };
        if (product.tax_class_id) {
          try {
            taxDetailsBase = await taxService.calculatePriceWithAppliedTaxes(parseFloat(product.price), product.tax_class_id);
          } catch (taxError) {
            console.error(`Error calculating tax for product ${product.id}:`, taxError);
          }
        }
        labelDataItem.price_incl_tax = parseFloat(taxDetailsBase.priceWithTax).toFixed(2);
        labelDataItem.tax_amount = parseFloat(taxDetailsBase.taxAmount).toFixed(2);
        // labelDataItem.selling_price should already be product.price
      }

      if (!labelDataItem) {
        // This condition should ideally not be met if the logic above is exhaustive.
        console.error(`[Critical] Label data item could not be constructed for product ${productId}, variant ${requestedVariantId}`);
        return next(new Error("Could not determine data for label due to an unexpected server issue."));
      }

      const pdfBuffer = await generateProductLabelPdf(labelDataItem, count); // count is from req.query

      res.setHeader('Content-Type', 'application/pdf');
      const safeSku = (labelDataItem.sku || `product_${labelDataItem.product_id}`).replace(/[^a-z0-9_.-]/gi, '_');
      const fileName = `label_${safeSku}${labelDataItem.variant_id ? '_var_' + labelDataItem.variant_id : ''}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(pdfBuffer);

    } catch (error) {
      // Existing catch block
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      // Log other errors for server-side inspection
      console.error(`[Error in /:id/label for product ${productId}]:`, error);
      next(error); // Pass to global error handler
    }
  }
);

// GET /api/admin/products/:productId/inventory-batches - Get inventory batch information
router.get(
  '/:productId/inventory-batches',
  isAuthenticated,
  checkPermission('products:view'), // Viewing inventory is part of viewing product details
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
  isAuthenticated,
  checkPermission('products:view'),
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
      // product.tax_class_id should be available from getProductById

      const STORE_CURRENCY_CODE = process.env.STORE_CURRENCY_CODE || 'USD';
      const STORE_CURRENCY_SYMBOL = process.env.STORE_CURRENCY_SYMBOL || '$';

      const labelsData = [];

      if (product.has_variants && product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const baseSellingPrice = parseFloat(variant.final_price);
          let taxDetails = { taxAmount: 0, priceWithTax: baseSellingPrice, appliedRates: [] };

          if (product.tax_class_id) {
            taxDetails = await taxService.calculatePriceWithAppliedTaxes(baseSellingPrice, product.tax_class_id);
          }

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
          const variantSku = variant.sku || product.sku;

          labelsData.push({
            product_id: product.id,
            variant_id: variant.id,
            product_name: product.name,
            variant_name_suffix: constructed_suffix,
            full_display_name: `${product.name}${constructed_suffix}`,
            sku: variantSku,
            barcode_value: variantSku, // Prioritize variant SKU, then product SKU
            selling_price: baseSellingPrice.toFixed(2), // Pre-tax price
            vat_price: parseFloat(taxDetails.priceWithTax).toFixed(2), // Price with tax
            base_price_for_tax_calc: baseSellingPrice.toFixed(2),
            tax_amount: parseFloat(taxDetails.taxAmount).toFixed(2),
            applied_tax_rates: taxDetails.appliedRates,
            currency_code: STORE_CURRENCY_CODE,
            currency_symbol: STORE_CURRENCY_SYMBOL,
            qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}?variantId=${variant.id}`,
            qr_code_data_reorder_url: `${PRODUCT_PAGE_BASE_URL}/cart?action=add&productId=${product.id}&variantId=${variant.id}&quantity=1`,
            qr_code_data_promotion_url: `${PRODUCT_PAGE_BASE_URL}/promotions?ref_product=${product.id}&ref_variant=${variant.id}`
          });
        }
      } else { // Product without variants
        const baseSellingPrice = parseFloat(product.price);
        let taxDetails = { taxAmount: 0, priceWithTax: baseSellingPrice, appliedRates: [] };

        if (product.tax_class_id) {
          taxDetails = await taxService.calculatePriceWithAppliedTaxes(baseSellingPrice, product.tax_class_id);
        }
        const productSku = product.sku || product.id.toString();

        labelsData.push({
          product_id: product.id,
          variant_id: null,
          product_name: product.name,
          variant_name_suffix: null,
          full_display_name: product.name,
          sku: productSku,
          barcode_value: productSku, // Product SKU or ID
          selling_price: baseSellingPrice.toFixed(2), // Pre-tax price
          vat_price: parseFloat(taxDetails.priceWithTax).toFixed(2), // Price with tax
          base_price_for_tax_calc: baseSellingPrice.toFixed(2),
          tax_amount: parseFloat(taxDetails.taxAmount).toFixed(2),
          applied_tax_rates: taxDetails.appliedRates,
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
  isAuthenticated,
  checkPermission('products:view'), // Or a more specific 'products:view_cost_history'
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
