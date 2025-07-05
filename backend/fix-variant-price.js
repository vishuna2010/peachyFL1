const db = require('./db');

async function fixVariantPrice() {
  try {
    console.log('Fixing variant original_price to inherit from parent product...');
    
    // Update variant 68 to have null original_price so it inherits from parent
    const result = await db.query(`
      UPDATE product_variants 
      SET original_price = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = 68 AND sku = 'HDPHN-WL-BT-001-USE-RED-XS'
      RETURNING *;
    `);
    
    console.log('Updated variant:');
    result.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Original Price: ${v.original_price}, Price Modifier: ${v.price_modifier}`);
    });
    
    // Verify the fix by checking the variant again
    const verifyVariant = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, pv.original_price, p.price as base_price, p.original_price as product_original_price,
           CASE 
             WHEN pv.original_price IS NOT NULL THEN pv.original_price
             ELSE p.original_price + COALESCE(pv.price_modifier, 0)
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.sku = 'HDPHN-WL-BT-001-USE-RED-XS';
    `);
    
    console.log('\nVariant after fix:');
    verifyVariant.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Price Modifier: ${v.price_modifier}, Original Price: ${v.original_price}, Base Price: ${v.base_price}, Product Original Price: ${v.product_original_price}, Calculated Price: $${v.calculated_price}`);
    });
    
    console.log('\nThe variant should now have a calculated price of $149.99 (product original price + 0 modifier)');
    
  } catch (error) {
    console.error('Error fixing variant price:', error);
  } finally {
    process.exit(0);
  }
}

fixVariantPrice(); 