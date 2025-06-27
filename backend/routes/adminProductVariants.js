const express = require('express');
const router = express.Router(); // Will be mounted with /api/admin prefix
// const db = require('../db'); // No longer directly needed
const { isAuthenticated, checkPermission } = require('../auth'); // Use checkPermission
const { body, param, validationResult } = require('express-validator');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');
const productService = require('../services/productService'); // Import productService
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload'); // For variant image uploads

// Protect all routes in this file with a general products:manage_variants permission or similar
// This can be overridden per route if needed.
// router.use(isAuthenticated, checkPermission('products:manage_variants')); // Temporarily commented out to diagnose widespread 403s.
// Individual routes below will now have their own isAuthenticated and checkPermission.

// Note: The helper function getVariantDetailsForResponse is now _getVariantOptionDetails in productService.

// POST /products/:productId/variants - Create a Product Variant
router.post(
  '/products/:productId/variants',
  isAuthenticated,
  checkPermission('products:create'), // Using existing permission admin has
  productImageUploadMiddleware, // Use the same middleware as product images for consistency
  handleMulterError,
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    body('price_modifier').isDecimal().withMessage('Price modifier must be a valid decimal value.').toFloat(),
    body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer.').toInt(),
    body('sku').optional({ checkFalsy: true }).isString().trim().isLength({ min: 1, max: 100 }).withMessage('SKU must be between 1 and 100 characters if provided.'),
    // image_url is for direct URL; actual file upload uses req.file from middleware
    body('image_url').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Image URL must be a valid URL or null.'),
    body('option_value_ids').isArray({ min: 1 }).withMessage('At least one global option value ID is required.'),
    body('option_value_ids.*').isInt({ gt: 0 }).withMessage('Each option value ID must be a positive integer.').toInt(),
    body('cost_price').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().custom(value => {
      if (value !== null && value < 0) { // checkFalsy allows 0, custom validator ensures it's not negative.
        throw new Error('Cost price must be a non-negative decimal.');
      }
      return true;
    }).withMessage('Cost price must be a non-negative decimal or null.'),
    body('wholesale_price_modifier').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().withMessage('Wholesale price modifier must be a decimal value or null.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const variantData = req.body; // Contains all validated and sanitized fields
    const fileData = req.file; // From productImageUploadMiddleware
    const requestingUserId = req.user ? req.user.userId : null;

    try {
      const newVariantWithOptions = await productService.createProductVariant(productId, variantData, fileData, requestingUserId);
      res.status(201).json(newVariantWithOptions);
    } catch (error) {
      // Service layer handles specific errors like NotFoundError, ConflictError, BadRequestError
      next(error);
    }
  }
);

// GET /products/:productId/variants - List Variants for a Product
router.get(
  '/products/:productId/variants',
  isAuthenticated,
  checkPermission('products:view'),
  [param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { productId } = req.params;
    try {
      const variants = await productService.getProductVariants(productId);
      res.json(variants);
    } catch (error) {
      next(error);
    }
  }
);

// GET /variants/:variantId - Get a Specific Variant
router.get(
  '/variants/:variantId',
  isAuthenticated,
  checkPermission('products:view'),
  [param('variantId').isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer.').toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { variantId } = req.params;
    try {
      const variant = await productService.getVariantById(variantId);
      res.json(variant);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /variants/:variantId - Update a Product Variant
router.put(
  '/variants/:variantId',
  isAuthenticated,
  checkPermission('products:edit'),
  [
    param('variantId').isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer.'),
    body('sku').optional({ checkFalsy: true }).isString().trim().isLength({ min: 1, max: 100 }).withMessage('SKU must be between 1 and 100 characters.'),
    body('price_modifier').optional().isDecimal().withMessage('Price modifier must be a valid decimal.'),
    body('stock_quantity').optional().isInt({ gt: -1 }).withMessage('Stock quantity must be an integer (0 or more).'),
    body('image_url').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Image URL must be a valid URL or null.'),
    body('option_value_ids').optional().isArray({min:1}).withMessage('Option values must be a non-empty array if provided.'),
    body('option_value_ids.*').optional().isInt({ gt: 0 }).withMessage('Each option value ID must be a positive integer.'),
    body('reason').optional().isString().trim().withMessage('Reason must be a string if provided.'),
    body('cost_price').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().custom(value => {
      if (value < 0) { // checkFalsy allows 0
        throw new Error('Cost price must be a non-negative decimal.');
      }
      return true;
    }).withMessage('Cost price must be a non-negative decimal or null.'),
    body('wholesale_price_modifier').optional({ nullable: true, checkFalsy: true }).isDecimal({ decimal_digits: '0,2' }).toFloat().withMessage('Wholesale price modifier must be a decimal value or null.')
  ],
  productImageUploadMiddleware, // Added for image uploads
  handleMulterError,            // Added for image uploads
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { variantId } = req.params; // Validated
    const variantData = req.body;     // Validated
    const fileData = req.file;        // From middleware
    const requestingUserId = req.user ? req.user.userId : null;

    // Determine if image removal is intended
    // Explicit null in image_url field means remove. If field not present and no file, image is unchanged.
    const removeImageByFlag = variantData.hasOwnProperty('image_url') && variantData.image_url === null;


    if (Object.keys(variantData).length === 0 && !fileData && !removeImageByFlag) {
        // Fetch current data if no update fields are provided (as service might do this or throw error)
        // This avoids an empty call to the service if that's not desired.
        try {
            const currentVariant = await productService.getVariantById(variantId);
            return res.json(currentVariant);
        } catch (error) {
            return next(error);
        }
    }

    try {
      const updatedVariantWithOptions = await productService.updateProductVariant(
        variantId,
        variantData,
        fileData,
        removeImageByFlag,
        requestingUserId
      );
      res.json(updatedVariantWithOptions);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /variants/:variantId - Delete a Product Variant
router.delete(
  '/variants/:variantId',
  isAuthenticated,
  checkPermission('products:delete'),
  [param('variantId').isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer.').toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { variantId } = req.params; // Validated
    try {
      await productService.deleteProductVariant(variantId);
      // Service method handles NotFoundError and internal transaction.
      // It also handles S3 image deletion if applicable.
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
