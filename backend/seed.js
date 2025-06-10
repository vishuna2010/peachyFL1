// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configure the database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: process.env.DB_SSL_REQUIRED === 'true' ? { rejectUnauthorized: false } : false, // Optional: Add SSL if your DB requires it and you have DB_SSL_REQUIRED in .env
});

pool.on('connect', () => {
  console.log('Connected to the database for seeding.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client for seeding', err);
  process.exit(-1);
});

async function seedAdminUser(client) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Ensure this is for dev only, not hardcoded for prod builds
  const saltRounds = 10; // Or use a value from config

  try {
    // Check if admin user already exists
    const checkUser = await client.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    if (checkUser.rows.length > 0) {
      console.log(`Admin user with email ${adminEmail} already exists. Skipping creation.`);
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    await client.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
      [adminEmail, hashedPassword, 'admin']
    );
    console.log(`Admin user ${adminEmail} processed for seeding.`);
  } catch (error) {
    console.error(`Error seeding admin user ${adminEmail}:`, error);
    throw error;
  }
}

async function seedCategories(client) {
  const sampleCategories = [
    'Apparel', 'Accessories', 'Electronics', 'Footwear',
    'Home Goods', 'Books', 'Beauty', 'Sports & Outdoors'
  ];

  console.log('Seeding categories...');
  try {
    for (const categoryName of sampleCategories) {
      const result = await client.query(
        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
        [categoryName]
      );
      if (result.rowCount > 0) {
        console.log(`Category "${categoryName}" seeded successfully.`);
      } else {
        console.log(`Category "${categoryName}" already exists or conflict occurred. Skipped.`);
      }
    }
    console.log('Category seeding completed.');
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error; // Re-throw to be caught by seedDatabase's transaction logic
  }
}

async function seedDatabase() {
  console.log('Starting database seeding...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    await seedAdminUser(client);
    await seedCategories(client);

    console.log('Database seeding completed successfully.');
    await client.query('COMMIT'); // Commit transaction
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    console.error('Error during database seeding, transaction rolled back:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('Database client released.');
    }
    await pool.end();
    console.log('Seeding pool has ended.');
  }
}

if (require.main === module) {
  seedDatabase().catch(err => {
    process.exit(1);
  });
}

// module.exports = { seedDatabase };
