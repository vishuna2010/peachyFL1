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

module.exports = router;
