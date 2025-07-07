const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { isAuthenticated, checkPermission } = require('../auth');
const db = require('../db');
const logger = require('../utils/logger');
const { productImageUploadMiddleware, handleMulterError } = require('../middleware/fileUpload');
const s3Service = require('../services/s3Service');

// Apply authentication middleware to all routes except public settings
router.use((req, res, next) => {
  // Skip authentication for public settings endpoint
  if (req.path === '/public') {
    return next();
  }
  return isAuthenticated(req, res, next);
});

router.use((req, res, next) => {
  // Skip permission check for public settings endpoint
  if (req.path === '/public') {
    return next();
  }
  return checkPermission('settings:manage_general')(req, res, next);
});

// GET /api/admin/settings - Get all site settings
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        setting_key,
        setting_value,
        setting_type,
        setting_description,
        is_public,
        created_at,
        updated_at
      FROM site_settings 
      ORDER BY setting_key
    `);
    
    // If no settings exist, initialize them
    if (result.rows.length === 0) {
      logger.info('No settings found, initializing default settings...');
      // Call the initialize endpoint logic
      const defaultSettings = [
        {
          key: 'site_name',
          value: 'PeachyFL Store',
          type: 'string',
          description: 'The name of the website/store',
          is_public: true
        },
        {
          key: 'site_description',
          value: 'Your one-stop shop for amazing products',
          type: 'string',
          description: 'Brief description of the website',
          is_public: true
        },
        {
          key: 'default_locale',
          value: 'en-US',
          type: 'string',
          description: 'Default locale for the website',
          is_public: true
        },
        {
          key: 'default_currency',
          value: 'USD',
          type: 'string',
          description: 'Default currency for the website',
          is_public: true
        },
        {
          key: 'currency_symbol',
          value: '$',
          type: 'string',
          description: 'Currency symbol to display',
          is_public: true
        },
        {
          key: 'timezone',
          value: 'America/New_York',
          type: 'string',
          description: 'Default timezone for the website',
          is_public: true
        },
        {
          key: 'service_locations',
          value: 'US,CA,GB,DE,FR,IT,ES,NL,JP,KR,CN,AU,SG,IN',
          type: 'string',
          description: 'Comma-separated list of country codes where the service is available',
          is_public: true
        },
        {
          key: 'geo_location_service',
          value: 'ipapi',
          type: 'string',
          description: 'Geo-location service provider (ipapi, maxmind, cloudflare, none)',
          is_public: false
        },
        {
          key: 'geo_location_api_key',
          value: '',
          type: 'string',
          description: 'API key for geo-location service (if required)',
          is_public: false
        },
        {
          key: 'contact_email',
          value: 'contact@peachyfl.com',
          type: 'string',
          description: 'Primary contact email address',
          is_public: true
        },
        {
          key: 'contact_phone',
          value: '+1 (555) 123-4567',
          type: 'string',
          description: 'Primary contact phone number',
          is_public: true
        },
        {
          key: 'address',
          value: '123 Main Street, City, State 12345',
          type: 'string',
          description: 'Business address',
          is_public: true
        },
        {
          key: 'social_facebook',
          value: '',
          type: 'string',
          description: 'Facebook page URL',
          is_public: true
        },
        {
          key: 'social_instagram',
          value: '',
          type: 'string',
          description: 'Instagram profile URL',
          is_public: true
        },
        {
          key: 'social_twitter',
          value: '',
          type: 'string',
          description: 'Twitter profile URL',
          is_public: true
        },
        {
          key: 'maintenance_mode',
          value: 'false',
          type: 'boolean',
          description: 'Enable maintenance mode',
          is_public: false
        },
        {
          key: 'maintenance_message',
          value: 'We are currently performing maintenance. Please check back soon.',
          type: 'string',
          description: 'Message to display during maintenance',
          is_public: false
        },
        {
          key: 'order_confirmation_email_template',
          value: 'default',
          type: 'string',
          description: 'Email template for order confirmations',
          is_public: false
        },
        {
          key: 'shipping_calculator_enabled',
          value: 'true',
          type: 'boolean',
          description: 'Enable shipping cost calculator',
          is_public: true
        },
        {
          key: 'tax_calculator_enabled',
          value: 'true',
          type: 'boolean',
          description: 'Enable tax calculation',
          is_public: true
        },
        {
          key: 'guest_checkout_enabled',
          value: 'true',
          type: 'boolean',
          description: 'Allow guest checkout',
          is_public: true
        },
        {
          key: 'reviews_enabled',
          value: 'true',
          type: 'boolean',
          description: 'Enable product reviews',
          is_public: true
        },
        {
          key: 'wishlist_enabled',
          value: 'true',
          type: 'boolean',
          description: 'Enable wishlist functionality',
          is_public: true
        },
        {
          key: 'new_arrivals_days',
          value: '30',
          type: 'number',
          description: 'Number of days to consider products as "new arrivals"',
          is_public: true
        },
        {
          key: 'site_logo',
          value: '',
          type: 'string',
          description: 'URL of the site logo',
          is_public: true
        },
        {
          key: 'system_country',
          value: 'BS',
          type: 'string',
          description: 'Default country for system operations (tax calculation, shipping, etc.)',
          is_public: false
        },
        {
          key: 'system_state',
          value: 'NP',
          type: 'string',
          description: 'Default state/province for system operations (tax calculation, shipping, etc.)',
          is_public: false
        },
        {
          key: 'system_postal_code',
          value: '',
          type: 'string',
          description: 'Default postal code for system operations (tax calculation, shipping, etc.)',
          is_public: false
        }
      ];

      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        for (const setting of defaultSettings) {
          await client.query(`
            INSERT INTO site_settings (setting_key, setting_value, setting_type, setting_description, is_public)
            VALUES ($1, $2, $3, $4, $5)
          `, [setting.key, setting.value, setting.type, setting.description, setting.is_public]);
        }
        
        await client.query('COMMIT');
        logger.info('Default settings initialized successfully');
        
        // Fetch the newly created settings
        const newResult = await db.query(`
          SELECT 
            setting_key,
            setting_value,
            setting_type,
            setting_description,
            is_public,
            created_at,
            updated_at
          FROM site_settings 
          ORDER BY setting_key
        `);
        
        res.status(200).json({
          success: true,
          settings: newResult.rows
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      res.status(200).json({
        success: true,
        settings: result.rows
      });
    }
  } catch (error) {
    logger.error('Error fetching site settings:', error);
    return next(error);
  }
});

// GET /api/admin/settings/public - Get public settings (for frontend)
router.get('/public', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        setting_key,
        setting_value,
        setting_type
      FROM site_settings 
      WHERE is_public = true
      ORDER BY setting_key
    `);
    
    // Convert to key-value object for easier frontend consumption
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_value,
        type: row.setting_type
      };
    });
    
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    logger.error('Error fetching public site settings:', error);
    return next(error);
  }
});

