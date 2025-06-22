// backend/routes/settings.js
const express = require('express');
const router = express.Router();
const config = require('../config'); // Import centralized configuration

/**
 * @route   GET /api/settings/logo
 * @desc    Get the site logo URL
 * @access  Public
 */
router.get('/logo', (req, res) => {
  if (config.siteLogoUrl) {
    res.json({ logoUrl: config.siteLogoUrl });
  } else {
    // This case should ideally not be hit if config.js has a proper fallback
    console.warn('/api/settings/logo endpoint called but siteLogoUrl is not defined in config.');
    res.status(404).json({ message: 'Site logo URL not configured.' });
  }
});

/**
 * @route   GET /api/settings/all
 * @desc    Get all public settings (example)
 * @access  Public
 */
// router.get('/all', (req, res) => {
//   res.json({
//     siteName: config.siteName || "My E-commerce Store", // Example of another setting
//     logoUrl: config.siteLogoUrl,
//     // Add other public-facing settings here
//   });
// });

module.exports = router;
