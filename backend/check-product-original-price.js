const db = require('./db');

async function checkProductOriginalPrice() {
  try {
    console.log('Checking product original_price and price values...');
    
    // Check the specific product
    const product = await db.query(`
      SELECT id, name, sku, price, original_price, is_on_sale, sale_price, sale_percentage
      FROM products
      WHERE id = 1;
    `);
    
    console.log('Product details:');
    product.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}`);
      console.log(`  Price: $${p.price}, Original Price: ${p.original_price || 'null'}`);
      console.log(`  Is On Sale: ${p.is_on_sale}, Sale Price: ${p.sale_price || 'null'}, Sale Percentage: ${p.sale_percentage || 'null'}`);
    });
    
    // Check all products with original_price set
    const productsWithOriginalPrice = await db.query(`
      SELECT id, name, sku, price, original_price, is_on_sale, sale_price
      FROM products
      WHERE original_price IS NOT NULL AND original_price != price
      ORDER BY id;
    `);
    
    console.log('\nProducts with original_price different from price:');
    productsWithOriginalPrice.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Price: $${p.price}, Original Price: $${p.original_price}, Difference: $${p.original_price - p.price}`);
    });
    
    // Check if there are any products with $160 original_price
    const productsWith160Original = await db.query(`
      SELECT id, name, sku, price, original_price, is_on_sale, sale_price
      FROM products
      WHERE original_price = 160;
    `);
    
    console.log('\nProducts with original_price = $160:');
    productsWith160Original.rows.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Price: $${p.price}, Original Price: $${p.original_price}`);
    });
    
  } catch (error) {
    console.error('Error checking product original price:', error);
  } finally {
    process.exit(0);
  }
}

checkProductOriginalPrice(); 