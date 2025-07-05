const db = require('./db');
const taxService = require('./services/taxService');

async function checkVariantTax() {
  try {
    console.log('Checking variant tax class assignment...');
    
    // Check variants and their parent product tax class
    const variants = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.price as base_price, p.tax_class_id, tc.name as tax_class_name, p.name as product_name,
           CASE 
             WHEN pv.price_modifier IS NOT NULL THEN p.price + pv.price_modifier
             ELSE p.price
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      WHERE pv.sku LIKE '%HDPHN-WL-BT-001%'
      ORDER BY pv.id;
    `);
    
    console.log('Product variants with inherited tax class:');
    variants.rows.forEach(variant => {
      console.log(`ID: ${variant.id}, SKU: ${variant.sku}, Base Price: $${variant.base_price}, Price Modifier: ${variant.price_modifier || 'None'}, Calculated Price: $${variant.calculated_price}, Inherited Tax Class: ${variant.tax_class_name} (ID: ${variant.tax_class_id}), Product: ${variant.product_name}`);
    });
    
    // Check product and all its variants
    const productWithVariants = await db.query(`
      SELECT p.id, p.name, p.price as base_price, p.tax_class_id as product_tax_class_id, tc.name as product_tax_class_name,
             pv.id as variant_id, pv.sku, pv.price_modifier
      FROM products p
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.id = 1
      ORDER BY pv.id;
    `);
    
    console.log('\nProduct and variants tax class inheritance:');
    productWithVariants.rows.forEach(row => {
      console.log(`Product: ${row.name}, Base Price: $${row.base_price}, Product Tax Class: ${row.product_tax_class_name} (ID: ${row.product_tax_class_id})`);
      if (row.variant_id) {
        const calculatedPrice = row.price_modifier ? row.base_price + parseFloat(row.price_modifier) : row.base_price;
        console.log(`  Variant ID: ${row.variant_id}, SKU: ${row.sku}, Price Modifier: ${row.price_modifier || 'None'}, Calculated Price: $${calculatedPrice}, Inherits Tax Class: ${row.product_tax_class_name}`);
      }
    });
    
    // Test tax calculation for the specific variant
    console.log('\n--- Testing tax calculation for variant ---');
    const cartItems = [
      {
        product_id: 1, // Product ID
        variant_id: 1, // Assuming variant ID 1 is the Red, Used, XS variant
        quantity: 1,
        unit_price: 160.00
      }
    ];
    
    const bahamasAddress = { country: 'BS', state_province: 'NP' };
    console.log('Testing with Bahamas address:', bahamasAddress);
    console.log('Cart items:', cartItems);
    
    const taxResult = await taxService.calculateTaxForCartItems(
      cartItems,
      null,
      bahamasAddress,
      false
    );
    
    console.log('Tax calculation result:');
    console.log(JSON.stringify(taxResult, null, 2));
    
    // Test API call with variant
    console.log('\n--- Testing API call with variant ---');
    const axios = require('axios');
    
    const apiPayload = {
      cartItems: [
        {
          productId: 1,
          variantId: 1, // Add variant ID
          quantity: 1,
          price: 160.00
        }
      ],
      shippingAddress: {
        country: 'BS',
        state_province: 'NP'
      }
    };
    
    console.log('API payload:', JSON.stringify(apiPayload, null, 2));
    
    const response = await axios.post('http://localhost:3000/api/cart/calculate-taxes', apiPayload);
    console.log('API response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error checking variant tax:', error);
  } finally {
    process.exit(0);
  }
}

checkVariantTax(); 