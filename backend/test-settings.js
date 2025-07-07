const db = require('./db');

async function checkServiceLocations() {
  try {
    // Check for service_locations setting
    const result = await db.query('SELECT setting_key, setting_value FROM site_settings WHERE setting_key = $1', ['service_locations']);
    console.log('Service locations setting:', result.rows);
    
    // Check for any location-related settings
    const locationSettings = await db.query("SELECT setting_key, setting_value FROM site_settings WHERE setting_key LIKE '%location%'");
    console.log('\nLocation-related settings:', locationSettings.rows);
    
    // Check all settings
    const allSettings = await db.query('SELECT setting_key, setting_value FROM site_settings ORDER BY setting_key');
    console.log('\nAll settings count:', allSettings.rows.length);
    console.log('All setting keys:', allSettings.rows.map(s => s.setting_key));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkServiceLocations(); 