const express = require('express');
const router = express.Router();
const { isAuthenticated, checkPermission } = require('../auth');
const geoLocationService = require('../services/geoLocationService');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(isAuthenticated);
router.use(checkPermission('settings:manage_general'));

// GET /api/admin/geo-location/providers - Get available geo-location providers
router.get('/providers', async (req, res, next) => {
  try {
    const providers = geoLocationService.getAvailableProviders();
    const currentProvider = await geoLocationService.getCurrentProvider();
    const apiKey = await geoLocationService.getApiKey();
    const allowedCountries = await geoLocationService.getAllowedCountries();
    const isEnabled = await geoLocationService.isGeoRestrictionEnabled();

    res.status(200).json({
      success: true,
      providers,
      currentProvider: {
        key: Object.keys(geoLocationService.providers).find(key => 
          geoLocationService.providers[key].name === currentProvider.name
        ),
        name: currentProvider.name,
        description: currentProvider.description,
        requiresApiKey: currentProvider.requiresApiKey
      },
      apiKey: apiKey ? '***' + apiKey.slice(-4) : '', // Show last 4 characters
      allowedCountries,
      isEnabled
    });
  } catch (error) {
    logger.error('Error getting geo-location providers:', error);
    return next(error);
  }
});

// POST /api/admin/geo-location/test - Test the current geo-location service
router.post('/test', async (req, res, next) => {
  try {
    const { testIP } = req.body;
    const result = await geoLocationService.testService(testIP || '8.8.8.8');
    
    res.status(200).json({
      success: true,
      test: result
    });
  } catch (error) {
    logger.error('Error testing geo-location service:', error);
    return next(error);
  }
});

// GET /api/admin/geo-location/status - Get geo-location status and statistics
router.get('/status', async (req, res, next) => {
  try {
    const currentProvider = await geoLocationService.getCurrentProvider();
    const allowedCountries = await geoLocationService.getAllowedCountries();
    const isEnabled = await geoLocationService.isGeoRestrictionEnabled();
    const apiKey = await geoLocationService.getApiKey();

    // Test with a known IP (Google DNS)
    const testResult = await geoLocationService.testService('8.8.8.8');

    res.status(200).json({
      success: true,
      status: {
        isEnabled,
        provider: currentProvider.name,
        providerKey: Object.keys(geoLocationService.providers).find(key => 
          geoLocationService.providers[key].name === currentProvider.name
        ),
        allowedCountriesCount: allowedCountries.length,
        allowedCountries,
        hasApiKey: !!apiKey,
        testResult
      }
    });
  } catch (error) {
    logger.error('Error getting geo-location status:', error);
    return next(error);
  }
});

// POST /api/admin/geo-location/check-ip - Check a specific IP address
router.post('/check-ip', async (req, res, next) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }

    const currentProvider = await geoLocationService.getCurrentProvider();
    const userCountry = await geoLocationService.getCountryFromIP(ip);
    const allowedCountries = await geoLocationService.getAllowedCountries();
    const isAllowed = allowedCountries.includes(userCountry);

    res.status(200).json({
      success: true,
      check: {
        ip,
        detectedCountry: userCountry,
        allowedCountries,
        isAllowed,
        provider: currentProvider.name,
        message: userCountry 
          ? `IP ${ip} is from ${userCountry} and is ${isAllowed ? 'allowed' : 'not allowed'}`
          : `Could not determine country for IP ${ip}`
      }
    });
  } catch (error) {
    logger.error('Error checking IP address:', error);
    return next(error);
  }
});

module.exports = router; 