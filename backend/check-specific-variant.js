const db = require('./db');

async function checkSpecificVariant() {
  try {
    console.log('Checking specific variant HDPHN-WL-BT-001-USE-RED-XS...');
    
    // Check the specific variant
    const variant = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.price as base_price, p.tax_class_id, tc.name as tax_class_name, p.name as product_name,
           CASE 
             WHEN pv.price_modifier IS NOT NULL THEN p.price + pv.price_modifier
             ELSE p.price
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      WHERE pv.sku = 'HDPHN-WL-BT-001-USE-RED-XS';
    `);
    
    console.log('Specific variant details:');
    variant.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Base Price: $${v.base_price}, Price Modifier: ${v.price_modifier || 'None'}, Calculated Price: $${v.calculated_price}, Tax Class: ${v.tax_class_name}`);
    });
    
    // Check if there are any variants with price modifiers
    const variantsWithModifiers = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.price as base_price,
           CASE 
             WHEN pv.price_modifier IS NOT NULL THEN p.price + pv.price_modifier
             ELSE p.price
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.price_modifier IS NOT NULL AND pv.price_modifier != 0
      ORDER BY pv.id;
    `);
    
    console.log('\nVariants with price modifiers:');
    variantsWithModifiers.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Base Price: $${v.base_price}, Price Modifier: $${v.price_modifier}, Calculated Price: $${v.calculated_price}`);
    });
    
    // Check if there's a variant with $160 price
    const expensiveVariants = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.price as base_price,
           CASE 
             WHEN pv.price_modifier IS NOT NULL THEN p.price + pv.price_modifier
             ELSE p.price
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE (p.price + COALESCE(pv.price_modifier, 0)) >= 150
      ORDER BY calculated_price DESC;
    `);
    
    console.log('\nVariants with price >= $150:');
    expensiveVariants.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Base Price: $${v.base_price}, Price Modifier: ${v.price_modifier || 'None'}, Calculated Price: $${v.calculated_price}`);
    });
    
  } catch (error) {
    console.error('Error checking specific variant:', error);
  } finally {
    process.exit(0);
  }
}

checkSpecificVariant(); 