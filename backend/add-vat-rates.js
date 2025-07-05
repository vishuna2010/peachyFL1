const db = require('./db');

async function addVatRates() {
  try {
    console.log('Adding VAT rates for common countries...');
    
    // Get the VAT tax class ID
    const vatClass = await db.query("SELECT id FROM tax_classes WHERE name ILIKE '%VAT%'");
    if (vatClass.rows.length === 0) {
      console.log('No VAT tax class found. Creating one...');
      const createVatClass = await db.query('INSERT INTO tax_classes (name, description) VALUES ($1, $2) RETURNING id', ['VAT', 'Value Added Tax']);
      vatClassId = createVatClass.rows[0].id;
    } else {
      vatClassId = vatClass.rows[0].id;
    }
    
    console.log(`Using VAT tax class ID: ${vatClassId}`);
    
    // Define VAT rates for common countries
    const vatRates = [
      { name: 'US VAT', country: 'US', state_province: null, rate: 0.10, priority: 1 },
      { name: 'UK VAT', country: 'GB', state_province: null, rate: 0.20, priority: 1 },
      { name: 'CA VAT', country: 'CA', state_province: null, rate: 0.13, priority: 1 },
      { name: 'AU VAT', country: 'AU', state_province: null, rate: 0.10, priority: 1 },
      { name: 'DE VAT', country: 'DE', state_province: null, rate: 0.19, priority: 1 },
      { name: 'FR VAT', country: 'FR', state_province: null, rate: 0.20, priority: 1 },
      { name: 'IT VAT', country: 'IT', state_province: null, rate: 0.22, priority: 1 },
      { name: 'ES VAT', country: 'ES', state_province: null, rate: 0.21, priority: 1 },
      { name: 'NL VAT', country: 'NL', state_province: null, rate: 0.21, priority: 1 },
      { name: 'BE VAT', country: 'BE', state_province: null, rate: 0.21, priority: 1 }
    ];
    
    // Add VAT rates
    for (const rate of vatRates) {
      try {
        const result = await db.query(`
          INSERT INTO tax_rates (name, country, state_province, rate, tax_class_id, priority, is_compound)
          VALUES ($1, $2, $3, $4, $5, $6, false)
          ON CONFLICT (name, country, state_province, tax_class_id) DO UPDATE SET
            rate = EXCLUDED.rate,
            priority = EXCLUDED.priority
          RETURNING id, name
        `, [rate.name, rate.country, rate.state_province, rate.rate, vatClassId, rate.priority]);
        
        console.log(`Added/Updated VAT rate: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
      } catch (error) {
        console.error(`Error adding VAT rate for ${rate.country}:`, error.message);
      }
    }
    
    // Verify the VAT rates
    console.log('\nVerifying VAT rates...');
    const allVatRates = await db.query(`
      SELECT tr.id, tr.name, tr.country, tr.state_province, tr.rate, tc.name as tax_class_name
      FROM tax_rates tr
      JOIN tax_classes tc ON tr.tax_class_id = tc.id
      WHERE tc.id = $1
      ORDER BY tr.country, tr.name;
    `, [vatClassId]);
    
    console.log('All VAT rates:');
    allVatRates.rows.forEach(rate => {
      console.log(`ID: ${rate.id}, Name: ${rate.name}, Country: ${rate.country}, State: ${rate.state_province}, Rate: ${rate.rate}, Class: ${rate.tax_class_name}`);
    });
    
    // Test VAT calculation with US address
    console.log('\n--- Testing VAT calculation with US address ---');
    const taxService = require('./services/taxService');
    
    const cartItems = [
      {
        product_id: 1, // Wireless Bluetooth Headphones (VAT class)
        variant_id: null,
        quantity: 1,
        unit_price: 149.99
      }
    ];
    
    const usAddress = { country: 'US', state_province: 'CA' };
    console.log('Testing with US address:', usAddress);
    
    const vatTaxResult = await taxService.calculateTaxForCartItems(
      cartItems,
      null,
      usAddress,
      false
    );
    
    console.log('VAT tax calculation result:');
    console.log(JSON.stringify(vatTaxResult, null, 2));
    
  } catch (error) {
    console.error('Error adding VAT rates:', error);
  } finally {
    process.exit(0);
  }
}

addVatRates(); 