const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService'); // Import categoryService
// Removed db import as it's no longer directly used here

// GET /api/categories - Fetch all categories
router.get('/', async (req, res, next) => { // Added next parameter
  try {
    const categories = await categoryService.getAllPublicCategories();
    res.status(200).json(categories);
  } catch (error) {
    // Pass errors to the global error handler
    // The service function is expected to throw an AppError for DB issues.
    next(error);
  }
});

// GET /api/categories/menu - Fetch categories for menu bar
router.get('/menu', async (req, res, next) => {
  try {
    const menuCategories = await categoryService.getMenuCategories();
    res.status(200).json(menuCategories);
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/slug/:slug - Fetch a single category by its slug
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      // Basic validation, can be enhanced with express-validator
      return res.status(400).json({ message: 'Category slug must be a non-empty string.' });
    }
    // Assuming a new service method getCategoryBySlug exists
    const category = await categoryService.getCategoryBySlug(slug.trim());
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }
    res.status(200).json(category);
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id - Fetch a single category by its ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({ message: 'Category ID must be a positive integer.' });
    }
    
    const category = await categoryService.getCategoryById(categoryId);
    res.status(200).json(category);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
