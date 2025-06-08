const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// POST / - Create a new category
router.post('/', async (req, res, next) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return next(new BadRequestError('Category name is required and must be a non-empty string.'));
  }

  try {
    const result = await db.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_key') { // Handle unique constraint violation for category name
      return next(new ConflictError(`A category with the name "${name.trim()}" already exists.`));
    }
    return next(error); // Pass other errors to the global error handler
  }
});

// GET / - List all categories with pagination
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (isNaN(page) || page < 1) {
    return next(new BadRequestError('Page number must be a positive integer.'));
  }
  if (isNaN(limit) || limit < 1 || limit > 100) { // Max limit of 100 for sensibility
    return next(new BadRequestError('Limit must be a positive integer between 1 and 100.'));
  }

  const offset = (page - 1) * limit;

  try {
    const categoriesQuery = 'SELECT id, name FROM categories ORDER BY name ASC LIMIT $1 OFFSET $2';
    const categoriesResult = await db.query(categoriesQuery, [limit, offset]);

    const totalCategoriesQuery = 'SELECT COUNT(*) FROM categories';
    const totalCategoriesResult = await db.query(totalCategoriesQuery);
    const totalCategories = parseInt(totalCategoriesResult.rows[0].count);

    res.status(200).json({
      data: categoriesResult.rows,
      pagination: {
        total: totalCategories,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCategories / limit)
      }
    });
  } catch (error) {
    return next(error); // Pass errors to the global error handler
  }
});

// GET /:id - Get a single category by ID
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  const categoryId = parseInt(id);

  if (isNaN(categoryId) || categoryId <= 0) {
    return next(new BadRequestError('Category ID must be a positive integer.'));
  }

  try {
    const result = await db.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]);

    if (result.rows.length === 0) {
      return next(new NotFoundError(`Category with ID ${categoryId} not found.`));
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error); // Pass errors to the global error handler
  }
});

// PUT /:id - Update a category
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const categoryId = parseInt(id);
  const { name } = req.body;

  if (isNaN(categoryId) || categoryId <= 0) {
    return next(new BadRequestError('Category ID must be a positive integer.'));
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return next(new BadRequestError('Category name is required and must be a non-empty string.'));
  }

  try {
    const result = await db.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), categoryId]
    );

    if (result.rows.length === 0) {
      return next(new NotFoundError(`Category with ID ${categoryId} not found. Update failed.`));
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_key') { // Handle unique constraint violation for category name
      return next(new ConflictError(`A category with the name "${name.trim()}" already exists.`));
    }
    return next(error); // Pass other errors to the global error handler
  }
});

// DELETE /:id - Delete a category
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  const categoryId = parseInt(id);

  if (isNaN(categoryId) || categoryId <= 0) {
    return next(new BadRequestError('Category ID must be a positive integer.'));
  }

  try {
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING *', [categoryId]);

    if (result.rows.length === 0) {
      return next(new NotFoundError(`Category with ID ${categoryId} not found.`));
    }

    // The ON DELETE SET NULL constraint on products.category_id will handle associated products.
    res.status(200).json({ message: `Category with ID ${categoryId} deleted successfully.` });
  } catch (error) {
    // Foreign key violations from other tables (if any direct FKs without ON DELETE CASCADE/SET NULL existed)
    // would typically be caught by a specific error code if not handled by schema.
    // For now, any unexpected DB error goes to global handler.
    return next(error);
  }
});

module.exports = router;