// PUT /api/admin/settings - Update site settings
router.put('/', [
  body('settings').isArray().withMessage('Settings must be an array'),
  body('settings.*.key').isString().trim().notEmpty().withMessage('Setting key is required'),
  body('settings.*.value').custom((value, { req, path }) => {
    // Allow empty strings for certain settings
    const settingIndex = parseInt(path.match(/settings\[(\d+)\]\.value/)?.[1]);
    if (settingIndex !== undefined && req.body.settings && req.body.settings[settingIndex]) {
      const settingKey = req.body.settings[settingIndex].key;
      // Allow empty values for social media and optional settings
      const allowedEmptySettings = [
        'social_facebook', 'social_instagram', 'social_twitter', 
        'site_logo', 'maintenance_message', 'order_confirmation_email_template',
        'service_locations', 'facebook_pixel_id', 'google_analytics_id', 'order_number_suffix',
        'geo_location_service', 'geo_location_api_key', 'system_postal_code'
      ];
      if (allowedEmptySettings.includes(settingKey)) {
        return true; // Allow empty value
      }
    }
    // For other settings, require non-empty value
    if (value === undefined || value === null || value === '') {
      throw new Error('Setting value is required');
    }
    return true;
  }).withMessage('Setting value is required'),
], async (req, res, next) => {
  try {
    logger.info('Received settings update request body:');
    logger.info(JSON.stringify(req.body, null, 2));
    // Add extra debug logging for empty values
    if (Array.isArray(req.body.settings)) {
      req.body.settings.forEach((setting, idx) => {
        const allowedEmptySettings = [
          'social_facebook', 'social_instagram', 'social_twitter', 
          'site_logo', 'maintenance_message', 'order_confirmation_email_template',
          'service_locations', 'facebook_pixel_id', 'google_analytics_id', 'order_number_suffix',
          'geo_location_service', 'geo_location_api_key', 'system_postal_code'
        ];
        if ((setting.value === undefined || setting.value === null || setting.value === '') && !allowedEmptySettings.includes(setting.key)) {
          logger.warn(`Setting at index ${idx} with key '${setting.key}' is empty and not allowed to be empty.`);
        }
      });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Settings validation failed: ' + JSON.stringify(errors.array(), null, 2));
      logger.error('Settings array: ' + JSON.stringify(req.body.settings, null, 2));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { settings } = req.body;
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const setting of settings) {
        await client.query(`
          UPDATE site_settings 
          SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = $2
        `, [setting.value, setting.key]);
      }
      
      await client.query('COMMIT');
      
      // Fetch updated settings
      const result = await db.query(`
        SELECT 
          setting_key,
          setting_value,
          setting_type,
          setting_description,
          is_public,
          created_at,
          updated_at
        FROM site_settings 
        ORDER BY setting_key
      `);
      
      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        settings: result.rows
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error updating site settings:', error);
    return next(error);
  }
});

