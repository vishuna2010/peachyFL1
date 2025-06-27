const express = require('express');
const router = express.Router();
const productService = require('../services/productService'); // Import productService
const { AppError } = require('../utils/AppError'); // AppError might still be used if needed directly, or rely on service errors

// GET /api/options/public-filters - Fetch options and values for public product filtering
router.get('/public-filters', async (req, res, next) => {
  try {
    const filterOptions = await productService.getPublicProductFilterOptions();
    res.json(filterOptions);
  } catch (error) {
    // Errors from the service (expected to be AppError instances) are passed to the global error handler
    next(error);
  }
});

module.exports = router;
