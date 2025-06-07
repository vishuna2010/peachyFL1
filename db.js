const { Pool } = require('pg');

// Replace with your actual connection string or individual connection parameters
// For example, using environment variables:
// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_DATABASE,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT,
// });

// For this example, we'll use a placeholder connection string.
// In a real application, you would use environment variables or a config file.
const connectionString = 'postgresql://user:password@host:port/database';
const pool = new Pool({
  connectionString: connectionString,
});

pool.on('connect', () => {
  console.log('Connected to the database');
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" created successfully or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log('Table "categories" created successfully or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log('Table "tags" created successfully or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
    `);
    console.log('Table "products" created successfully or already exists (and altered).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, tag_id)
      );
    `);
    console.log('Table "product_tags" created successfully or already exists.');

  } catch (err) {
    console.error('Error creating/altering tables:', err.stack);
  } finally {
    client.release();
  }
};

// Immediately execute table creation when this module is loaded.
// In a more complex setup, you might export this and call it from your main application file.
createTables().catch(err => console.error('Failed to create tables on startup:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Exporting the pool can be useful for more complex scenarios
};
