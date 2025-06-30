const express = require('express');
const router = express.Router();
const cmsService = require('../services/cmsService');
const { AppError } = require('../utils/AppError'); // Assuming you have an AppError utility

/**
 * @route GET /api/cms/hero-banners/active
 * @description Get all active hero banners
 * @access Public
 */
router.get('/hero-banners/active', async (req, res, next) => {
  try {
    const activeBanners = await cmsService.getActiveHeroBanners();
    // The frontend expects an object with a 'banners' key containing the array
    res.json({ banners: activeBanners });
  } catch (error) {
    console.error('Error in GET /hero-banners/active route:', error);
    // Pass to the global error handler, or handle more specifically
    // For now, a generic error response.
    // If using AppError: next(new AppError('Could not retrieve hero banners', 500));
    next(error); // Let global error handler manage it
  }
});

module.exports = router;