// POST /api/admin/settings/initialize - Initialize default settings
router.post('/initialize', async (req, res, next) => {
  try {
    const defaultSettings = [
      {
        key: 'site_name',
        value: 'PeachyFL Store',
        type: 'string',
        description: 'The name of the website/store',
        is_public: true
      },
      {
        key: 'site_description',
        value: 'Your one-stop shop for amazing products',
        type: 'string',
        description: 'Brief description of the website',
        is_public: true
      },
      {
        key: 'default_locale',
        value: 'en-US',
        type: 'string',
        description: 'Default locale for the website',
        is_public: true
      },
      {
        key: 'default_currency',
        value: 'USD',
        type: 'string',
        description: 'Default currency for the website',
        is_public: true
      },
      {
        key: 'currency_symbol',
        value: '$',
        type: 'string',
        description: 'Currency symbol to display',
        is_public: true
      },
      {
        key: 'timezone',
        value: 'America/New_York',
        type: 'string',
        description: 'Default timezone for the website',
        is_public: true
      },
      {
        key: 'service_locations',
        value: 'US,CA,GB,DE,FR,IT,ES,NL,JP,KR,CN,AU,SG,IN',
        type: 'string',
        description: 'Comma-separated list of country codes where the service is available',
        is_public: true
      },
      {
        key: 'contact_email',
        value: 'contact@peachyfl.com',
        type: 'string',
        description: 'Primary contact email address',
        is_public: true
      },
      {
        key: 'contact_phone',
        value: '+1 (555) 123-4567',
        type: 'string',
        description: 'Primary contact phone number',
        is_public: true
      },
      {
        key: 'address',
        value: '123 Main Street, City, State 12345',
        type: 'string',
        description: 'Business address',
        is_public: true
      },
      {
        key: 'social_facebook',
        value: '',
        type: 'string',
        description: 'Facebook page URL',
        is_public: true
      },
      {
        key: 'social_instagram',
        value: '',
        type: 'string',
        description: 'Instagram profile URL',
        is_public: true
      },
      {
        key: 'social_twitter',
        value: '',
        type: 'string',
        description: 'Twitter profile URL',
        is_public: true
      },
      {
        key: 'maintenance_mode',
        value: 'false',
        type: 'boolean',
        description: 'Enable maintenance mode',
        is_public: false
      },
      {
        key: 'maintenance_message',
        value: 'We are currently performing maintenance. Please check back soon.',
        type: 'string',
        description: 'Message to display during maintenance',
        is_public: false
      },
      {
        key: 'order_confirmation_email_template',
        value: 'default',
        type: 'string',
        description: 'Email template for order confirmations',
        is_public: false
      },
      {
        key: 'shipping_calculator_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable shipping cost calculator',
        is_public: true
      },
      {
        key: 'tax_calculator_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable tax calculation',
        is_public: true
      },
      {
        key: 'guest_checkout_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Allow guest checkout',
        is_public: true
      },
      {
        key: 'reviews_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable product reviews',
        is_public: true
      },
      {
        key: 'wishlist_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable wishlist functionality',
        is_public: true
      },
      {
        key: 'new_arrivals_days',
        value: '30',
        type: 'number',
        description: 'Number of days to consider products as "new arrivals"',
        is_public: true
      },
      {
        key: 'site_logo',
        value: '',
        type: 'string',
        description: 'URL of the site logo',
        is_public: true
      }
    ];

    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if settings already exist
      const existingSettings = await client.query('SELECT setting_key FROM site_settings');
      const existingKeys = existingSettings.rows.map(row => row.setting_key);
      
      for (const setting of defaultSettings) {
        if (!existingKeys.includes(setting.key)) {
          await client.query(`
            INSERT INTO site_settings (setting_key, setting_value, setting_type, setting_description, is_public)
            VALUES ($1, $2, $3, $4, $5)
          `, [setting.key, setting.value, setting.type, setting.description, setting.is_public]);
        }
      }
      
      await client.query('COMMIT');
      
      res.status(200).json({
        success: true,
        message: 'Default settings initialized successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error initializing default settings:', error);
    return next(error);
  }
});

// POST /api/admin/settings/upload-logo - Upload site logo
router.post('/upload-logo', 
  productImageUploadMiddleware, 
  handleMulterError,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Generate unique filename for logo
      const timestamp = Date.now();
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `site-logo-${timestamp}.${fileExtension}`;
      const s3Key = `site-assets/${fileName}`;

      // Upload to S3
      const uploadResult = await s3Service.uploadFileToS3(
        req.file.buffer,
        s3Key,
        req.file.mimetype
      );

      // Update the site_logo setting in database
      await db.query(`
        UPDATE site_settings 
        SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = 'site_logo'
      `, [uploadResult.Location]);

      res.status(200).json({
        success: true,
        message: 'Logo uploaded successfully',
        logoUrl: uploadResult.Location
      });
    } catch (error) {
      logger.error('Error uploading logo:', error);
      return next(error);
    }
  }
);

module.exports = router; 