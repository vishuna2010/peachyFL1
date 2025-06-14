const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');
const { body, param, query, validationResult } = require('express-validator');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

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
    })
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


// POST / - Create a new category
router.post('/', validateCreateCategory, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, description, parent_category_id } = req.body;

  try {
    const result = await db.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name, description, parent_category_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_key') {
      return next(new ConflictError(`A category with the name "${name}" already exists.`));
    }
    return next(error);
  }
});

// GET / - List all categories with pagination
router.get('/', validatePaginationParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { page, limit } = req.query;
  const offset = (page - 1) * limit;

  try {
    const categoriesQuery = `
      SELECT c.id, c.name, c.description, c.parent_category_id, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.description, c.parent_category_id
      ORDER BY c.name ASC
      LIMIT $1 OFFSET $2;
    `;
    const categoriesResult = await db.query(categoriesQuery, [limit, offset]);

    const totalCategoriesQuery = 'SELECT COUNT(*) FROM categories';
    const totalCategoriesResult = await db.query(totalCategoriesQuery);
    const totalCategories = parseInt(totalCategoriesResult.rows[0].count);

    res.status(200).json({
      data: categoriesResult.rows.map(c => ({...c, product_count: parseInt(c.product_count, 10)})),
      pagination: {
        total: totalCategories,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCategories / limit)
      }
    });
  } catch (error) {
    return next(error);
  }
});

// GET /:id - Get a single category by ID
router.get('/:id', validateCategoryIdParam, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id: categoryId } = req.params;

  try {
    const categoryQuery = `
      SELECT c.id, c.name, c.description, c.parent_category_id, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.description, c.parent_category_id;
    `;
    const result = await db.query(categoryQuery, [categoryId]);

    if (result.rows.length === 0) {
      return next(new NotFoundError(`Category with ID ${categoryId} not found.`));
    }
    const category = result.rows[0];
    category.product_count = parseInt(category.product_count, 10);

    res.status(200).json(category);
  } catch (error) {
    return next(error);
  }
});

// PUT /:id - Update a category
router.put('/:id', validateCategoryIdParam, validateUpdateCategory, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id: categoryId } = req.params;
  const { name, description, parent_category_id } = req.body;

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) { setClauses.push(`name = $${paramIndex++}`); values.push(name); }
  // For description and parent_category_id, we need to handle them even if they are explicitly set to null
  if (req.body.hasOwnProperty('description')) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(description);
  }
  if (req.body.hasOwnProperty('parent_category_id')) {
    setClauses.push(`parent_category_id = $${paramIndex++}`);
    values.push(parent_category_id);
  }

  if (setClauses.length === 0) {
    return next(new BadRequestError('No fields provided for update.'));
  }
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(categoryId);

  try {
    const query = `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return next(new NotFoundError(`Category with ID ${categoryId} not found. Update failed.`));
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_key') {
      return next(new ConflictError(`A category with the name "${name}" already exists.`));
    }
    if (error.code === '23503' && error.constraint === 'categories_parent_category_id_fkey') { // Should be caught by custom validator, but as fallback
        return next(new BadRequestError('Invalid parent_category_id. The specified parent category does not exist.'));
    }
    return next(error);
  }
});

// DELETE /:id - Delete a category
router.delete('/:id', validateCategoryIdParam, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id: categoryId } = req.params;

  try {
    const productCountResult = await db.query('SELECT COUNT(*) AS count FROM products WHERE category_id = $1', [categoryId]);
    const productCount = parseInt(productCountResult.rows[0].count, 10);

    if (productCount > 0) {
      return next(new BadRequestError(`Category is in use by ${productCount} product(s) and cannot be deleted. Please reassign products or delete them first.`));
    }

    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [categoryId]);

    if (result.rowCount === 0) {
      return next(new NotFoundError(`Category with ID ${categoryId} not found.`));
    }

    res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
