const db = require('./db');

async function checkTaxInheritance() {
  try {
    console.log('Checking tax class inheritance for variants...');
    
    // Check the product's tax class
    const product = await db.query(`
      SELECT p.id, p.name, p.tax_class_id, tc.name as tax_class_name
      FROM products p
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      WHERE p.id = 1;
    `);
    
    console.log('Product tax class:');
    product.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Tax Class ID: ${p.tax_class_id}, Tax Class Name: ${p.tax_class_name}`);
    });
    
    // Check all variants and their inherited tax class
    const variants = await db.query(`
      SELECT pv.id, pv.sku, p.tax_class_id, tc.name as tax_class_name, p.name as product_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      WHERE pv.product_id = 1
      ORDER BY pv.id;
    `);
    
    console.log('\nVariants with inherited tax class:');
    variants.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Inherited Tax Class: ${v.tax_class_name} (ID: ${v.tax_class_id}), Product: ${v.product_name}`);
    });
    
    // Check if any variants have their own tax_class_id (they shouldn't)
    const variantsWithOwnTax = await db.query(`
      SELECT pv.id, pv.sku, pv.tax_class_id as variant_tax_class_id, p.tax_class_id as product_tax_class_id
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.tax_class_id IS NOT NULL;
    `);
    
    console.log('\nVariants with their own tax_class_id (should be none):');
    variantsWithOwnTax.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Variant Tax Class ID: ${v.variant_tax_class_id}, Product Tax Class ID: ${v.product_tax_class_id}`);
    });
    
    // Test tax calculation for a variant to verify inheritance
    console.log('\n--- Testing tax calculation for variant inheritance ---');
    const axios = require('axios');
    
    const cartPayload = {
      cartItems: [
        {
          productId: 1,
          variantId: 68, // HDPHN-WL-BT-001-USE-RED-XS
          quantity: 1,
          price: 149.99
        }
      ],
      shippingAddress: {
        country: 'BS',
        state_province: 'NP'
      }
    };
    
    console.log('Testing tax calculation with cart payload:', JSON.stringify(cartPayload, null, 2));
    
    const response = await axios.post('http://localhost:3000/api/cart/calculate-taxes', cartPayload);
    
    console.log('Tax calculation result:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check if the tax_class_id_at_purchase is correct
    const lineItem = response.data.line_items_with_tax_details[0];
    console.log(`\nVariant tax class ID at purchase: ${lineItem.tax_class_id_at_purchase}`);
    console.log(`Expected tax class ID (from product): ${product.rows[0].tax_class_id}`);
    console.log(`Tax class inheritance ${lineItem.tax_class_id_at_purchase === product.rows[0].tax_class_id ? 'WORKING' : 'NOT WORKING'}`);
    
  } catch (error) {
    console.error('Error checking tax inheritance:', error);
  } finally {
    process.exit(0);
  }
}

checkTaxInheritance(); 