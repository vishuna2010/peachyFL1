const db = require('./db');

async function checkSpecificVariantDetails() {
  try {
    console.log('Checking specific variant details in database...');
    
    // Check the specific variant
    const variant = await db.query(`
      SELECT pv.*, p.price as base_price, p.original_price as product_original_price, p.is_on_sale as product_is_on_sale, p.sale_price as product_sale_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.sku = 'HDPHN-WL-BT-001-USE-RED-XS';
    `);
    
    console.log('Specific variant details:');
    variant.rows.forEach(v => {
      console.log(`ID: ${v.id}`);
      console.log(`SKU: ${v.sku}`);
      console.log(`Price Modifier: ${v.price_modifier}`);
      console.log(`Original Price: ${v.original_price}`);
      console.log(`Sale Price: ${v.sale_price}`);
      console.log(`Is On Sale: ${v.is_on_sale}`);
      console.log(`Sale Percentage: ${v.sale_percentage}`);
      console.log(`Base Product Price: ${v.base_price}`);
      console.log(`Base Product Original Price: ${v.product_original_price}`);
      console.log(`Base Product Is On Sale: ${v.product_is_on_sale}`);
      console.log(`Base Product Sale Price: ${v.product_sale_price}`);
    });
    
    // Check if there are any variants with original_price set
    const variantsWithOriginalPrice = await db.query(`
      SELECT pv.id, pv.sku, pv.original_price, pv.price_modifier, p.price as base_price, p.original_price as product_original_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.original_price IS NOT NULL
      ORDER BY pv.id;
    `);
    
    console.log('\nVariants with original_price set:');
    variantsWithOriginalPrice.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Variant Original Price: ${v.original_price}, Price Modifier: ${v.price_modifier}, Base Price: ${v.base_price}, Product Original Price: ${v.product_original_price}`);
    });
    
    // Check if variant 68 has any special settings
    const variant68 = await db.query(`
      SELECT * FROM product_variants WHERE id = 68;
    `);
    
    console.log('\nVariant 68 raw data:');
    variant68.rows.forEach(v => {
      console.log(JSON.stringify(v, null, 2));
    });
    
  } catch (error) {
    console.error('Error checking specific variant details:', error);
  } finally {
    process.exit(0);
  }
}

checkSpecificVariantDetails(); 