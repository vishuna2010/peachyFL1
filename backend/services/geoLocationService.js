const axios = require('axios');
const logger = require('../utils/logger');

class GeoLocationService {
  constructor() {
    this.providers = {
      ipapi: {
        name: 'IP-API',
        description: 'Free IP geolocation service with 1000 requests/month',
        requiresApiKey: false,
        baseUrl: 'http://ip-api.com/json',
        getCountryFromIP: this.getCountryFromIPAPI.bind(this)
      },
      maxmind: {
        name: 'MaxMind GeoIP2',
        description: 'Premium IP geolocation service with high accuracy',
        requiresApiKey: true,
        baseUrl: 'https://geoip.maxmind.com/geoip/v2.1/country',
        getCountryFromIP: this.getCountryFromMaxMind.bind(this)
      },
      cloudflare: {
        name: 'Cloudflare',
        description: 'Uses Cloudflare headers for geolocation',
        requiresApiKey: false,
        getCountryFromIP: this.getCountryFromCloudflare.bind(this)
      },
      none: {
        name: 'No Geo-Restriction',
        description: 'No geo-location restrictions applied',
        requiresApiKey: false,
        getCountryFromIP: () => Promise.resolve(null)
      }
    };
  }

  /**
   * Get the current geo-location service provider
   */
  async getCurrentProvider() {
    try {
      const db = require('../db');
      const result = await db.query(
        'SELECT setting_value FROM site_settings WHERE setting_key = $1',
        ['geo_location_service']
      );
      
      const provider = result.rows[0]?.setting_value || 'none';
      return this.providers[provider] || this.providers.none;
    } catch (error) {
      logger.error('Error getting geo-location provider:', error);
      return this.providers.none;
    }
  }

  /**
   * Get API key for the current provider
   */
  async getApiKey() {
    try {
      const db = require('../db');
      const result = await db.query(
        'SELECT setting_value FROM site_settings WHERE setting_key = $1',
        ['geo_location_api_key']
      );
      
      return result.rows[0]?.setting_value || '';
    } catch (error) {
      logger.error('Error getting geo-location API key:', error);
      return '';
    }
  }

  /**
   * Get allowed countries from settings
   */
  async getAllowedCountries() {
    try {
      const db = require('../db');
      const result = await db.query(
        'SELECT setting_value FROM site_settings WHERE setting_key = $1',
        ['service_locations']
      );
      
      const locations = result.rows[0]?.setting_value || '';
      return locations ? locations.split(',').map(loc => loc.trim()) : [];
    } catch (error) {
      logger.error('Error getting allowed countries:', error);
      return [];
    }
  }

  /**
   * Check if geo-restriction is enabled
   */
  async isGeoRestrictionEnabled() {
    const provider = await this.getCurrentProvider();
    const allowedCountries = await this.getAllowedCountries();
    
    return provider.name !== 'No Geo-Restriction' && allowedCountries.length > 0;
  }

  /**
   * Get country from IP using IP-API
   */
  async getCountryFromIPAPI(ip) {
    try {
      const response = await axios.get(`${this.providers.ipapi.baseUrl}/${ip}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.status === 'success') {
        return response.data.countryCode;
      }
      
      logger.warn('IP-API returned unsuccessful response:', response.data);
      return null;
    } catch (error) {
      logger.error('Error getting country from IP-API:', error.message);
      return null;
    }
  }

  /**
   * Get country from IP using MaxMind
   */
  async getCountryFromMaxMind(ip) {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        logger.error('MaxMind API key not configured');
        return null;
      }

      const response = await axios.get(`${this.providers.maxmind.baseUrl}/${ip}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`account:${apiKey}`).toString('base64')}`
        },
        timeout: 5000
      });
      
      if (response.data && response.data.country) {
        return response.data.country.iso_code;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting country from MaxMind:', error.message);
      return null;
    }
  }

  /**
   * Get country from Cloudflare headers
   */
  async getCountryFromCloudflare(req) {
    try {
      const country = req.headers['cf-ipcountry'];
      if (country && country !== 'XX') {
        return country;
      }
      
      logger.warn('Cloudflare country header not available or invalid');
      return null;
    } catch (error) {
      logger.error('Error getting country from Cloudflare headers:', error.message);
      return null;
    }
  }

  /**
   * Get country from IP using the configured provider
   */
  async getCountryFromIP(ip, req = null) {
    try {
      const provider = await this.getCurrentProvider();
      
      if (provider.name === 'Cloudflare') {
        return await provider.getCountryFromIP(req);
      } else {
        return await provider.getCountryFromIP(ip);
      }
    } catch (error) {
      logger.error('Error getting country from IP:', error);
      return null;
    }
  }

  /**
   * Check if user's country is allowed
   */
  async isCountryAllowed(ip, req = null) {
    try {
      // If geo-restriction is disabled, allow all
      if (!(await this.isGeoRestrictionEnabled())) {
        return true;
      }

      const userCountry = await this.getCountryFromIP(ip, req);
      const allowedCountries = await this.getAllowedCountries();
      
      // If we can't determine country, allow access (fail open)
      if (!userCountry) {
        logger.warn('Could not determine user country, allowing access');
        return true;
      }
      
      const isAllowed = allowedCountries.includes(userCountry);
      
      if (!isAllowed) {
        logger.info(`Access denied for country: ${userCountry} (IP: ${ip})`);
      }
      
      return isAllowed;
    } catch (error) {
      logger.error('Error checking country access:', error);
      // Fail open - allow access if there's an error
      return true;
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.entries(this.providers).map(([key, provider]) => ({
      key,
      name: provider.name,
      description: provider.description,
      requiresApiKey: provider.requiresApiKey
    }));
  }

  /**
   * Test the current geo-location service
   */
  async testService(testIP = '8.8.8.8') {
    try {
      const provider = await this.getCurrentProvider();
      const country = await this.getCountryFromIP(testIP);
      
      return {
        success: true,
        provider: provider.name,
        testIP,
        detectedCountry: country,
        message: `Successfully detected country: ${country || 'Unknown'}`
      };
    } catch (error) {
      return {
        success: false,
        provider: (await this.getCurrentProvider()).name,
        testIP,
        error: error.message
      };
    }
  }
}

module.exports = new GeoLocationService(); 