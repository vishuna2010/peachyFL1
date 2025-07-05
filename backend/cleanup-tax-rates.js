const db = require('./db');

async function cleanupTaxRates() {
  try {
    console.log('Cleaning up duplicate tax rates...');
    
    // First, let's see what we have
    const allRates = await db.query(`
      SELECT tr.id, tr.name, tr.country, tr.state_province, tr.rate, tr.tax_class_id, tc.name as tax_class_name
      FROM tax_rates tr
      JOIN tax_classes tc ON tr.tax_class_id = tc.id
      ORDER BY tr.tax_class_id, tr.country, tr.state_province, tr.id;
    `);
    
    console.log('Current tax rates:');
    allRates.rows.forEach(rate => {
      console.log(`ID: ${rate.id}, Name: ${rate.name}, Country: ${rate.country}, State: ${rate.state_province}, Rate: ${rate.rate}, Class: ${rate.tax_class_name}`);
    });
    
    // Find duplicates
    const duplicates = await db.query(`
      SELECT name, country, state_province, tax_class_id, COUNT(*) as count
      FROM tax_rates
      GROUP BY name, country, state_province, tax_class_id
      HAVING COUNT(*) > 1
      ORDER BY name, country, state_province;
    `);
    
    console.log('\nDuplicate tax rates found:');
    duplicates.rows.forEach(dup => {
      console.log(`${dup.name} - ${dup.country} - ${dup.state_province} - Class ID: ${dup.tax_class_id} - Count: ${dup.count}`);
    });
    
    // Keep only one rate per unique combination, delete the rest
    for (const dup of duplicates.rows) {
      const ratesToDelete = await db.query(`
        SELECT id FROM tax_rates 
        WHERE name = $1 AND country = $2 AND state_province = $3 AND tax_class_id = $4
        ORDER BY id
        OFFSET 1
      `, [dup.name, dup.country, dup.state_province, dup.tax_class_id]);
      
      if (ratesToDelete.rows.length > 0) {
        const idsToDelete = ratesToDelete.rows.map(r => r.id);
        console.log(`Deleting duplicate tax rates with IDs: ${idsToDelete.join(', ')}`);
        
        await db.query(`
          DELETE FROM tax_rates WHERE id = ANY($1)
        `, [idsToDelete]);
      }
    }
    
    // Update product tax class assignments to use Standard Goods
    console.log('\nUpdating product tax class assignments...');
    const standardGoodsClass = await db.query('SELECT id FROM tax_classes WHERE name = $1', ['Standard Goods']);
    
    if (standardGoodsClass.rows.length > 0) {
      const standardGoodsId = standardGoodsClass.rows[0].id;
      
      await db.query(`
        UPDATE products 
        SET tax_class_id = $1 
        WHERE tax_class_id IS NULL OR tax_class_id != $1
      `, [standardGoodsId]);
      
      console.log(`Updated all products to use Standard Goods tax class (ID: ${standardGoodsId})`);
    }
    
    // Verify the cleanup
    const finalRates = await db.query(`
      SELECT tr.id, tr.name, tr.country, tr.state_province, tr.rate, tc.name as tax_class_name
      FROM tax_rates tr
      JOIN tax_classes tc ON tr.tax_class_id = tc.id
      ORDER BY tc.name, tr.country, tr.state_province;
    `);
    
    console.log('\nFinal tax rates after cleanup:');
    finalRates.rows.forEach(rate => {
      console.log(`ID: ${rate.id}, Name: ${rate.name}, Country: ${rate.country}, State: ${rate.state_province}, Rate: ${rate.rate}, Class: ${rate.tax_class_name}`);
    });
    
    // Check product assignments
    const products = await db.query(`
      SELECT p.id, p.name, p.sku, p.tax_class_id, tc.name as tax_class_name
      FROM products p
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      ORDER BY p.id;
    `);
    
    console.log('\nProduct tax class assignments:');
    products.rows.forEach(product => {
      console.log(`ID: ${product.id}, Name: ${product.name}, SKU: ${product.sku}, Tax Class: ${product.tax_class_name} (ID: ${product.tax_class_id})`);
    });
    
  } catch (error) {
    console.error('Error cleaning up tax rates:', error);
  } finally {
    process.exit(0);
  }
}

cleanupTaxRates(); 