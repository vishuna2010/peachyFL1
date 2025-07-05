const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth'); // Replaced isAdmin with checkPermission
const auditLogService = require('../services/auditLogService');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');
const { body, param, query, validationResult } = require('express-validator');

// Apply auth middleware to all routes in this router
// router.use(isAuthenticated, isAdmin); // REMOVED - will apply per route

// Validation Chains
const validateCategoryIdParam = [
  param('id').isInt({ gt: 0 }).withMessage('Category ID must be a positive integer.').toInt()
];

const validatePaginationParams = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt().default(10)
];

const commonCategoryValidationRules = [
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string if provided.')
    .trim()
    .isLength({ max: 500 }).withMessage('Description can be at most 500 characters.'),
  body('parent_category_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ gt: 0 }).withMessage('Parent category ID must be a positive integer if provided.')
    .toInt()
    .custom(async (value, { req }) => {
      if (value) {
        if (req.params && req.params.id && value === parseInt(req.params.id)) {
          throw new Error('A category cannot be its own parent.');
        }
        const category = await db.query('SELECT id FROM categories WHERE id = $1', [value]);
        if (category.rows.length === 0) {
          throw new Error('Parent category ID does not exist.');
        }
      }
      return true;
    }),
  body('image_url')
    .optional({ nullable: true, checkFalsy: true })
    .isURL().withMessage('Image URL must be a valid URL if provided.')
    .trim()
];

const validateCreateCategory = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required.')
    .isString().withMessage('Category name must be a string.')
    .isLength({ min: 2, max: 100 }).withMessage('Category name must be between 2 and 100 characters.'),
  ...commonCategoryValidationRules
];

const validateUpdateCategory = [
  body('name')
    .optional()
    .trim()
    .isString().withMessage('Category name must be a string if provided.')
    .isLength({ min: 2, max: 100 }).withMessage('Category name must be between 2 and 100 characters if provided.'),
  ...commonCategoryValidationRules
];


const categoryService = require('../services/categoryService'); // Import the new service

// POST / - Create a new category
router.post('/', isAuthenticated, checkPermission('categories:manage'), validateCreateCategory, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, description, parent_category_id, image_url } = req.body;

  try {
    const newCategory = await categoryService.createCategory(name, description, parent_category_id, image_url);
    // newCategory is guaranteed to be populated if createCategory doesn't throw

    auditLogService.recordAuditEvent(
      'CATEGORY_CREATE_SUCCESS',
      { userId: req.user.userId, userEmail: req.user.email },
      { resourceType: 'CATEGORY', resourceId: newCategory.id },
      { createdData: { name: newCategory.name, description: newCategory.description, parent_category_id: newCategory.parent_category_id, image_url: newCategory.image_url } },
      req
    ).catch(err => console.error('Audit log failed for CATEGORY_CREATE_SUCCESS:', err));

    res.status(201).json(newCategory);
  } catch (error) {
    // Errors like ConflictError, BadRequestError, or AppError thrown by the service will be passed to next()
    // The global error handler will then format them.
    return next(error);
  }
});

// GET / - List all categories with pagination
router.get('/', isAuthenticated, checkPermission('categories:manage'), validatePaginationParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { page, limit } = req.query; // Already validated and defaulted by middleware

  try {
    const result = await categoryService.getAllCategories(page, limit);
    res.status(200).json({
      data: result.categories,
      pagination: {
        total: result.totalCategories,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    return next(error); // Pass errors to global error handler
  }
});

// GET /:id - Get a single category by ID
router.get('/:id', isAuthenticated, checkPermission('categories:manage'), validateCategoryIdParam, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id: categoryId } = req.params; // Already validated

  try {
    const category = await categoryService.getCategoryById(categoryId);
    // Service throws NotFoundError if not found, which will be handled by next(error)
    res.status(200).json(category);
  } catch (error) {
    return next(error); // Pass errors (including NotFoundError from service) to global handler
  }
});

// PUT /:id - Update a category
router.put('/:id', isAuthenticated, checkPermission('categories:manage'), validateCategoryIdParam, validateUpdateCategory, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id: categoryId } = req.params; // Validated
  const updateData = req.body; // Contains name, description, parent_category_id (all optional)

  // Check if there's any actual data to update.
  // The custom validator for parent_category_id runs even if it's not explicitly in req.body but is null/undefined.
  // So, we need to ensure at least one of name, description, or parent_category_id is actually present in the body.
  if (!updateData.hasOwnProperty('name') && !updateData.hasOwnProperty('description') && !updateData.hasOwnProperty('parent_category_id')) {
    // If the service's updateCategory fetches current state on empty updateData, this check isn't strictly needed.
    // However, it's good practice for a route handler to ensure valid update intent.
    // For now, we'll rely on the service to handle empty updateData if that's its design.
    // If service throws error for no fields, this is fine.
    // If service returns current data, that's also acceptable.
  }

  try {
    // Pass only the relevant fields to the service.
    // The service will construct the SET clauses.
    const categoryToUpdate = {};
    if (updateData.hasOwnProperty('name')) categoryToUpdate.name = updateData.name;
    if (updateData.hasOwnProperty('description')) categoryToUpdate.description = updateData.description;
    if (updateData.hasOwnProperty('parent_category_id')) categoryToUpdate.parent_category_id = updateData.parent_category_id;

    if (Object.keys(categoryToUpdate).length === 0) {
        return next(new BadRequestError('No valid fields provided for update.'));
    }

    const updatedCategory = await categoryService.updateCategory(categoryId, categoryToUpdate);

    auditLogService.recordAuditEvent(
      'CATEGORY_UPDATE_SUCCESS',
      { userId: req.user.userId, userEmail: req.user.email },
      { resourceType: 'CATEGORY', resourceId: updatedCategory.id },
      // Log the data that was actually sent for update, and the result.
      { inputData: categoryToUpdate, updatedCategoryData: updatedCategory },
      req
    ).catch(err => console.error('Audit log failed for CATEGORY_UPDATE_SUCCESS:', err));

    res.status(200).json(updatedCategory);
  } catch (error) {
    // Errors from service (NotFoundError, ConflictError, BadRequestError, AppError) passed to global handler.
    return next(error);
  }
});

// DELETE /:id - Delete a category
router.delete('/:id', isAuthenticated, checkPermission('categories:manage'), validateCategoryIdParam, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id: categoryId } = req.params; // Validated

  try {
    await categoryService.deleteCategory(categoryId);
    // Service handles NotFoundError and BadRequestError (if category is in use)

    auditLogService.recordAuditEvent(
      'CATEGORY_DELETE_SUCCESS',
      { userId: req.user.userId, userEmail: req.user.email },
      { resourceType: 'CATEGORY', resourceId: categoryId },
      { deletedDataIdentifier: { id: categoryId } }, // Log the ID of the deleted category
      req
    ).catch(err => console.error('Audit log failed for CATEGORY_DELETE_SUCCESS:', err));

    res.status(204).send();
  } catch (error) {
    // Errors from service (NotFoundError, BadRequestError, AppError) passed to global handler.
    return next(error);
  }
});

module.exports = router;
