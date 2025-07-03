const express = require('express');
const router = express.Router();
const cmsService = require('../services/cmsService');
const { isAuthenticated, checkPermission } = require('../auth'); // Assuming auth.js is in the parent directory
const { query, param, body, validationResult } = require('express-validator');
const { AppError } = require('../utils/AppError');

/**
 * @route GET /api/admin/hero-banners
 * @description Get all hero banners for admin (paginated, sorted)
 * @access Admin - requires 'marketing:manage_hero_banners' permission
 */
router.get(
  '/',
  isAuthenticated,
  checkPermission('marketing:manage_hero_banners'),
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('sortBy').optional().trim().escape().default('sort_order'), // Basic sanitization
    query('sortOrder').optional().trim().toUpperCase().isIn(['ASC', 'DESC']).default('ASC')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const options = {
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      };
      const result = await cmsService.getAllHeroBanners(options);
      // Service returns { banners, totalBanners, totalPages, currentPage, limit }
      res.json({
        data: result.banners,
        pagination: {
          totalItems: result.totalBanners,
          totalPages: result.totalPages,
          currentPage: result.currentPage,
          limit: result.limit
        }
      });
    } catch (error) {
      console.error('Error in GET /admin/hero-banners route:', error);
      next(error);
    }
  }
);

const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload'); // Import middleware

// Validation middleware for banner data
const validateBannerData = [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters.'),
  body('subtitle').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Subtitle cannot exceed 500 characters.'),
  body('buttonText').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Button text cannot exceed 100 characters.'),
  body('buttonLink').optional({ checkFalsy: true }).trim().isURL().withMessage('Button link must be a valid URL or a relative path.').isLength({ max: 255 }).withMessage('Button link cannot exceed 255 characters.'),
  // imageUrl is now optional if uploading a file, required if no file is uploaded and not in edit mode
  body('imageUrl').optional({ checkFalsy: true }).isURL().withMessage('Image URL must be a valid URL if provided directly.').isLength({ max: 255 }).withMessage('Image URL cannot exceed 255 characters.'),
  body('altText').optional({ checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('Alt text cannot exceed 255 characters.'),
  body('isActive').optional().isBoolean().withMessage('Is active must be a boolean.').toBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer.').toInt()
];

// POST /api/admin/hero-banners - Create new hero banner
router.post(
  '/',
  isAuthenticated,
  checkPermission('marketing:manage_hero_banners'),
  productImageUploadMiddleware, // Use middleware for 'bannerImage' field
  handleMulterError,
  validateBannerData,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // Provide default values if not present, especially for optional fields that have DB defaults or constraints
      const bannerData = {
        title: req.body.title,
        subtitle: req.body.subtitle || null,
        buttonText: req.body.buttonText || null,
        buttonLink: req.body.buttonLink || null,
        imageUrl: req.body.imageUrl,
        altText: req.body.altText || null,
        isActive: req.body.isActive === undefined ? true : req.body.isActive,
        sortOrder: req.body.sortOrder === undefined ? 0 : req.body.sortOrder,
      };
      // Pass req.file to the service layer
      const newBanner = await cmsService.createHeroBanner(bannerData, req.file);
      res.status(201).json({ data: newBanner });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/hero-banners/:id - Get single hero banner
router.get(
  '/:id',
  isAuthenticated,
  checkPermission('marketing:manage_hero_banners'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Banner ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const banner = await cmsService.getHeroBannerById(req.params.id);
      // Service throws NotFoundError if not found, which will be handled by global error handler
      res.json({ data: banner });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/hero-banners/:id - Update hero banner
router.put(
  '/:id',
  isAuthenticated,
  checkPermission('marketing:manage_hero_banners'),
  productImageUploadMiddleware, // Use middleware for 'bannerImage' field
  handleMulterError,
  [
    param('id').isInt({ gt: 0 }).withMessage('Banner ID must be a positive integer.').toInt(),
    ...validateBannerData // Reuse the same validation rules as for POST
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // Ensure all fields are passed to the service, even if they didn't change,
      // as the service's UPDATE query updates all fields.
      // Alternatively, the service could be modified to build a dynamic SET clause.
      // For now, assume the service expects all fields for an update.
      const bannerData = {
        title: req.body.title,
        subtitle: req.body.subtitle || null,
        buttonText: req.body.buttonText || null,
        buttonLink: req.body.buttonLink || null,
        imageUrl: req.body.imageUrl,
        altText: req.body.altText || null,
        isActive: req.body.isActive === undefined ? true : req.body.isActive,
        sortOrder: req.body.sortOrder === undefined ? 0 : req.body.sortOrder,
      };
      const removeImageFlag = req.body.remove_image === 'true';
      // Pass req.file and removeImageFlag to the service layer
      const updatedBanner = await cmsService.updateHeroBanner(req.params.id, bannerData, req.file, removeImageFlag);
      res.json({ data: updatedBanner });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/hero-banners/:id - Delete hero banner
router.delete(
  '/:id',
  isAuthenticated,
  checkPermission('marketing:manage_hero_banners'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Banner ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const deletedBanner = await cmsService.deleteHeroBanner(req.params.id);
      // Service throws NotFoundError if not found, handled by global error handler
      // Return 200 with deleted banner data, or 204 No Content.
      // For consistency with GET/PUT, returning data might be useful for client.
      res.status(200).json({ message: `Hero banner with ID ${req.params.id} deleted successfully.`, data: deletedBanner });
      // Alternatively: res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
