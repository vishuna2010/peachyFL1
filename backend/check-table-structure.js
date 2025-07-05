const db = require('./db');

async function checkTableStructure() {
  try {
    console.log('Checking table structure...');
    
    // Check product_variants table structure
    const variantStructure = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_variants'
      ORDER BY ordinal_position;
    `);
    
    console.log('Product variants table structure:');
    variantStructure.rows.forEach(col => {
      console.log(`Column: ${col.column_name}, Type: ${col.data_type}, Nullable: ${col.is_nullable}`);
    });
    
    // Check products table structure
    const productStructure = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nProducts table structure:');
    productStructure.rows.forEach(col => {
      console.log(`Column: ${col.column_name}, Type: ${col.data_type}, Nullable: ${col.is_nullable}`);
    });
    
    // Check some sample data
    const sampleVariants = await db.query(`
      SELECT * FROM product_variants LIMIT 3;
    `);
    
    console.log('\nSample product variants data:');
    sampleVariants.rows.forEach(variant => {
      console.log(variant);
    });
    
  } catch (error) {
    console.error('Error checking table structure:', error);
  } finally {
    process.exit(0);
  }
}

checkTableStructure(); 