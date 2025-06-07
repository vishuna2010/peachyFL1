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
        role VARCHAR(50) NOT NULL DEFAULT 'customer',
        two_fa_secret VARCHAR(255) NULL,
        is_two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        -- Note: Consider adding updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP here too for consistency
      );
    `);
    console.log('Table "users" created successfully or already exists (and altered for role, 2FA).');

    // Ensure existing users have the default role if the column was just added.
    // This is more of a migration step. For simplicity, we'll assume new setups
    // or that this runs once. A proper migration tool would handle this better.
    try {
      await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';");
      // The following might be needed if there are old rows with NULL role, though the DEFAULT should handle new ones.
      // await client.query("UPDATE users SET role = 'customer' WHERE role IS NULL;");
      console.log('Default role set for users table.');
    } catch (alterError) {
      // Ignore if the column or default already exists in a way that's compatible.
      // Specific error codes could be checked here (e.g., duplicate column, default already set)
      // For now, we log a warning if it's not a "column already exists" or similar error.
      if (!alterError.message.includes('already exists') && !alterError.message.includes('multiple default expressions')) {
          console.warn('Warning during users table alteration for role default (may be benign if already set):', alterError.message);
      }
    }

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
        image_url VARCHAR(255) NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        supplier_id INTEGER NULL REFERENCES suppliers(id) ON DELETE SET NULL,
        sku VARCHAR(100) NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Will be updated by application logic
      );
    `);
    console.log('Table "products" created successfully or already exists (altered for supplier_id, sku, updated_at, image_url, stock_quantity).');

    // Optional: Add a CHECK constraint to ensure stock_quantity never goes negative,
    // though application logic should primarily handle this.
    // try {
    //   await client.query("ALTER TABLE products ADD CONSTRAINT check_stock_non_negative CHECK (stock_quantity >= 0);");
    //   console.log('CHECK constraint for non-negative stock added to products table.');
    // } catch (constraintError) {
    //   if (!constraintError.message.includes('already exists')) { // Benign if constraint already there
    //     console.warn('Warning during products table alteration for stock_quantity check constraint:', constraintError.message);
    //   }
    // }


    await client.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, tag_id)
      );
    `);
    console.log('Table "product_tags" created successfully or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Or SET NULL / CASCADE depending on desired behavior
        status VARCHAR(50) DEFAULT 'pending',
        total_amount DECIMAL(10, 2) NOT NULL,
        shipping_address_line1 VARCHAR(255) NOT NULL,
        shipping_address_line2 VARCHAR(255) NULL,
        shipping_city VARCHAR(100) NOT NULL,
        shipping_postal_code VARCHAR(20) NOT NULL,
        shipping_country VARCHAR(50) NOT NULL,
        billing_address_line1 VARCHAR(255) NULL,
        billing_address_line2 VARCHAR(255) NULL,
        billing_city VARCHAR(100) NULL,
        billing_postal_code VARCHAR(20) NULL,
        billing_country VARCHAR(50) NULL,
        discount_id INTEGER NULL REFERENCES discounts(id) ON DELETE SET NULL,
        discount_code_applied VARCHAR(255) NULL,
        discount_amount_applied DECIMAL(10, 2) NULL,
        original_total_amount DECIMAL(10, 2) NULL, -- Total before discount
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Consider trigger for auto-update
      );
    `);
    console.log('Table "orders" created successfully or already exists (and altered for discounts).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT, -- Prevent product deletion if in an order
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price_at_purchase DECIMAL(10, 2) NOT NULL
      );
    `);
    console.log('Table "order_items" created successfully or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed_amount'
        value DECIMAL(10, 2) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        valid_from TIMESTAMP NULL,
        valid_until TIMESTAMP NULL,
        usage_limit INTEGER NULL,
        times_used INTEGER NOT NULL DEFAULT 0,
        min_order_amount DECIMAL(10, 2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Consider trigger for auto-update
      );
    `);
    console.log('Table "discounts" created successfully or already exists.');

    // Index on code for faster lookups
    await client.query('CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);');
    // Index on is_active and dates for querying valid discounts
    await client.query('CREATE INDEX IF NOT EXISTS idx_discounts_validity ON discounts(is_active, valid_from, valid_until);');

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        contact_person VARCHAR(255) NULL,
        email VARCHAR(255) NULL UNIQUE,
        phone VARCHAR(50) NULL,
        address_line1 VARCHAR(255) NULL,
        address_line2 VARCHAR(255) NULL,
        city VARCHAR(100) NULL,
        postal_code VARCHAR(20) NULL,
        country VARCHAR(50) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Consider trigger for auto-update
      );
    `);
    console.log('Table "suppliers" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);');

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., pending, ordered, partially_received, received, cancelled
        order_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_delivery_date DATE NULL,
        notes TEXT NULL,
        created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "purchase_orders" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);');

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
        unit_cost_price DECIMAL(10, 2) NOT NULL,
        quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity_ordered)
      );
    `);
    console.log('Table "purchase_order_items" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_poi_purchase_order_id ON purchase_order_items(purchase_order_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_poi_product_id ON purchase_order_items(product_id);');

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
