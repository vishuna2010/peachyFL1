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
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('sort_by').optional().trim().isIn(['product_name', 'sku', 'stock_quantity', 'reorder_threshold']).default('product_name'),
  query('sort_order').optional().trim().toUpperCase().isIn(['ASC', 'DESC']).default('ASC'),
  query('search_term').optional().isString().trim(),
  query('category_id').optional({ checkFalsy: true }).isInt({ min: 1 }).toInt().withMessage('Category ID must be a positive integer if provided.'),
  query('supplier_id').optional({ checkFalsy: true }).isInt({ min: 1 }).toInt().withMessage('Supplier ID must be a positive integer if provided.'),
  query('low_stock_only').optional().isBoolean().toBoolean().withMessage('low_stock_only must be a boolean.'),
];

router.get(
  '/stock-levels',
  isAuthenticated,
  checkPermission('products:view_stock'), // Potentially a more specific permission
  validateGetStockLevelsParams,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // All query parameters are now validated and sanitized by express-validator
    // including defaults.
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      search_term: req.query.search_term,
      category_id: req.query.category_id,
      supplier_id: req.query.supplier_id,
      low_stock_only: req.query.low_stock_only,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
    };

    try {
      const result = await productService.getAllStockLevels(options);

      // The service returns data in the structure: { data: items, pagination: {total, page, limit, totalPages, sort_by, sort_order} }
      // This matches the expected response structure for the frontend.
      res.status(200).json(result);

    } catch (error) {
      // Errors from productService (e.g., AppError for DB issues) will be passed to the global handler.
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

    // req.body contains validated and sanitized data
    // req.file contains the uploaded file data, if any

    try {
      const createdProductDetails = await productService.createProduct(req.body, req.file);

      auditLogService.recordAuditEvent(
        'PRODUCT_CREATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'PRODUCT', resourceId: createdProductDetails.id },
        { inputData: req.body, createdProductSummary: { id: createdProductDetails.id, name: createdProductDetails.name, sku: createdProductDetails.sku } },
        req
      ).catch(err => console.error(`Audit log failed for PRODUCT_CREATE_SUCCESS (ID: ${createdProductDetails.id}):`, err));

      res.status(201).json({ data: createdProductDetails });

    } catch (error) {
      // productService.createProduct will throw AppError, ConflictError, etc.
      // These will be handled by the global error handler.
      next(error);
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

    const { productId } = req.params; // Validated
    const productData = req.body;    // Validated by express-validator
    const fileData = req.file;       // From multer middleware

    // Determine if image removal is intended based on image_url field
    // If image_url is explicitly set to null in the request, it means remove.
    // If image_url is not in productData, and no new file is uploaded, existing image is kept.
    const removeImageFlag = productData.hasOwnProperty('image_url') && productData.image_url === null;

    try {
      const updatedProductDetails = await productService.updateProduct(
        productId,
        productData,
        fileData,
        removeImageFlag
      );

      auditLogService.recordAuditEvent(
        'PRODUCT_UPDATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'PRODUCT', resourceId: updatedProductDetails.id },
        {
          inputData: productData, // Log what was sent in request
          updatedProductSummary: { id: updatedProductDetails.id, name: updatedProductDetails.name, sku: updatedProductDetails.sku }
        },
        req
      ).catch(err => console.error(`Audit log failed for PRODUCT_UPDATE_SUCCESS (ID: ${updatedProductDetails.id}):`, err));

      res.status(200).json({ data: updatedProductDetails });

    } catch (error) {
      // productService.updateProduct will throw AppError, NotFoundError, ConflictError, etc.
      next(error);
    }
  }
);

const validateStockUpdateParams = [
  param('id').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
  body('new_stock_quantity')
    .notEmpty().withMessage('new_stock_quantity is required.')
    .isInt({ min: 0 }).withMessage('New stock quantity must be a non-negative integer.')
    .toInt()
];

// PUT /api/admin/products/:id/stock - Update a product's stock quantity
router.put(
  '/:id/stock',
  isAuthenticated,
  checkPermission('products:edit_inventory'), // Using a more specific permission
  validateStockUpdateParams,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params; // Validated productId
    const { new_stock_quantity } = req.body; // Validated new_stock_quantity

    try {
      const updatedProduct = await productService.updateProductStock(id, new_stock_quantity);

      // It might be useful for the audit log to know the old stock quantity.
      // The service currently doesn't return it. For a more complete audit,
      // the service could fetch old stock before updating or the audit log could be adapted.
      // For now, logging new stock.
      auditLogService.recordAuditEvent(
        'PRODUCT_STOCK_UPDATE',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'PRODUCT', resourceId: id },
        {
          updated_product_name: updatedProduct.name, // Get name from returned product
          new_stock_quantity: new_stock_quantity
        },
        req
      ).catch(err => console.error(`Audit log failed for PRODUCT_STOCK_UPDATE (ID: ${id}):`, err));

      res.status(200).json({
        message: `Stock quantity for product #${id} (${updatedProduct.name}) updated to ${new_stock_quantity}.`,
        product: updatedProduct
      });
    } catch (error) {
      // Errors from productService (NotFoundError, BadRequestError, AppError) will be passed to the global handler.
      next(error);
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
