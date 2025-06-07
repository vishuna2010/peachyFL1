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

    try {
      await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';");
      console.log('Default role set for users table.');
    } catch (alterError) {
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "suppliers" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);');

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category_id INT REFERENCES categories(id) ON DELETE SET NULL,
        image_url VARCHAR(255) NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        supplier_id INTEGER NULL REFERENCES suppliers(id) ON DELETE SET NULL,
        sku VARCHAR(100) NULL UNIQUE,
        reorder_threshold INTEGER NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "products" created successfully or already exists (altered for supplier_id, sku, updated_at, image_url, stock_quantity, reorder_threshold).');


    await client.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, tag_id)
      );
    `);
    console.log('Table "product_tags" created successfully or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        valid_from TIMESTAMP NULL,
        valid_until TIMESTAMP NULL,
        usage_limit INTEGER NULL,
        times_used INTEGER NOT NULL DEFAULT 0,
        min_order_amount DECIMAL(10, 2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "discounts" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_discounts_validity ON discounts(is_active, valid_from, valid_until);');

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
        original_total_amount DECIMAL(10, 2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "orders" created successfully or already exists (and altered for discounts).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        product_variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE SET NULL, -- Added
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price_at_purchase DECIMAL(10, 2) NOT NULL
        -- sku_at_purchase VARCHAR(100) NULL -- Conceptual, not adding yet
      );
    `);
    console.log('Table "order_items" created successfully or already exists (altered for product_variant_id).');
    await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_product_variant_id ON order_items(product_variant_id);');


    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
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

    // --- New Product Variants Schema ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_options (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL, -- e.g., "Color", "Size"
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_product_option_name UNIQUE (product_id, name)
      );
    `);
    console.log('Table "product_options" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_option_product_id ON product_options(product_id);'); // Renamed index

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_option_values (
        id SERIAL PRIMARY KEY,
        product_option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        value VARCHAR(255) NOT NULL, -- e.g., "Red", "Large"
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_option_value UNIQUE (product_option_id, value)
      );
    `);
    console.log('Table "product_option_values" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_option_value_product_option_id ON product_option_values(product_option_id);'); // Renamed index

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku VARCHAR(100) UNIQUE NULL,
        price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        image_url VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_variants" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_variant_product_id ON product_variants(product_id);'); // Renamed index
    await client.query('CREATE INDEX IF NOT EXISTS idx_variant_sku ON product_variants(sku);'); // Renamed index

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variant_option_values (
        id SERIAL PRIMARY KEY,
        product_variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        CONSTRAINT uk_variant_option_value_combo UNIQUE (product_variant_id, product_option_value_id)
      );
    `);
    console.log('Table "product_variant_option_values" created successfully or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pvov_variant_id ON product_variant_option_values(product_variant_id);'); // Renamed index
    await client.query('CREATE INDEX IF NOT EXISTS idx_pvov_option_value_id ON product_variant_option_values(product_option_value_id);'); // Renamed index

  } catch (err) {
    console.error('Error creating/altering tables:', err.stack);
  } finally {
    client.release();
  }
};

createTables().catch(err => console.error('Failed to create tables on startup:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
