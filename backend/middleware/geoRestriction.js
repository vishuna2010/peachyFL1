const geoLocationService = require('../services/geoLocationService');
const logger = require('../utils/logger');

/**
 * Middleware to check if user's country is allowed
 * This middleware should be applied to routes that need geo-restriction
 */
const geoRestrictionMiddleware = async (req, res, next) => {
  try {
    // Skip geo-restriction for admin routes
    if (req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
      return next();
    }

    // Check if geo-restriction is enabled first (avoid unnecessary API calls)
    const isEnabled = await geoLocationService.isGeoRestrictionEnabled();
    
    if (!isEnabled) {
      // Geo-restriction is disabled, allow access immediately
      return next();
    }

    // Get user's IP address
    const userIP = req.ip || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                   req.headers['x-forwarded-for']?.split(',')[0] ||
                   req.headers['x-real-ip'] ||
                   '127.0.0.1';

    // Check if user's country is allowed
    const isAllowed = await geoLocationService.isCountryAllowed(userIP, req);
    
    if (!isAllowed) {
      logger.info(`Geo-restriction: Access denied for IP ${userIP}`);
      
      // Return geo-restriction error
      return res.status(403).json({
        success: false,
        error: 'geo_restriction',
        message: 'This service is not available in your country',
        code: 'GEO_RESTRICTED'
      });
    }

    // Only get country info for logging if geo-restriction is enabled
    const userCountry = await geoLocationService.getCountryFromIP(userIP, req);
    req.userCountry = userCountry;
    
    next();
  } catch (error) {
    logger.error('Error in geo-restriction middleware:', error);
    // Fail open - allow access if there's an error
    next();
  }
};

/**
 * Optional middleware to add country info to response headers
 * Useful for debugging and analytics
 */
const addCountryHeaders = async (req, res, next) => {
  try {
    // Check if geo-restriction is enabled first
    const isEnabled = await geoLocationService.isGeoRestrictionEnabled();
    
    if (!isEnabled) {
      // Skip country detection if geo-restriction is disabled
      return next();
    }

    const userIP = req.ip || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                   req.headers['x-forwarded-for']?.split(',')[0] ||
                   req.headers['x-real-ip'] ||
                   '127.0.0.1';

    const userCountry = await geoLocationService.getCountryFromIP(userIP, req);
    if (userCountry) {
      res.setHeader('X-User-Country', userCountry);
    }
    
    next();
  } catch (error) {
    logger.error('Error adding country headers:', error);
    next();
  }
};

module.exports = {
  geoRestrictionMiddleware,
  addCountryHeaders
}; 