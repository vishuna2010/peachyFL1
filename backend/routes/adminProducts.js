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

    const { productId } = req.params; // Validated by express-validator

    try {
      const assignedOptions = await productService.getProductAssignedOptions(productId);
      // The service method handles the product existence check and throws NotFoundError if necessary.
      res.status(200).json(assignedOptions);
    } catch (error) {
      // Errors from productService (NotFoundError, AppError) are passed to the global handler.
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

    const { id: productId } = req.params; // Renamed from 'id' to 'productId' for clarity with service
    const { variant_id: requestedVariantId, count } = req.query;

    try {
      // Call the service to get the single labelDataItem
      // forAllVariants is false by default in getFormattedLabelData
      const labelDataItem = await productService.getFormattedLabelData(productId, requestedVariantId);

      if (!labelDataItem) { // Should be handled by NotFoundError in service, but as safeguard
        return next(new Error("Could not determine data for label."));
      }

      const pdfBuffer = await generateProductLabelPdf(labelDataItem, count);

      res.setHeader('Content-Type', 'application/pdf');
      const safeSku = (labelDataItem.sku || `product_${labelDataItem.product_id}`).replace(/[^a-z0-9_.-]/gi, '_');
      const fileName = `label_${safeSku}${labelDataItem.variant_id ? '_var_' + labelDataItem.variant_id : ''}.pdf`;
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(pdfBuffer);

    } catch (error) {
      // Errors from productService (NotFoundError, AppError) or generateProductLabelPdf will be passed to global handler.
      next(error);
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

    const { productId } = req.params; // Validated
    // All query params are validated and have defaults set by express-validator
    const options = {
      variant_id: req.query.variant_id,
      page: req.query.page,
      limit: req.query.limit,
      sort_by: req.query.sort_by
    };

    try {
      const result = await productService.getProductInventoryBatches(productId, options);
      // The service returns an object like { data: batches, pagination: {...} }
      // which matches the expected response structure.
      res.status(200).json(result);
    } catch (error) {
      // Errors from productService (NotFoundError, AppError) are passed to the global handler.
      next(error);
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

    const { productId } = req.params; // Validated and toInt() by middleware

    try {
      // Call the service to get label data.
      // Pass forAllVariants = true to get data for base product or all its variants.
      // requestedVariantId is null because this route is for the whole product (all its printable labels).
      const labelsData = await productService.getFormattedLabelData(productId, null, true);

      res.status(200).json(labelsData);

    } catch (error) {
      // Errors from productService (NotFoundError, AppError) will be passed to global handler.
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

    const { productId } = req.params; // Validated
    // All query params are validated and have defaults from express-validator
    const options = {
      variant_id: req.query.variant_id,
      supplier_id: req.query.supplier_id,
      page: req.query.page,
      limit: req.query.limit
    };

    try {
      const result = await productService.getProductCostHistory(productId, options);
      // The service returns an object like { data: costHistory, pagination: {...} }
      // which matches the expected response structure.
      // The pagination from service does not include hasNextPage/hasPrevPage, but that's fine.
      // The route can add it if needed, or frontend can derive it.
      // For consistency with other routes, let's add hasNextPage/hasPrevPage here.
      const { data, pagination } = result;
      const responsePagination = {
        ...pagination,
        hasNextPage: pagination.page < pagination.totalPages,
        hasPrevPage: pagination.page > 1
      };

      res.status(200).json({
        data: data,
        pagination: responsePagination
      });

    } catch (error) {
      // Errors from productService (NotFoundError, AppError) are passed to the global handler.
      next(error);
    }
  }
);

module.exports = router;
