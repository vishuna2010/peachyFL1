const db = require('./db');

async function checkVariant160Price() {
  try {
    console.log('Checking if any variant has a price modifier that would result in $160...');
    
    // Check the product's original price and calculate what price modifier would be needed
    const product = await db.query(`
      SELECT id, name, price, original_price
      FROM products
      WHERE id = 1;
    `);
    
    const productData = product.rows[0];
    console.log(`Product: ${productData.name}`);
    console.log(`  Price: $${productData.price}, Original Price: $${productData.original_price}`);
    
    // Calculate what price modifier would be needed to get $160
    const targetPrice = 160.00;
    const basePrice = productData.original_price || productData.price;
    const neededPriceModifier = targetPrice - basePrice;
    
    console.log(`\nTo get $${targetPrice}, with base price $${basePrice}, needed price modifier: $${neededPriceModifier}`);
    
    // Check if any variant has this price modifier
    const variantsWithModifier = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.price as base_price, p.original_price,
           CASE 
             WHEN p.original_price IS NOT NULL THEN p.original_price + pv.price_modifier
             ELSE p.price + pv.price_modifier
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.product_id = 1
      ORDER BY pv.id;
    `);
    
    console.log('\nAll variants with calculated prices:');
    variantsWithModifier.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Price Modifier: ${v.price_modifier || 'None'}, Base Price: $${v.base_price}, Original Price: $${v.original_price}, Calculated Price: $${v.calculated_price}`);
    });
    
    // Check if any variant has a price modifier close to what we need
    const variantsNear160 = variantsWithModifier.rows.filter(v => {
      const calculated = parseFloat(v.calculated_price);
      return calculated >= 155 && calculated <= 165;
    });
    
    console.log('\nVariants with calculated price between $155-$165:');
    variantsNear160.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Price Modifier: ${v.price_modifier || 'None'}, Calculated Price: $${v.calculated_price}`);
    });
    
    // Check if there's a variant with exactly $160 calculated price
    const variantsWith160 = variantsWithModifier.rows.filter(v => {
      const calculated = parseFloat(v.calculated_price);
      return Math.abs(calculated - 160) < 0.01; // Within 1 cent
    });
    
    console.log('\nVariants with calculated price of exactly $160:');
    variantsWith160.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Price Modifier: ${v.price_modifier || 'None'}, Calculated Price: $${v.calculated_price}`);
    });
    
  } catch (error) {
    console.error('Error checking variant 160 price:', error);
  } finally {
    process.exit(0);
  }
}

checkVariant160Price(); 