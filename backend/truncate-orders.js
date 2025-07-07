const db = require('./db');

async function truncateOrders() {
  
  try {
    console.log('Connecting to database...');
    const client = await db.pool.connect();
    
    console.log('Starting orders truncation...');
    
    // First, get the total count
    const countResult = await client.query('SELECT COUNT(*) FROM orders');
    const totalOrders = parseInt(countResult.rows[0].count);
    console.log(`Current total orders: ${totalOrders}`);
    
    if (totalOrders <= 20) {
      console.log('Already have 20 or fewer orders. No truncation needed.');
      return;
    }
    
    // Get the 20 most recent orders to keep
    const keepResult = await client.query(`
      SELECT id FROM orders 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    const ordersToKeep = keepResult.rows.map(row => row.id);
    console.log(`Keeping orders: ${ordersToKeep.join(', ')}`);
    
    // Delete all other orders (and their items due to foreign key constraints)
    const deleteResult = await client.query(`
      DELETE FROM orders 
      WHERE id NOT IN (${ordersToKeep.map((_, i) => `$${i + 1}`).join(', ')})
    `, ordersToKeep);
    
    console.log(`Deleted ${deleteResult.rowCount} orders`);
    
    // Verify the final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM orders');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    console.log(`Final order count: ${finalCount}`);
    
    client.release();
    console.log('Orders truncation completed successfully!');
    
  } catch (error) {
    console.error('Error truncating orders:', error);
    throw error;
  } finally {
    // Don't end the pool since it's shared
  }
}

// Run the script
truncateOrders()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 