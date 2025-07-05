const db = require('./db');

async function checkExpensiveProducts() {
  try {
    console.log('Checking all products and variants with prices around $160...');
    
    // Check all products with price >= $150
    const expensiveProducts = await db.query(`
      SELECT id, name, sku, price, tax_class_id
      FROM products
      WHERE price >= 150
      ORDER BY price DESC;
    `);
    
    console.log('Products with price >= $150:');
    expensiveProducts.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}, Price: $${p.price}, Tax Class ID: ${p.tax_class_id}`);
    });
    
    // Check all variants with calculated price >= $150
    const expensiveVariants = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.id as product_id, p.name as product_name, p.price as base_price,
           CASE 
             WHEN pv.price_modifier IS NOT NULL THEN p.price + pv.price_modifier
             ELSE p.price
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE (p.price + COALESCE(pv.price_modifier, 0)) >= 150
      ORDER BY calculated_price DESC;
    `);
    
    console.log('\nVariants with calculated price >= $150:');
    expensiveVariants.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Product: ${v.product_name}, Base Price: $${v.base_price}, Price Modifier: ${v.price_modifier || 'None'}, Calculated Price: $${v.calculated_price}`);
    });
    
    // Check if there are any products with $160 price
    const productsWith160 = await db.query(`
      SELECT id, name, sku, price, tax_class_id
      FROM products
      WHERE price = 160;
    `);
    
    console.log('\nProducts with exactly $160 price:');
    productsWith160.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}, Price: $${p.price}, Tax Class ID: ${p.tax_class_id}`);
    });
    
    // Check if there are any variants with calculated price of $160
    const variantsWith160 = await db.query(`
      SELECT pv.id, pv.sku, pv.price_modifier, p.id as product_id, p.name as product_name, p.price as base_price,
           CASE 
             WHEN pv.price_modifier IS NOT NULL THEN p.price + pv.price_modifier
             ELSE p.price
           END as calculated_price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE (p.price + COALESCE(pv.price_modifier, 0)) = 160;
    `);
    
    console.log('\nVariants with calculated price of exactly $160:');
    variantsWith160.rows.forEach(v => {
      console.log(`ID: ${v.id}, SKU: ${v.sku}, Product: ${v.product_name}, Base Price: $${v.base_price}, Price Modifier: ${v.price_modifier || 'None'}, Calculated Price: $${v.calculated_price}`);
    });
    
  } catch (error) {
    console.error('Error checking expensive products:', error);
  } finally {
    process.exit(0);
  }
}

checkExpensiveProducts(); 