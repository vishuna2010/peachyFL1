const db = require('./db');
const taxService = require('./services/taxService');

async function debugPOSTax() {
  console.log('=== Debugging POS Tax Calculation ===');
  
  try {
    // 1. Check system settings
    console.log('\n1. Checking system settings...');
    const systemSettings = await db.query(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key IN ('system_country', 'system_state', 'system_postal_code')
    `);
    
    console.log('System settings found:', systemSettings.rows.length);
    systemSettings.rows.forEach(row => {
      console.log(`  ${row.setting_key}: ${row.setting_value}`);
    });
    
    // 2. Build system address
    console.log('\n2. Building system address...');
    let systemAddress = null;
    if (systemSettings.rows.length > 0) {
      const country = systemSettings.rows.find(row => row.setting_key === 'system_country')?.setting_value;
      const state = systemSettings.rows.find(row => row.setting_key === 'system_state')?.setting_value;
      const postalCode = systemSettings.rows.find(row => row.setting_key === 'system_postal_code')?.setting_value;
      
      console.log(`  Country: ${country}`);
      console.log(`  State: ${state}`);
      console.log(`  Postal Code: ${postalCode}`);
      
      if (country) {
        systemAddress = {
          country: country,
          state_province: state || null,
          postalCode: postalCode || null
        };
        console.log('  System address created:', systemAddress);
      } else {
        console.log('  No country found, system address is null');
      }
    } else {
      console.log('  No system settings found');
    }
    
    // 3. Test tax calculation
    console.log('\n3. Testing tax calculation...');
    if (systemAddress) {
      const taxResult = await taxService.calculatePriceWithAppliedTaxes(25.99, 46, systemAddress);
      console.log('Tax calculation result:', JSON.stringify(taxResult, null, 2));
    } else {
      console.log('Cannot test tax calculation - no system address');
    }
    
  } catch (error) {
    console.error('Error in debug:', error);
  } finally {
    process.exit();
  }
}

debugPOSTax(); 