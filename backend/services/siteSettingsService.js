const db = require('../db');

/**
 * Get a single site setting by key
 * @param {string} key - The setting key
 * @returns {Promise<string|null>} The setting value or null if not found
 */
async function getSiteSetting(key) {
  try {
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1',
      [key]
    );
    return result.rows[0]?.setting_value || null;
  } catch (error) {
    console.error(`Error getting site setting ${key}:`, error);
    return null;
  }
}

/**
 * Get multiple site settings by keys
 * @param {string[]} keys - Array of setting keys
 * @returns {Promise<Object>} Object with key-value pairs
 */
async function getSiteSettings(keys) {
  try {
    const result = await db.query(
      'SELECT setting_key, setting_value FROM site_settings WHERE setting_key = ANY($1)',
      [keys]
    );
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    return settings;
  } catch (error) {
    console.error('Error getting site settings:', error);
    return {};
  }
}

/**
 * Get all site settings
 * @returns {Promise<Object>} Object with all key-value pairs
 */
async function getAllSiteSettings() {
  try {
    const result = await db.query('SELECT setting_key, setting_value FROM site_settings');
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    return settings;
  } catch (error) {
    console.error('Error getting all site settings:', error);
    return {};
  }
}

/**
 * Update a site setting
 * @param {string} key - The setting key
 * @param {string} value - The setting value
 * @returns {Promise<boolean>} Success status
 */
async function updateSiteSetting(key, value) {
  try {
    await db.query(
      `INSERT INTO site_settings (setting_key, setting_value) 
       VALUES ($1, $2) 
       ON CONFLICT (setting_key) DO UPDATE SET 
       setting_value = EXCLUDED.setting_value,
       updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
    return true;
  } catch (error) {
    console.error(`Error updating site setting ${key}:`, error);
    return false;
  }
}

module.exports = {
  getSiteSetting,
  getSiteSettings,
  getAllSiteSettings,
  updateSiteSetting
}; 