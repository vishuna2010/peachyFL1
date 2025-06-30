// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configure the database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: process.env.DB_SSL_REQUIRED === 'true' ? { rejectUnauthorized: false } : false, // Optional: Add SSL
});

pool.on('connect', () => {
  console.log('Connected to the database for seeding.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client for seeding', err);
  process.exit(-1);
});

async function createSchema(client) {
  console.log('Starting schema creation...');
  try {
    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' NOT NULL,
        is_tax_exempt BOOLEAN DEFAULT FALSE NOT NULL,
        tax_exemption_certificate_id VARCHAR(100) NULL,
        tax_exemption_notes TEXT NULL,
        email_verification_token VARCHAR(255) NULL,
        email_verification_token_expires_at TIMESTAMPTZ NULL,
        is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" checked/created.');

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_exemption_certificate_id VARCHAR(100) NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_exemption_notes TEXT NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255) NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "users" table ensured/checked (basic existence).');

    // Suppliers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        address_line1 TEXT,
        address_line2 TEXT,
        city VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100),
        notes TEXT,
        currency_code VARCHAR(3),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "suppliers" checked/created.');

    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email VARCHAR(255);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_line1 TEXT;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_line2 TEXT;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city VARCHAR(100);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country VARCHAR(100);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "suppliers" table ensured/checked (basic existence).');

    // Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "categories" checked/created.');

    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_category_id INTEGER;`);
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "categories" table ensured/checked (basic existence).');

    // Tax Classes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_classes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('Table "tax_classes" checked/created.');

    await client.query(`ALTER TABLE tax_classes ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await client.query(`ALTER TABLE tax_classes ADD COLUMN IF NOT EXISTS description TEXT NULL;`);
    await client.query(`ALTER TABLE tax_classes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE tax_classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "tax_classes" table ensured/checked (basic existence).');

    // Tax Rates Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_rates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          rate_percentage NUMERIC(6, 4) NOT NULL CHECK (rate_percentage >= 0 AND rate_percentage <= 100.0000),
          jurisdiction TEXT NOT NULL,
          tax_type VARCHAR(50) NOT NULL,
          tax_code VARCHAR(50) NULL,
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          priority INTEGER DEFAULT 0 NOT NULL,
          valid_from DATE NULL,
          valid_until DATE NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT uq_tax_rate_name_jurisdiction_type UNIQUE (name, jurisdiction, tax_type)
      );
    `);
    console.log('Table "tax_rates" checked/created.');

    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS rate_percentage NUMERIC(6, 4) NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS tax_rates_rate_percentage_check;`);
    await client.query(`ALTER TABLE tax_rates ADD CONSTRAINT tax_rates_rate_percentage_check CHECK (rate_percentage >= 0 AND rate_percentage <= 100.0000);`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'GLOBAL';`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS tax_type VARCHAR(50) NOT NULL DEFAULT 'SALES';`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS tax_code VARCHAR(50) NULL;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS valid_from DATE NULL;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS valid_until DATE NULL;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE tax_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS uq_tax_rate_name;`);
    await client.query(`ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS uq_tax_rate_name_jurisdiction_type;`);
    await client.query(`ALTER TABLE tax_rates ADD CONSTRAINT uq_tax_rate_name_jurisdiction_type UNIQUE (name, jurisdiction, tax_type);`);
    console.log('All columns and constraints for "tax_rates" table ensured/checked.');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(jurisdiction);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tax_rates_tax_type ON tax_rates(tax_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tax_rates_is_active ON tax_rates(is_active);`);
    console.log('Indexes for "tax_rates" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_class_rates (
          tax_class_id INTEGER NOT NULL REFERENCES tax_classes(id) ON DELETE CASCADE,
          tax_rate_id INTEGER NOT NULL REFERENCES tax_rates(id) ON DELETE CASCADE,
          PRIMARY KEY (tax_class_id, tax_rate_id)
      );
    `);
    console.log('Table "tax_class_rates" checked/created.');
    await client.query(`ALTER TABLE tax_class_rates ADD COLUMN IF NOT EXISTS tax_class_id INTEGER;`);
    await client.query(`ALTER TABLE tax_class_rates ADD COLUMN IF NOT EXISTS tax_rate_id INTEGER;`);
    console.log('All columns for "tax_class_rates" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price NUMERIC(10, 2) NOT NULL,
        wholesale_price NUMERIC(10, 2) NULL, cost_price NUMERIC(10, 2) NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        tax_class_id INTEGER NULL REFERENCES tax_classes(id) ON DELETE SET NULL,
        sku VARCHAR(100) UNIQUE, stock_quantity INTEGER DEFAULT 0 NOT NULL, reorder_threshold INTEGER DEFAULT 0,
        image_url TEXT, has_variants BOOLEAN DEFAULT FALSE NOT NULL,
        average_rating NUMERIC(3, 2) DEFAULT 0.00, review_count INTEGER DEFAULT 0,
        brand_manufacturer TEXT, supplier_reference TEXT,
        product_status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (product_status IN ('active', 'inactive', 'archived')),
        specifications JSONB NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "products" checked/created.');
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(10, 2) NULL;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2) NULL;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_class_id INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3, 2);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_manufacturer TEXT;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_reference TEXT;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_status VARCHAR(20);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB NULL;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "products" table ensured/checked (basic existence).');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_tax_class_id ON products(tax_class_id);`);
    console.log('Index "idx_products_tax_class_id" on "products" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, sku VARCHAR(100) UNIQUE,
        price_modifier NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, wholesale_price_modifier NUMERIC(10, 2) DEFAULT 0.00 NULL,
        cost_price NUMERIC(10, 2) NULL, stock_quantity INTEGER DEFAULT 0 NOT NULL, image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_variants" checked/created.');
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS sku VARCHAR(100);`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price_modifier NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS wholesale_price_modifier NUMERIC(10, 2) NULL;`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2) NULL;`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "product_variants" table ensured/checked (basic existence).');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku_unique ON product_variants(sku);`);
    console.log('Unique index on "product_variants.sku" ensured/checked.');

    await client.query(`CREATE TABLE IF NOT EXISTS product_options (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL);`);
    console.log('Table "product_options" checked/created.');
    await client.query(`ALTER TABLE product_options ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    console.log('All columns for "product_options" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_option_values (
        id SERIAL PRIMARY KEY, product_option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        value VARCHAR(255) NOT NULL, UNIQUE (product_option_id, value)
      );
    `);
    console.log('Table "product_option_values" checked/created.');
    await client.query(`ALTER TABLE product_option_values ADD COLUMN IF NOT EXISTS product_option_id INTEGER;`);
    await client.query(`ALTER TABLE product_option_values ADD COLUMN IF NOT EXISTS value VARCHAR(255);`);
    console.log('All columns for "product_option_values" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_options (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE, UNIQUE (product_id, option_id)
      );
    `);
    console.log('Table "product_assigned_options" checked/created.');
    await client.query(`ALTER TABLE product_assigned_options ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE product_assigned_options ADD COLUMN IF NOT EXISTS option_id INTEGER;`);
    console.log('All columns for "product_assigned_options" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_option_specific_values (
        id SERIAL PRIMARY KEY, product_assigned_option_id INTEGER NOT NULL REFERENCES product_assigned_options(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_assigned_option_id, product_option_value_id)
      );
    `);
    console.log('Table "product_assigned_option_specific_values" checked/created.');
    await client.query(`ALTER TABLE product_assigned_option_specific_values ADD COLUMN IF NOT EXISTS product_assigned_option_id INTEGER;`);
    await client.query(`ALTER TABLE product_assigned_option_specific_values ADD COLUMN IF NOT EXISTS product_option_value_id INTEGER;`);
    await client.query(`ALTER TABLE product_assigned_option_specific_values ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE product_assigned_option_specific_values ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "product_assigned_option_specific_values" table ensured/checked (basic existence).');
    await client.query(`
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_paosv_updated_at' AND tgrelid = 'product_assigned_option_specific_values'::regclass) THEN
        CREATE TRIGGER trigger_update_paosv_updated_at BEFORE UPDATE ON product_assigned_option_specific_values FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp(); END IF; END $$;
    `);
    console.log('Trigger for "product_assigned_option_specific_values.updated_at" ensured.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variant_option_values (
        id SERIAL PRIMARY KEY, product_variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        UNIQUE (product_variant_id, product_option_value_id)
      );
    `);
    console.log('Table "product_variant_option_values" checked/created.');
    await client.query(`ALTER TABLE product_variant_option_values ADD COLUMN IF NOT EXISTS product_variant_id INTEGER;`);
    await client.query(`ALTER TABLE product_variant_option_values ADD COLUMN IF NOT EXISTS product_option_value_id INTEGER;`);
    console.log('All columns for "product_variant_option_values" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, image_url TEXT NOT NULL,
        s3_key TEXT, alt_text VARCHAR(255), display_order INTEGER DEFAULT 0 NOT NULL, is_primary BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_product_image_url UNIQUE (product_id, image_url)
      );
    `);
    console.log('Table "product_images" checked/created.');
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS s3_key TEXT;`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS alt_text VARCHAR(255);`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS display_order INTEGER;`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary BOOLEAN;`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "product_images" table ensured/checked (basic existence).');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_product_id_image_url_unique ON product_images(product_id, image_url);`);
    console.log('Unique index on "product_images(product_id, image_url)" ensured/checked.');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_primary_image_per_product ON product_images (product_id) WHERE is_primary = TRUE;`);
    console.log('Unique index "idx_unique_primary_image_per_product" on "product_images" checked/created.');

    await client.query(`CREATE TABLE IF NOT EXISTS tags (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL);`);
    console.log('Table "tags" checked/created.');
    await client.query(`ALTER TABLE tags ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    console.log('All columns for "tags" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (product_id, tag_id)
      );
    `);
    console.log('Table "product_tags" checked/created.');
    await client.query(`ALTER TABLE product_tags ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE product_tags ADD COLUMN IF NOT EXISTS tag_id INTEGER;`);
    console.log('All columns for "product_tags" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255), comment TEXT, status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, user_id)
      );
    `);
    console.log('Table "product_reviews" checked/created.');
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS user_id INTEGER;`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS rating INTEGER;`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title VARCHAR(255);`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS comment TEXT;`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS status VARCHAR(20);`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "product_reviews" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY, code VARCHAR(255) UNIQUE NOT NULL, type VARCHAR(50) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
        value NUMERIC(10, 2) NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE NOT NULL,
        valid_from TIMESTAMPTZ, valid_until TIMESTAMPTZ, usage_limit INTEGER, times_used INTEGER DEFAULT 0 NOT NULL,
        min_order_amount NUMERIC(10, 2), created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "discounts" checked/created.');
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS code VARCHAR(255);`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS type VARCHAR(50);`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS value NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_limit INTEGER;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS times_used INTEGER;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE discounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "discounts" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, status VARCHAR(50) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided')),
        total_amount NUMERIC(10, 2) NOT NULL, original_total_amount NUMERIC(10,2) NULL,
        discount_id INTEGER REFERENCES discounts(id) ON DELETE SET NULL, discount_code_applied VARCHAR(255), discount_amount_applied NUMERIC(10,2),
        total_tax_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, tax_summary_details JSONB NULL,
        invoice_number VARCHAR(50) UNIQUE NULL, invoice_issue_date TIMESTAMPTZ NULL,
        shipping_address_line1 TEXT NOT NULL, shipping_address_line2 TEXT, shipping_city VARCHAR(100) NOT NULL,
        shipping_state_province_region VARCHAR(100), shipping_postal_code VARCHAR(20) NOT NULL, shipping_country VARCHAR(100) NOT NULL,
        billing_address_line1 TEXT, billing_address_line2 TEXT, billing_city VARCHAR(100),
        billing_state_province_region VARCHAR(100), billing_postal_code VARCHAR(20), billing_country VARCHAR(100),
        shipping_carrier VARCHAR(100) NULL, tracking_number VARCHAR(100) NULL, delivery_confirmed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "orders" checked/created.');
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_total_amount NUMERIC(10,2) NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id INTEGER;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code_applied VARCHAR(255);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount_applied NUMERIC(10,2);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_tax_amount NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_summary_details JSONB NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_issue_date TIMESTAMPTZ NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_state_province_region VARCHAR(100);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_state_province_region VARCHAR(100);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(100) NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100) NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ NULL;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "orders" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        product_variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL, price_at_purchase NUMERIC(10, 2) NOT NULL,
        line_item_tax_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, applied_tax_rate_percentage NUMERIC(6, 4) NULL,
        tax_class_id_at_purchase INTEGER NULL REFERENCES tax_classes(id) ON DELETE SET NULL,
        CHECK (product_variant_id IS NOT NULL OR product_id IS NOT NULL)
      );
    `);
    console.log('Table "order_items" checked/created.');
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE RESTRICT;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_at_purchase NUMERIC(10, 2) NOT NULL;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_item_tax_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS applied_tax_rate_percentage NUMERIC(6, 4) NULL;`);
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_class_id_at_purchase INTEGER NULL REFERENCES tax_classes(id) ON DELETE SET NULL;`);
    console.log('All columns for "order_items" table ensured/checked (basic existence).');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_items_tax_class_id_at_purchase ON order_items(tax_class_id_at_purchase);`);
    console.log('Index "idx_order_items_tax_class_id_at_purchase" on "order_items" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        order_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, expected_delivery_date TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL, notes TEXT, shipping_carrier VARCHAR(100) NULL, tracking_number VARCHAR(100) NULL,
        delivery_status VARCHAR(50) NULL, created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "purchase_orders" checked/created.');
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id INTEGER;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_date TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50);`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(100) NULL;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100) NULL;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) NULL;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "purchase_orders" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY, purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        product_variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT,
        quantity_ordered INTEGER NOT NULL, quantity_received INTEGER DEFAULT 0 NOT NULL,
        unit_cost_price NUMERIC(10, 2) NOT NULL, currency_code VARCHAR(3),
        base_currency_cost_price NUMERIC(12, 2) NULL, exchange_rate_at_receipt NUMERIC(12, 6) NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CHECK (product_variant_id IS NOT NULL OR product_id IS NOT NULL)
      );
    `);
    console.log('Table "purchase_order_items" checked/created.');
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS purchase_order_id INTEGER;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS product_variant_id INTEGER;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS quantity_ordered INTEGER;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS quantity_received INTEGER;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit_cost_price NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS base_currency_cost_price NUMERIC(12, 2) NULL;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS exchange_rate_at_receipt NUMERIC(12, 6) NULL;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "purchase_order_items" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
          id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE CASCADE, batch_number VARCHAR(100) NOT NULL,
          expiry_date DATE NULL, received_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          initial_quantity INTEGER NOT NULL CHECK (initial_quantity > 0),
          current_quantity INTEGER NOT NULL CHECK (current_quantity >= 0),
          cost_price_at_receipt NUMERIC(12, 2) NULL, currency_code_at_receipt VARCHAR(3) NULL,
          base_currency_cost_price_at_receipt NUMERIC(12, 2) NULL, exchange_rate_used NUMERIC(12, 6) NULL,
          purchase_order_item_id INTEGER NULL REFERENCES purchase_order_items(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT unique_batch_per_item UNIQUE (product_id, variant_id, batch_number),
          CONSTRAINT check_current_qty_not_exceeds_initial CHECK (current_quantity <= initial_quantity)
      );
    `);
    console.log('Table "inventory_batches" checked/created.');
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS variant_id INTEGER NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS expiry_date DATE NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS initial_quantity INTEGER;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS current_quantity INTEGER;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS cost_price_at_receipt NUMERIC(12, 2) NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS currency_code_at_receipt VARCHAR(3) NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS base_currency_cost_price_at_receipt NUMERIC(12, 2) NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC(12, 6) NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS purchase_order_item_id INTEGER NULL;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "inventory_batches" table ensured/checked (basic existence).');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id ON inventory_batches(product_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_batches_variant_id ON inventory_batches(variant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_batches_batch_number ON inventory_batches(batch_number);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry_date ON inventory_batches(expiry_date);`);
    console.log('Indexes for "inventory_batches" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_movement_logs (
        id SERIAL PRIMARY KEY, timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, movement_type VARCHAR(50) NOT NULL,
        quantity_changed INTEGER NOT NULL, new_quantity_on_hand INTEGER NOT NULL, reason TEXT,
        reference_id VARCHAR(255), created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CHECK ((variant_id IS NOT NULL AND product_id IS NOT NULL) OR (variant_id IS NULL AND product_id IS NOT NULL))
      );
    `);
    console.log('Table "stock_movement_logs" checked/created.');
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS variant_id INTEGER;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS user_id INTEGER;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS movement_type VARCHAR(50);`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS quantity_changed INTEGER;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS new_quantity_on_hand INTEGER;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS reason TEXT;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255);`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE stock_movement_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "stock_movement_logs" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_cost_history (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, currency_code VARCHAR(3),
        cost_price NUMERIC(10, 2) NOT NULL, quantity_received INTEGER NOT NULL,
        purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE SET NULL,
        effective_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        base_currency_cost_price NUMERIC(12, 2) NULL, exchange_rate_at_receipt NUMERIC(12, 6) NULL,
        CHECK ((variant_id IS NOT NULL AND product_id IS NOT NULL) OR (variant_id IS NULL AND product_id IS NOT NULL))
      );
    `);
    console.log('Table "product_cost_history" checked/created.');
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS product_id INTEGER;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS variant_id INTEGER;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS supplier_id INTEGER;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3);`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2);`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS quantity_received INTEGER;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS purchase_order_item_id INTEGER;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS base_currency_cost_price NUMERIC(12, 2) NULL;`);
    await client.query(`ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS exchange_rate_at_receipt NUMERIC(12, 6) NULL;`);
    console.log('All columns for "product_cost_history" table ensured/checked (basic existence).');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, user_email VARCHAR(255),
        action_type VARCHAR(50) NOT NULL, resource_type VARCHAR(100), resource_id INTEGER, details JSONB,
        ip_address VARCHAR(50), user_agent TEXT, timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('Table "audit_logs" checked/created.');
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR(100);`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id INTEGER;`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;`);
    console.log('All columns for "audit_logs" table ensured/checked (basic existence).');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_id ON audit_logs(resource_type, resource_id);');
    console.log('Indexes for "audit_logs" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS hero_banners (
        id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, subtitle TEXT, button_text VARCHAR(100),
        button_link VARCHAR(255), image_url VARCHAR(255) NOT NULL, alt_text VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE NOT NULL, sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "hero_banners" checked/created.');
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS subtitle TEXT;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS button_text VARCHAR(100);`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS button_link VARCHAR(255);`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NOT NULL;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS alt_text VARCHAR(255);`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`);
    console.log('All columns for "hero_banners" table ensured/checked.');
    await client.query(`
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_hero_banners_updated_at' AND tgrelid = 'hero_banners'::regclass) THEN
      CREATE TRIGGER trigger_update_hero_banners_updated_at BEFORE UPDATE ON hero_banners FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp(); END IF; END $$;
    `);
    console.log('Trigger for "hero_banners.updated_at" ensured.');

    console.log('Schema creation process completed.');
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  }
}

// Definition of seedHeroBanners placed before other seed helper functions
async function seedHeroBanners(client, seededDataIds) {
  console.log('Seeding hero banners...');
  seededDataIds.heroBanners = seededDataIds.heroBanners || {};

  const bannersToSeed = [
    {
      title: 'Summer Collection Arrived!',
      subtitle: 'Discover the latest trends for the sunny season. Bright colors, light fabrics.',
      button_text: 'Explore Summer',
      button_link: '/collections/summer',
      image_url: 'https://via.placeholder.com/1200x400.png?text=Summer+Banner+Active',
      alt_text: 'Bright summer fashion display',
      is_active: true,
      sort_order: 1
    },
    {
      title: 'Flash Sale: 24 Hours Only!',
      subtitle: 'Get 30% off on all accessories. Use code FLASH30.',
      button_text: 'Shop Accessories',
      button_link: '/categories/accessories?promo=flash30',
      image_url: 'https://via.placeholder.com/1200x400.png?text=Flash+Sale+Active',
      alt_text: 'Exciting flash sale announcement',
      is_active: true,
      sort_order: 0
    },
    {
      title: 'New Arrivals: Electronics (Inactive)',
      subtitle: 'Check out the latest gadgets and tech.',
      button_text: 'View New Tech',
      button_link: '/categories/electronics?filter=new',
      image_url: 'https://via.placeholder.com/1200x400.png?text=Tech+Banner+Inactive',
      alt_text: 'Sleek display of new electronic gadgets',
      is_active: false,
      sort_order: 2
    },
    {
      title: 'Winter Clearance (Active High Prio)',
      subtitle: 'Up to 70% off last season winter wear.',
      button_text: 'Shop Clearance',
      button_link: '/sale/winter-clearance',
      image_url: 'https://via.placeholder.com/1200x400.png?text=Winter+Clearance+Active',
      alt_text: 'Winter clothes on sale',
      is_active: true,
      sort_order: 0
    }
  ];

  try {
    for (const banner of bannersToSeed) {
      const result = await client.query(
        `INSERT INTO hero_banners (title, subtitle, button_text, button_link, image_url, alt_text, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (title) DO UPDATE SET
           subtitle = EXCLUDED.subtitle, button_text = EXCLUDED.button_text, button_link = EXCLUDED.button_link,
           image_url = EXCLUDED.image_url, alt_text = EXCLUDED.alt_text, is_active = EXCLUDED.is_active,
           sort_order = EXCLUDED.sort_order, updated_at = CURRENT_TIMESTAMP
         RETURNING id, title;`,
        [banner.title, banner.subtitle, banner.button_text, banner.button_link, banner.image_url, banner.alt_text, banner.is_active, banner.sort_order]
      );
      if (result.rows.length > 0) {
        console.log(`Hero Banner "${result.rows[0].title}" seeded/updated with ID ${result.rows[0].id}.`);
      }
    }
    console.log('Hero banners seeding completed.');
  } catch (error) {
    console.error('Error seeding hero banners:', error);
  }
}

async function updateProductAverageRating(productId, client) {
  try {
    const avgRatingResult = await client.query(
      `SELECT AVG(rating) as average_rating, COUNT(id) as review_count
       FROM product_reviews WHERE product_id = $1 AND status = 'approved'`,
      [productId]
    );
    let averageRating = 0; let reviewCount = 0;
    if (avgRatingResult.rows.length > 0 && avgRatingResult.rows[0].average_rating !== null) {
      averageRating = parseFloat(avgRatingResult.rows[0].average_rating);
      reviewCount = parseInt(avgRatingResult.rows[0].review_count, 10);
    }
    await client.query(
      'UPDATE products SET average_rating = $1, review_count = $2 WHERE id = $3',
      [averageRating.toFixed(2), reviewCount, productId]
    );
    console.log(`Updated average rating for product ID ${productId} to ${averageRating.toFixed(2)} with ${reviewCount} reviews.`);
  } catch (error) {
    console.error(`Error updating average rating for product ${productId}:`, error);
  }
}

async function seedAdminUser(client, seededDataIds) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const saltRounds = 10; const adminName = 'Admin User';
  try {
    const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (checkUser.rows.length > 0) {
      seededDataIds.adminUserId = checkUser.rows[0].id;
      console.log(`Admin user with email ${adminEmail} already exists with ID ${seededDataIds.adminUserId}. Ensuring role is admin.`);
      await client.query('UPDATE users SET role = $1, name = $2 WHERE email = $3', ['admin', adminName, adminEmail]);
      return;
    }
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    const result = await client.query(
      'INSERT INTO users (email, password, role, name) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id',
      [adminEmail, hashedPassword, 'admin', adminName]
    );
    if (result.rows.length > 0) {
      seededDataIds.adminUserId = result.rows[0].id;
      console.log(`Admin user ${adminEmail} (Name: ${adminName}) created successfully with ID ${seededDataIds.adminUserId}.`);
    } else {
      const existingAdmin = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
      if(existingAdmin.rows.length > 0) {
        seededDataIds.adminUserId = existingAdmin.rows[0].id;
        console.log(`Admin user ${adminEmail} (Name: ${adminName}) confirmed existing with ID ${seededDataIds.adminUserId}.`);
      }
    }
  } catch (error) {
    console.error(`Error seeding admin user ${adminEmail}:`, error); throw error;
  }
}

async function seedRegularUsers(client, seededDataIds) {
  const saltRounds = 10; seededDataIds.regularUserIds = [];
  const usersToSeed = [
    { name: 'Sample User One', email: 'user1@example.com', password: 'password123', role: 'user' },
    { name: 'Sample User Two', email: 'user2@example.com', password: 'password123', role: 'user' },
  ];
  console.log('Seeding regular users...');
  for (const userData of usersToSeed) {
    try {
      const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);
      if (checkUser.rows.length > 0) {
        const userId = checkUser.rows[0].id; seededDataIds.regularUserIds.push(userId);
        console.log(`User with email ${userData.email} already exists with ID ${userId}. Ensuring role is '${userData.role}'.`);
        await client.query('UPDATE users SET role = $1, name = $2 WHERE email = $3', [userData.role, userData.name, userData.email]);
        continue;
      }
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      const result = await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id',
        [userData.name, userData.email, hashedPassword, userData.role]
      );
      if (result.rows.length > 0) {
        const userId = result.rows[0].id; seededDataIds.regularUserIds.push(userId);
        console.log(`User ${userData.name} (${userData.email}) created successfully with ID ${userId}.`);
      } else {
         const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);
        if(existingUser.rows.length > 0) {
            const userId = existingUser.rows[0].id;
            if(!seededDataIds.regularUserIds.includes(userId)) seededDataIds.regularUserIds.push(userId);
            console.log(`User ${userData.name} (${userData.email}) confirmed existing with ID ${userId}.`);
        }
      }
    } catch (error) {
      console.error(`Error seeding user ${userData.email}:`, error);
    }
  }
  console.log('Regular user seeding completed.');
}

async function seedSpecificGlobalOptionsAndValues(client, seededDataIds) {
  console.log('Seeding specific global product options and values...');
  seededDataIds.options = seededDataIds.options || {};
  seededDataIds.optionValues = seededDataIds.optionValues || {};
  const optionsToSeed = [
    { name: "Color", values: ["Red", "Blue", "Green"] },
    { name: "Size", values: ["Small", "Medium", "Large"] },
  ];
  try {
    for (const opt of optionsToSeed) {
      let optionResult = await client.query("INSERT INTO product_options (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id;", [opt.name]);
      let optionId;
      if (optionResult.rowCount > 0) {
        optionId = optionResult.rows[0].id;
        console.log(`Product option "${opt.name}" created with ID ${optionId}.`);
      } else {
        optionResult = await client.query("SELECT id FROM product_options WHERE name = $1;", [opt.name]);
        if (optionResult.rows.length === 0) { console.error(`Failed to create or find '${opt.name}' option. Skipping its values.`); continue; }
        optionId = optionResult.rows[0].id;
        console.log(`Product option "${opt.name}" already exists with ID ${optionId}.`);
      }
      const optionKey = `${opt.name.toLowerCase()}OptionId`; seededDataIds.options[optionKey] = optionId;
      const valuesKey = opt.name.toLowerCase(); seededDataIds.optionValues[valuesKey] = seededDataIds.optionValues[valuesKey] || {};
      for (const value of opt.values) {
        let valueResult = await client.query(
          "INSERT INTO product_option_values (product_option_id, value) VALUES ($1, $2) ON CONFLICT (product_option_id, value) DO NOTHING RETURNING id;",
          [optionId, value]
        );
        let valueId;
        if (valueResult.rowCount > 0) {
          valueId = valueResult.rows[0].id;
          console.log(`Value "${value}" for option "${opt.name}" created with ID ${valueId}.`);
        } else {
          valueResult = await client.query("SELECT id FROM product_option_values WHERE product_option_id = $1 AND value = $2;", [optionId, value]);
           if (valueResult.rows.length === 0) { console.error(`Failed to create or find value '${value}' for option '${opt.name}'.`); continue; }
          valueId = valueResult.rows[0].id;
          console.log(`Value "${value}" for option "${opt.name}" already exists with ID ${valueId}.`);
        }
        const valueKey = value.toLowerCase(); seededDataIds.optionValues[valuesKey][`${valueKey}Id`] = valueId;
      }
    }
    console.log('Specific global product options and values seeding completed.');
  } catch (error) {
    console.error('Error seeding specific global product options and values:', error); throw error;
  }
}

async function seedSuppliers(client, seededDataIds) {
  seededDataIds.suppliers = seededDataIds.suppliers || {};
  const sampleSuppliers = [
    { name: 'Global Electronics Inc.', contact_person: 'Jane Doe', email: 'jane.doe@globalelectronics.com', phone: '123-456-7890', currency_code: 'USD' },
    { name: 'Fashion Forward Ltd.', contact_person: 'John Smith', email: 'john.smith@fashionforward.com', phone: '098-765-4321', currency_code: 'EUR' },
    { name: 'Home Comforts Co.', contact_person: 'Alice Brown', email: 'alice.brown@homecomforts.co', phone: '111-222-3333', currency_code: 'USD' },
  ];
  console.log('Seeding suppliers...');
  try {
    for (const supplier of sampleSuppliers) {
      let result = await client.query(
        `INSERT INTO suppliers (name, contact_person, email, phone, currency_code)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO UPDATE SET
           contact_person = EXCLUDED.contact_person, email = EXCLUDED.email, phone = EXCLUDED.phone,
           currency_code = EXCLUDED.currency_code, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [supplier.name, supplier.contact_person, supplier.email, supplier.phone, supplier.currency_code]
      );
      if (result.rows.length > 0) {
        seededDataIds.suppliers[supplier.name] = result.rows[0].id;
        console.log(`Supplier "${supplier.name}" seeded/updated successfully with ID ${result.rows[0].id}.`);
      } else {
        result = await client.query('SELECT id FROM suppliers WHERE name = $1', [supplier.name]);
        if (result.rows.length > 0) {
          seededDataIds.suppliers[supplier.name] = result.rows[0].id;
          console.log(`Supplier "${supplier.name}" already exists with ID ${result.rows[0].id}.`);
        }
      }
    }
    console.log('Supplier seeding completed.');
  } catch (error) {
    console.error('Error seeding suppliers:', error); throw error;
  }
}

async function seedCategories(client) {
  const sampleCategories = [
    { name: 'Apparel', description: 'Clothing items including shirts, pants, and dresses.' },
    { name: 'Accessories', description: 'Fashion accessories like belts, scarves, and hats.' },
    { name: 'Electronics', description: 'Consumer electronics, gadgets, and related accessories.' },
    { name: 'Footwear', description: 'Shoes, boots, sandals, and other types of footwear.' },
    { name: 'Home Goods', description: 'Items for home decoration, kitchenware, and utilities.' },
    { name: 'Books', description: 'Various genres of books, both fiction and non-fiction.' },
    { name: 'Beauty', description: 'Cosmetics, skincare, and personal care products.' },
    { name: 'Sports & Outdoors', description: 'Equipment and apparel for sports and outdoor activities.' },
    { name: 'Digital Music', description: 'Music albums and tracks available for digital download or streaming.' },
    { name: 'Toys & Games', description: 'Toys, board games, puzzles, and video games for all ages.' }
  ];
  console.log('Seeding categories...');
  try {
    for (const category of sampleCategories) {
      const result = await client.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP RETURNING id',
        [category.name, category.description]
      );
      if (result.rowCount > 0) {
        console.log(`Category "${category.name}" seeded/updated successfully with description.`);
      } else {
        const existing = await client.query('SELECT id, description FROM categories WHERE name = $1', [category.name]);
        if (existing.rows.length > 0 && existing.rows[0].description !== category.description) {
             console.log(`Category "${category.name}" already existed, description was updated (confirmation via separate select).`);
        } else if (existing.rows.length > 0) {
            console.log(`Category "${category.name}" already exists with the same description or was just inserted and result.rowCount was unexpectedly 0.`);
        } else {
            console.warn(`Category "${category.name}" was not inserted and not found after attempting seed.`);
        }
      }
    }
    console.log('Category seeding complete.');
  } catch (error) {
    console.error('Error seeding categories:', error); throw error;
  }
}

async function seedProducts(client, seededDataIds) {
  const sampleProducts = [
    { name: 'Wireless Bluetooth Headphones', description: 'High-fidelity wireless headphones with noise cancellation and 20-hour battery life.', price: 149.99, cost_price: 89.99, wholesale_price: 119.99, stock_quantity: 150, category_name: 'Electronics', supplier_name: 'Global Electronics Inc.', image_url: null, sku: 'HDPHN-WL-BT-001', reorder_threshold: 25, brand_manufacturer: 'AudioMax', supplier_reference: 'AM-HDPN-001', product_status: 'active', specifications: {"Connectivity": "Bluetooth 5.0, AUX", "Battery Life": "20 hours", "Driver Size": "40mm", "Noise Cancellation": "Active Noise Cancellation", "Color Options": ["Black", "White", "Blue"]}, tags: ['Audio', 'Wireless', 'Gadget'], tax_class_key: 'standard_goods' },
    { name: 'Men\'s Classic Cotton T-Shirt', description: 'Comfortable and durable 100% cotton t-shirt, available in various colors.', price: 24.99, cost_price: 12.50, wholesale_price: 18.00, stock_quantity: 300, category_name: 'Apparel', supplier_name: 'Fashion Forward Ltd.', image_url: null, sku: 'TSHRT-MEN-COT-005', reorder_threshold: 50, brand_manufacturer: 'Basic Threads', supplier_reference: 'BT-TS-M-COT', product_status: 'active', specifications: {"Material": "100% Organic Cotton", "Fit": "Regular Fit", "Neckline": "Crew Neck", "Care Instructions": "Machine wash cold, tumble dry low"}, tags: ['Clothing', 'Men', 'Summer'], tax_class_key: 'standard_goods' },
    { name: 'Smart Home LED Bulb', description: 'Wi-Fi enabled smart LED bulb, compatible with Alexa and Google Assistant.', price: 19.99, cost_price: 9.00, wholesale_price: null, stock_quantity: 200, category_name: 'Home Goods', supplier_name: 'Global Electronics Inc.', image_url: null, sku: 'SMBLB-LED-WIFI-012', reorder_threshold: 30, brand_manufacturer: 'ConnectHome', supplier_reference: 'CH-BLB-001', product_status: 'active', specifications: null, tags: ['Smart Home', 'Lighting'], tax_class_key: 'reduced_rate_goods' },
    { name: 'Modern Thriller Novel', description: 'A gripping thriller that will keep you on the edge of your seat.', price: 12.99, cost_price: 5.50, wholesale_price: 8.99, stock_quantity: 250, category_name: 'Books', supplier_name: null, image_url: null, sku: 'BOOK-THRILLER-001', brand_manufacturer: 'PageTurners Publishing', supplier_reference: null, product_status: 'active', specifications: null, tags: ['Thriller', 'Fiction', 'Suspense'], tax_class_key: 'tax_exempt_goods' },
    { name: 'The Great Gatsby - Paperback', description: 'A classic novel by F. Scott Fitzgerald. This edition is a quality paperback.', price: 9.99, cost_price: 3.50, wholesale_price: 6.99, stock_quantity: 50, category_name: 'Books', supplier_name: null, image_url: 'https://placehold.co/300x450.png?text=The+Great+Gatsby', sku: 'BOOK-GATSBY-PB', brand_manufacturer: 'Scribner', supplier_reference: null, product_status: 'active', specifications: { "Format": "Paperback", "Language": "English" }, tags: ['Classic', 'Literature', 'Fiction'], tax_class_key: 'tax_exempt_goods' }
  ];
  console.log('Seeding products...');
  try {
    for (const product of sampleProducts) {
      const categoryResult = await client.query('SELECT id FROM categories WHERE name = $1', [product.category_name]);
      if (categoryResult.rows.length === 0) { console.warn(`Category "${product.category_name}" not found for product "${product.name}". Skipping product.`); continue; }
      const categoryId = categoryResult.rows[0].id;
      let supplierId = null;
      if (product.supplier_name) {
        supplierId = seededDataIds.suppliers[product.supplier_name];
        if (!supplierId) { console.warn(`Supplier ID for "${product.supplier_name}" not found. Product will have no supplier.`); }
      }
      const taxClassId = seededDataIds.taxClasses && product.tax_class_key ? seededDataIds.taxClasses[product.tax_class_key] : null;
      if (product.tax_class_key && !taxClassId) { console.warn(`Tax Class ID for key "${product.tax_class_key}" not found for product "${product.name}". Tax class will be NULL.`); }
      const productInsertResult = await client.query(
        `INSERT INTO products (name, description, price, stock_quantity, category_id, supplier_id, image_url, sku, reorder_threshold, brand_manufacturer, supplier_reference, product_status, cost_price, wholesale_price, tax_class_id, specifications)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, stock_quantity = EXCLUDED.stock_quantity,
           category_id = EXCLUDED.category_id, supplier_id = EXCLUDED.supplier_id, image_url = EXCLUDED.image_url,
           reorder_threshold = EXCLUDED.reorder_threshold, brand_manufacturer = EXCLUDED.brand_manufacturer,
           supplier_reference = EXCLUDED.supplier_reference, product_status = EXCLUDED.product_status,
           cost_price = EXCLUDED.cost_price, wholesale_price = EXCLUDED.wholesale_price, tax_class_id = EXCLUDED.tax_class_id,
           specifications = EXCLUDED.specifications, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [ product.name, product.description, product.price, product.stock_quantity, categoryId, supplierId, product.image_url, product.sku, product.reorder_threshold || 0, product.brand_manufacturer, product.supplier_reference, product.product_status || 'active', product.cost_price, product.wholesale_price, taxClassId, product.specifications ]
      );
      let productId;
      if (productInsertResult.rows.length > 0) {
          productId = productInsertResult.rows[0].id;
          console.log(`Product "${product.name}" (SKU: ${product.sku}) seeded/updated successfully with ID ${productId}. TaxClassID: ${taxClassId}`);
      } else {
          const existingProduct = await client.query('SELECT id FROM products WHERE sku = $1', [product.sku]);
          if (existingProduct.rows.length > 0) {
              productId = existingProduct.rows[0].id;
              console.log(`Product with SKU "${product.sku}" already exists with ID ${productId} (fetched by fallback). TaxClassID: ${taxClassId}`);
          } else { console.error(`CRITICAL: Failed to seed or find product with SKU ${product.sku}.`); continue; }
      }
      if (productId && product.sku) { seededDataIds.products[product.sku] = productId; }
      if (productId && product.tags && product.tags.length > 0) {
        for (const tagName of product.tags) {
          const tagResult = await client.query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id;', [tagName]);
          const tagId = tagResult.rows[0].id;
          await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;', [productId, tagId]);
        }
      }
    }
    console.log('Product seeding completed.');
  } catch (error) {
    console.error('Error seeding products:', error); throw error;
  }
}

async function seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure) {
  console.log('Seeding product option configurations...');
  if (!seededDataIds.options || !seededDataIds.optionValues || Object.keys(seededDataIds.options).length === 0) { console.error("Global options/values IDs not available in seededDataIds. Skipping product option configuration."); return; }
  const { colorOptionId, sizeOptionId } = seededDataIds.options;
  const { color: colorValues, size: sizeValues } = seededDataIds.optionValues;
  if (!colorOptionId || !sizeOptionId || !colorValues || Object.keys(colorValues).length === 0 || !sizeValues || Object.keys(sizeValues).length === 0) { console.error("Color or Size option/values IDs are missing or not fully populated. Skipping configuration."); return; }
  const configurations = [
    { sku: productSkusToConfigure[0], options: [ { optionId: colorOptionId, allowedValueIds: [colorValues.redId, colorValues.blueId] }, { optionId: sizeOptionId, allowedValueIds: [sizeValues.smallId, sizeValues.mediumId] } ] },
    { sku: productSkusToConfigure[1], options: [ { optionId: colorOptionId, allowedValueIds: [colorValues.greenId, colorValues.blueId] } ] }
  ];
  for (const config of configurations) {
    const productId = seededDataIds.products[config.sku];
    if (!productId) { console.warn(`Product with SKU ${config.sku} not found in seededProductIds. Skipping its option configuration.`); continue; }
    console.log(`Configuring options for Product ID: ${productId} (SKU: ${config.sku})`);
    await client.query('UPDATE products SET has_variants = TRUE WHERE id = $1', [productId]);
    console.log(`Marked product ID ${productId} as has_variants = true.`);
    for (const optConfig of config.options) {
      if (!optConfig.optionId || !optConfig.allowedValueIds || optConfig.allowedValueIds.length === 0) { console.warn(`Skipping invalid option configuration for product ${productId}:`, optConfig); continue; }
      const assignedOptResult = await client.query( `INSERT INTO product_assigned_options (product_id, option_id) VALUES ($1, $2) ON CONFLICT (product_id, option_id) DO UPDATE SET option_id = EXCLUDED.option_id RETURNING id;`, [productId, optConfig.optionId] );
      const assignedOptionId = assignedOptResult.rows[0]?.id;
      if (!assignedOptionId) { console.error(`Failed to assign option ID ${optConfig.optionId} to product ID ${productId}. Skipping its values.`); continue; }
      console.log(`Assigned option ID ${optConfig.optionId} to product ID ${productId} (Assigned ID: ${assignedOptionId}).`);
      for (const valueId of optConfig.allowedValueIds) {
        if (!valueId) { console.warn(`Undefined valueId found for product ${productId}, option ${optConfig.optionId}. Skipping.`); continue; }
        await client.query( `INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id) VALUES ($1, $2) ON CONFLICT (product_assigned_option_id, product_option_value_id) DO NOTHING;`, [assignedOptionId, valueId] );
        console.log(`  - Allowed value ID ${valueId} for assigned option ID ${assignedOptionId} into product_assigned_option_specific_values.`);
      }
    }
  }
  console.log('Product option configurations seeding completed.');
}

async function seedProductVariants(client, seededDataIds) {
    console.log('Seeding product variants...');
    if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 || !seededDataIds.optionValues || Object.keys(seededDataIds.optionValues).length === 0) { console.error("Product IDs or global option value IDs not available. Skipping product variant seeding."); return; }
    const variantsToSeed = [
        { baseProductSku: 'TSHRT-MEN-COT-005', variantSku: 'TSHRT-RD-S', price_modifier: 0.00, cost_price: 12.50, wholesale_price_modifier: -1.00, stock_quantity: 10, image_url: 'https://via.placeholder.com/300x300.png?text=T-Shirt+Red+S', optionValueMapping: [ { option: 'color', valueKey: 'redId' }, { option: 'size', valueKey: 'smallId' } ] },
        { baseProductSku: 'TSHRT-MEN-COT-005', variantSku: 'TSHRT-BL-M', price_modifier: 1.50, cost_price: 13.00, wholesale_price_modifier: -0.50, stock_quantity: 7, image_url: 'https://via.placeholder.com/300x300.png?text=T-Shirt+Blue+M', optionValueMapping: [ { option: 'color', valueKey: 'blueId' }, { option: 'size', valueKey: 'mediumId' } ] },
        { baseProductSku: 'HDPHN-WL-BT-001', variantSku: 'HDPHN-GRN', price_modifier: 5.00, cost_price: 92.00, wholesale_price_modifier: 2.00, stock_quantity: 20, image_url: 'https://via.placeholder.com/300x300.png?text=Headphones+Green', optionValueMapping: [ { option: 'color', valueKey: 'greenId' } ] },
    ];
    seededDataIds.variants = seededDataIds.variants || {};
    try {
        for (const variantData of variantsToSeed) {
            const productId = seededDataIds.products[variantData.baseProductSku];
            if (!productId) { console.warn(`Base product with SKU ${variantData.baseProductSku} not found. Skipping variant ${variantData.variantSku}.`); continue; }
            const optionValueIdsForVariant = variantData.optionValueMapping.map(map => seededDataIds.optionValues[map.option]?.[map.valueKey]).filter(id => id);
            if (optionValueIdsForVariant.length !== variantData.optionValueMapping.length) { console.warn(`Could not resolve all option value IDs for variant ${variantData.variantSku}. Skipping.`); continue; }
            console.log(`Processing variant ${variantData.variantSku} for product ID ${productId}`);
            const variantResult = await client.query(
                `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, wholesale_price_modifier)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (sku) DO UPDATE SET
                   price_modifier = EXCLUDED.price_modifier, stock_quantity = EXCLUDED.stock_quantity, image_url = EXCLUDED.image_url,
                   cost_price = EXCLUDED.cost_price, wholesale_price_modifier = EXCLUDED.wholesale_price_modifier, updated_at = CURRENT_TIMESTAMP
                 RETURNING id;`,
                [productId, variantData.variantSku, variantData.price_modifier, variantData.stock_quantity, variantData.image_url, variantData.cost_price, variantData.wholesale_price_modifier]
            );
            let variantId;
            if (variantResult.rows.length > 0) {
                variantId = variantResult.rows[0].id; console.log(`  - Variant ${variantData.variantSku} created/updated with ID ${variantId}.`);
            } else {
                const existingVariant = await client.query('SELECT id FROM product_variants WHERE sku = $1', [variantData.variantSku]);
                if (existingVariant.rows.length > 0) { variantId = existingVariant.rows[0].id; console.log(`  - Variant ${variantData.variantSku} confirmed existing with ID ${variantId}.`); }
                else { console.error(`  - CRITICAL: Failed to create or find variant with SKU ${variantData.variantSku}.`); continue; }
            }
            seededDataIds.variants[variantData.variantSku] = variantId;
            if (variantId) {
                for (const ovId of optionValueIdsForVariant) {
                    await client.query( `INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2) ON CONFLICT (product_variant_id, product_option_value_id) DO NOTHING;`, [variantId, ovId] );
                    console.log(`    - Linked option value ID ${ovId} to variant ID ${variantId}.`);
                }
            }
        }
        console.log('Product variant seeding completed.');
    } catch (error) {
        console.error('Error seeding product variants:', error); throw error;
    }
}

async function seedProductReviews(client, seededDataIds) {
    console.log('Seeding product reviews...');
    if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 || !seededDataIds.users || (!seededDataIds.users.adminUserId && (!seededDataIds.users.regularUserIds || seededDataIds.users.regularUserIds.length === 0))) { console.error("Product or User IDs not available. Skipping review seeding."); return; }
    const reviewsToSeed = [
      { productSku: 'TSHRT-MEN-COT-005', userIdKey: 'regularUserIds[0]', rating: 5, title: 'Great T-Shirt!', comment: 'Loved the color and fit.', status: 'approved' },
      { productSku: 'TSHRT-MEN-COT-005', userIdKey: 'regularUserIds[1]', rating: 4, title: 'Good quality', comment: 'A bit larger than expected, but good.', status: 'approved' },
      { productSku: 'HDPHN-WL-BT-001', userIdKey: 'regularUserIds[0]', rating: 3, title: 'Okay headphones', comment: 'Sound is decent, comfort could be better.', status: 'pending' },
      { productSku: 'BOOK-THRILLER-001', userIdKey: 'adminUserId', rating: 5, title: 'Excellent Read!', comment: 'Kept me on the edge of my seat.', status: 'approved' },
      { productSku: 'BOOK-THRILLER-001', userIdKey: 'regularUserIds[1]', rating: 2, title: 'Not for me', comment: 'Found it a bit slow.', status: 'rejected' },
    ];
    const reviewedProductIds = new Set();
    try {
        for (const reviewData of reviewsToSeed) {
            const productId = seededDataIds.products[reviewData.productSku];
            let userId;
            if (reviewData.userIdKey === 'adminUserId') { userId = seededDataIds.users.adminUserId; }
            else if (reviewData.userIdKey.startsWith('regularUserIds[')) { const index = parseInt(reviewData.userIdKey.match(/\[(\d+)\]/)[1], 10); userId = seededDataIds.users.regularUserIds?.[index]; }
            if (!productId) { console.warn(`Product with SKU ${reviewData.productSku} not found for review. Skipping.`); continue; }
            if (!userId) { console.warn(`User with key ${reviewData.userIdKey} not found for review on product ${reviewData.productSku}. Skipping.`); continue; }
            console.log(`Seeding review for product ID ${productId} by user ID ${userId}.`);
            await client.query( `INSERT INTO product_reviews (product_id, user_id, rating, title, comment, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (product_id, user_id) DO NOTHING;`, [productId, userId, reviewData.rating, reviewData.title, reviewData.comment, reviewData.status] );
            reviewedProductIds.add(productId);
        }
        console.log('Updating average ratings for products with new reviews...');
        for (const productId of reviewedProductIds) { await updateProductAverageRating(productId, client); }
        console.log('Product review seeding completed.');
    } catch (error) {
        console.error('Error seeding product reviews:', error); throw error;
    }
}

async function seedDatabase() {
  console.log('Starting database seeding...');
  let client;
  try {
    client = await pool.connect();
    await createSchema(client);
    await client.query('BEGIN');
    const seededDataIds = { users: {}, options: {}, optionValues: {}, products: {}, taxClasses: {}, taxRates: {}, roles: {}, permissions: {}, heroBanners: {} };
    await seedTaxConfiguration(client, seededDataIds);
    await seedRbac(client, seededDataIds);
    await seedAdminUser(client, seededDataIds.users);
    await seedRegularUsers(client, seededDataIds.users);
    console.log('Migrating users to role_ids...');
    if (seededDataIds.roles.super_admin && seededDataIds.roles.customer) {
      const allUsers = await client.query('SELECT id, role FROM users WHERE role_id IS NULL');
      for (const user of allUsers.rows) {
        let targetRoleId = null;
        if (user.role === 'admin') { targetRoleId = seededDataIds.roles.super_admin; }
        else if (user.role === 'customer' || user.role === 'user' || user.role === 'guest') { targetRoleId = seededDataIds.roles.customer; }
        if (targetRoleId) {
          await client.query('UPDATE users SET role_id = $1 WHERE id = $2', [targetRoleId, user.id]);
          console.log(`Migrated user ID ${user.id} (legacy role: ${user.role}) to role_id ${targetRoleId}.`);
        } else { console.warn(`User ID ${user.id} has legacy role "${user.role}" which has no defined migration path to a new role_id. It will remain with role_id NULL.`); }
      }
      console.log('User role_id migration step completed.');
      console.log('Skipping direct FK constraint creation for users.role_id in seed.js; this is handled by db.js.');
    } else { console.error('CRITICAL: Super Admin or Customer role IDs not found in seededDataIds.roles. Skipping user role_id migration.'); }
    await seedCategories(client);
    await seedSuppliers(client, seededDataIds);
    await seedSpecificGlobalOptionsAndValues(client, seededDataIds);
    await seedProducts(client, seededDataIds);
    const productSkusToConfigure = ['TSHRT-MEN-COT-005', 'HDPHN-WL-BT-001'];
    if (Object.keys(seededDataIds.products).length > 0 && seededDataIds.options.colorOptionId && seededDataIds.options.sizeOptionId) {
      await seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure);
      await seedProductVariants(client, seededDataIds);
    } else { console.warn("Skipping product option configurations and variant seeding due to missing product IDs or global option/value IDs."); }
    await seedProductImages(client, seededDataIds);
    await seedProductReviews(client, seededDataIds);
    await seedInventoryBatches(client, seededDataIds);
    await seedCostHistory(client, seededDataIds);
    await seedStockMovements(client, seededDataIds);
    await seedHeroBanners(client, seededDataIds);
    console.log('Database seeding completed successfully.');
    try {
      const gatsbyProductIdResult = await client.query("SELECT id FROM products WHERE sku = 'BOOK-GATSBY-PB';");
      if (gatsbyProductIdResult.rows.length > 0) {
        const gatsbyProdId = gatsbyProductIdResult.rows[0].id;
        const gatsbyBatchCheck = await client.query("SELECT product_id, variant_id, batch_number, initial_quantity, current_quantity FROM inventory_batches WHERE product_id = $1 AND batch_number = 'BATCH_GATSBY001_202302'", [gatsbyProdId]);
        if (gatsbyBatchCheck.rows.length > 0) { console.log("[SeedDB VERIFY] 'The Great Gatsby - Paperback' batch FOUND in DB post-seed:", JSON.stringify(gatsbyBatchCheck.rows[0])); }
        else { console.error(`[SeedDB VERIFY ERROR] 'The Great Gatsby - Paperback' batch NOT FOUND in DB post-seed for Product ID: ${gatsbyProdId}. This is critical for checkout.`); }
      } else { console.error("[SeedDB VERIFY ERROR] 'The Great Gatsby - Paperback' product (SKU: BOOK-GATSBY-PB) NOT FOUND in DB post-seed. Batch cannot exist."); }
    } catch (verifyError) { console.error("[SeedDB VERIFY ERROR] Error during post-seed verification query for Gatsby batch:", verifyError); }
    await client.query('COMMIT');
  } catch (error) {
    if (client) { await client.query('ROLLBACK'); }
    console.error('Error during database seeding, transaction rolled back:', error); throw error;
  } finally {
    if (client) { client.release(); console.log('Database client released.'); }
    await pool.end(); console.log('Seeding pool has ended.');
  }
}

async function seedRbac(client, seededDataIds) {
  console.log('Seeding RBAC (Roles, Permissions, Role-Permissions)...');
  seededDataIds.roles = seededDataIds.roles || {}; seededDataIds.permissions = seededDataIds.permissions || {};
  const rolesToSeed = [
    { name: 'Super Admin', description: 'Full system access.' },
    { name: 'Product Manager', description: 'Manages products, categories, and tags.' },
    { name: 'Customer', description: 'Standard customer account.' },
  ];
  const permissionsToSeed = [
    { name: 'admin:access_dashboard', description: 'Can access the admin dashboard area.', group_name: 'Admin' },
    { name: 'products:view', description: 'Can view products.', group_name: 'Products' }, { name: 'products:create', description: 'Can create new products.', group_name: 'Products' },
    { name: 'products:edit', description: 'Can edit existing products (details, pricing, inventory, variants, images).', group_name: 'Products' },
    { name: 'products:edit_pricing', description: 'Can edit product prices and cost price.', group_name: 'Products' },
    { name: 'products:edit_inventory', description: 'Can edit product stock levels and reorder thresholds.', group_name: 'Products' },
    { name: 'products:delete', description: 'Can delete products.', group_name: 'Products' }, { name: 'categories:manage', description: 'Can manage product categories.', group_name: 'Products' },
    { name: 'tags:manage', description: 'Can manage product tags.', group_name: 'Products' }, { name: 'users:view', description: 'Can view users.', group_name: 'Users' },
    { name: 'users:create', description: 'Can create new users.', group_name: 'Users' }, { name: 'users:edit', description: 'Can edit user details.', group_name: 'Users' },
    { name: 'users:assign_roles', description: 'Can assign roles to users.', group_name: 'Users' }, { name: 'users:delete', description: 'Can delete users.', group_name: 'Users' },
    { name: 'rbac:manage', description: 'Can manage roles and permissions assignments.', group_name: 'System' },
    { name: 'orders:view_all', description: 'Can view all orders.', group_name: 'Orders' }, { name: 'orders:view_details', description: 'Can view details of any order.', group_name: 'Orders' },
    { name: 'orders:update_status', description: 'Can update order statuses.', group_name: 'Orders' }, { name: 'orders:manage_refunds', description: 'Can process refunds.', group_name: 'Orders' },
    { name: 'discounts:manage', description: 'Can create, edit, and delete discounts.', group_name: 'Discounts' },
    { name: 'taxes:manage_classes', description: 'Can manage tax classes.', group_name: 'Taxes' }, { name: 'taxes:manage_rates', description: 'Can manage tax rates.', group_name: 'Taxes' },
    { name: 'suppliers:manage', description: 'Can manage suppliers.', group_name: 'Suppliers' },
    { name: 'purchase_orders:manage', description: 'Can manage purchase orders.', group_name: 'Purchase Orders' },
    { name: 'reports:view', description: 'Can view admin reports.', group_name: 'Reports' },
    { name: 'settings:manage_general', description: 'Can manage general store settings.', group_name: 'Settings' },
    { name: 'options:manage_global', description: 'Can manage global product options and their values.', group_name: 'Products' },
    { name: 'returns:manage', description: 'Can manage customer returns.', group_name: 'Orders' },
    { name: 'reviews:manage', description: 'Can manage product reviews (approve, reject, delete).', group_name: 'Products' },
    { name: 'auditlogs:view', description: 'Can view system audit logs.', group_name: 'System' },
    { name: 'marketing:send_emails', description: 'Allows sending of marketing emails to user segments.', group_name: 'Marketing' },
  ];
  try {
    for (const role of rolesToSeed) {
      const result = await client.query( 'INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id, name;', [role.name, role.description] );
      if (result.rows.length > 0) { const roleKey = result.rows[0].name.toLowerCase().replace(/ /g, '_'); seededDataIds.roles[roleKey] = result.rows[0].id; console.log(`Role "${result.rows[0].name}" seeded/updated with ID ${result.rows[0].id}.`); }
    }
    for (const perm of permissionsToSeed) {
      const result = await client.query( 'INSERT INTO permissions (name, description, group_name) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, group_name = EXCLUDED.group_name RETURNING id, name;', [perm.name, perm.description, perm.group_name] );
      if (result.rows.length > 0) { seededDataIds.permissions[result.rows[0].name] = result.rows[0].id; console.log(`Permission "${result.rows[0].name}" seeded/updated with ID ${result.rows[0].id}.`); }
    }
    const rolePermissionsToAssign = {
      'super_admin': Object.keys(seededDataIds.permissions),
      'product_manager': [ 'admin:access_dashboard', 'products:view', 'products:create', 'products:edit', 'products:delete', 'categories:manage', 'tags:manage', ],
      'customer': []
    };
    for (const roleNameKey in rolePermissionsToAssign) {
      const roleId = seededDataIds.roles[roleNameKey];
      if (!roleId) { console.warn(`Role ID for key "${roleNameKey}" not found. Skipping permission assignment.`); continue; }
      const permissionsForRole = rolePermissionsToAssign[roleNameKey];
      for (const permName of permissionsForRole) {
        const permissionId = seededDataIds.permissions[permName];
        if (!permissionId) { console.warn(`Permission ID for name "${permName}" not found. Skipping assignment to role "${roleNameKey}".`); continue; }
        try { await client.query( 'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;', [roleId, permissionId] ); }
        catch (rpError) { console.error(`Error assigning permission "${permName}" (ID: ${permissionId}) to role "${roleNameKey}" (ID: ${roleId}):`, rpError); }
      }
      console.log(`Finished assigning permissions for role "${roleNameKey}".`);
    }
    console.log('RBAC seeding completed.');
  } catch (error) {
    console.error('Error seeding RBAC:', error); throw error;
  }
}

if (require.main === module) {
  seedDatabase().catch(err => {
    process.exit(1);
  });
}

// --- New Seeding Functions --- (This comment might be a good anchor if it's unique)
async function seedTaxConfiguration(client, seededDataIds) {
  console.log('Seeding tax configuration...');
  seededDataIds.taxClasses = seededDataIds.taxClasses || {};
  seededDataIds.taxRates = seededDataIds.taxRates || {};
  const taxClassesToSeed = [
    { name: "Standard Goods", description: "Default tax class for most items" },
    { name: "Reduced Rate Goods", description: "Items eligible for a reduced tax rate" },
    { name: "Tax Exempt Goods", description: "Items that are exempt from taxation" }
  ];
  const taxRatesToSeed = [
    { name: "CA Sales Tax", rate_percentage: 8.25, jurisdiction: "US-CA", type: "SALES", tax_code: "CA-SALES-STD", priority: 0, is_active: true, valid_from: "2023-01-01", valid_until: null },
    { name: "NY Sales Tax", rate_percentage: 8.875, jurisdiction: "US-NY", type: "SALES", tax_code: "NY-SALES-STD", priority: 0, is_active: true, valid_from: "2023-01-01", valid_until: null },
    { name: "TX Sales Tax - Exempt", rate_percentage: 0.00, jurisdiction: "US-TX", type: "SALES", tax_code: "TX-SALES-EXEMPT", priority: 0, is_active: true, valid_from: "2023-01-01", valid_until: null },
    { name: "Federal GST (Canada)", rate_percentage: 5.00, jurisdiction: "CA", type: "GST", tax_code: "CA-GST", priority: 0, is_active: true, valid_from: "2023-01-01", valid_until: null },
    { name: "Reduced CA Sales Tax", rate_percentage: 2.50, jurisdiction: "US-CA", type: "SALES", tax_code: "CA-SALES-RED", priority: 1, is_active: true, valid_from: "2023-01-01", valid_until: null }
  ];
  try {
    for (const tc of taxClassesToSeed) {
      const result = await client.query( 'INSERT INTO tax_classes (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP RETURNING id;', [tc.name, tc.description] );
      const key = tc.name.toLowerCase().replace(/ /g, '_'); seededDataIds.taxClasses[key] = result.rows[0].id;
      console.log(`Tax Class "${tc.name}" seeded with ID ${result.rows[0].id}.`);
    }
    for (const tr of taxRatesToSeed) {
      const rateForDb = tr.rate_percentage / 100;
      const result = await client.query(
        `INSERT INTO tax_rates (name, rate_percentage, jurisdiction, tax_type, tax_code, priority, is_active, valid_from, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (name, jurisdiction, tax_type) DO UPDATE SET
           rate_percentage = EXCLUDED.rate_percentage, tax_code = EXCLUDED.tax_code, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active,
           valid_from = EXCLUDED.valid_from, valid_until = EXCLUDED.valid_until, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [tr.name, rateForDb, tr.jurisdiction, tr.type, tr.tax_code, tr.priority, tr.is_active, tr.valid_from, tr.valid_until]
      );
      const key = tr.name.toLowerCase().replace(/ /g, '_').replace(/[^\w]/g, ''); seededDataIds.taxRates[key] = result.rows[0].id;
      console.log(`Tax Rate "${tr.name}" seeded with ID ${result.rows[0].id}.`);
    }
    const links = [
      { classKey: 'standard_goods', rateKey: 'ca_sales_tax' }, { classKey: 'standard_goods', rateKey: 'ny_sales_tax' },
      { classKey: 'tax_exempt_goods', rateKey: 'tx_sales_tax__exempt' }, { classKey: 'standard_goods', rateKey: 'federal_gst_canada' },
      { classKey: 'reduced_rate_goods', rateKey: 'reduced_ca_sales_tax' }
    ];
    for (const link of links) {
      const classId = seededDataIds.taxClasses[link.classKey]; const rateId = seededDataIds.taxRates[link.rateKey];
      if (classId && rateId) {
        await client.query( 'INSERT INTO tax_class_rates (tax_class_id, tax_rate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;', [classId, rateId] );
        console.log(`Linked Tax Class "${link.classKey}" (ID: ${classId}) with Tax Rate "${link.rateKey}" (ID: ${rateId}).`);
      } else { console.warn(`Could not link class "${link.classKey}" (ID: ${classId}) with rate "${link.rateKey}" (ID: ${rateId}) due to missing IDs.`); }
    }
    console.log('Tax configuration seeding completed.');
  } catch (error) {
    console.error('Error seeding tax configuration:', error); throw error;
  }
}

async function seedProductImages(client, seededDataIds) {
  console.log('Seeding product images...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0) { console.warn("Product IDs not available. Skipping product image seeding."); return; }
  const imagesToSeed = [
    { productSku: 'HDPHN-WL-BT-001', images: [ { image_url: 'https://via.placeholder.com/600x600.png?text=Headphones+Gallery+1', alt_text: 'Headphones Side View', display_order: 1, is_primary: true }, { image_url: 'https://via.placeholder.com/600x600.png?text=Headphones+Gallery+2', alt_text: 'Headphones Front View', display_order: 2, is_primary: false }, ] },
    { productSku: 'TSHRT-MEN-COT-005', images: [ { image_url: 'https://via.placeholder.com/600x600.png?text=T-Shirt+Gallery+1', alt_text: 'T-Shirt Front', display_order: 1, is_primary: true }, ] }
  ];
  try {
    for (const productImageData of imagesToSeed) {
      const productId = seededDataIds.products[productImageData.productSku];
      if (!productId) { console.warn(`Product with SKU ${productImageData.productSku} not found for image seeding. Skipping.`); continue; }
      await client.query('UPDATE product_images SET is_primary = FALSE WHERE product_id = $1', [productId]);
      console.log(`Cleared existing primary image flags for product ID ${productId}.`);
      let primaryImageUrlForProduct = null; let primaryImageMarkedInSeed = false;
      for (const img of productImageData.images) {
        let currentImgIsPrimary = img.is_primary;
        if (currentImgIsPrimary && primaryImageMarkedInSeed) { console.warn(`Multiple primary images defined in seed for product SKU ${productImageData.productSku}. Using only the first one encountered.`); currentImgIsPrimary = false; }
        if (currentImgIsPrimary && !primaryImageMarkedInSeed) { primaryImageMarkedInSeed = true; }
        const result = await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (product_id, image_url) DO UPDATE SET
             alt_text = EXCLUDED.alt_text, display_order = EXCLUDED.display_order, is_primary = EXCLUDED.is_primary, updated_at = CURRENT_TIMESTAMP
           RETURNING id, image_url, is_primary;`,
          [productId, img.image_url, img.alt_text, img.display_order, currentImgIsPrimary]
        );
        if (result.rows.length > 0 && result.rows[0].is_primary) { primaryImageUrlForProduct = result.rows[0].image_url; }
        console.log(`Seeded/Updated image "${img.alt_text}" for product ID ${productId} (is_primary: ${currentImgIsPrimary}).`);
      }
      if (!primaryImageUrlForProduct && productImageData.images.length > 0) {
          const firstImage = productImageData.images[0];
          await client.query( 'UPDATE product_images SET is_primary = TRUE WHERE product_id = $1 AND image_url = $2 RETURNING image_url', [productId, firstImage.image_url] )
          .then(updateResult => { if (updateResult.rows.length > 0) { primaryImageUrlForProduct = updateResult.rows[0].image_url; console.log(`Defaulted first image '${firstImage.alt_text}' to primary for product ID ${productId}.`); } });
      }
      if (primaryImageUrlForProduct) {
        await client.query('UPDATE products SET image_url = $1 WHERE id = $2', [primaryImageUrlForProduct, productId]);
        console.log(`Updated main image_url for product ID ${productId} to ${primaryImageUrlForProduct}.`);
      } else if (productImageData.images.length > 0) { console.warn(`No primary image could be definitively set for product ID ${productId} from seed data. Main product image_url may not be updated.`); }
    }
    console.log('Product images seeding completed.');
  } catch (error) {
    console.error('Error seeding product images:', error);
  }
}

async function seedStockMovements(client, seededDataIds) {
  console.log('Seeding stock movements...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 || !seededDataIds.users.adminUserId) { console.warn("Product IDs or Admin User ID not available. Skipping stock movement seeding."); return; }
  const productId1 = seededDataIds.products['HDPHN-WL-BT-001'];
  const variantId1_1 = seededDataIds.variants ? seededDataIds.variants['HDPHN-GRN'] : null;
  const productId2 = seededDataIds.products['TSHRT-MEN-COT-005'];
  const adminUserId = seededDataIds.users.adminUserId;
  const movements = [];
  if (productId1) {
    movements.push({ product_id: productId1, variant_id: null, user_id: adminUserId, movement_type: 'initial_stock_setup', quantity_changed: 150, new_quantity_on_hand: 150, reason: 'Initial stock from seed' });
    movements.push({ product_id: productId1, variant_id: null, user_id: adminUserId, movement_type: 'stock_take_decrease', quantity_changed: -5, new_quantity_on_hand: 145, reason: 'Stock count adjustment' });
  }
  if (variantId1_1) { movements.push({ product_id: productId1, variant_id: variantId1_1, user_id: adminUserId, movement_type: 'po_receipt', quantity_changed: 10, new_quantity_on_hand: 20, reason: 'PO #123 Receipt', reference_id: 'poitem_placeholder_1' }); }
  if (productId2) { movements.push({ product_id: productId2, variant_id: null, user_id: adminUserId, movement_type: 'sale_deduction', quantity_changed: -2, new_quantity_on_hand: 298, reason: 'Order #XYZ Sale', reference_id: 'order_placeholder_1' }); }
  try {
    for (const move of movements) {
      await client.query( `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING;`, [move.product_id, move.variant_id, move.user_id, move.movement_type, move.quantity_changed, move.new_quantity_on_hand, move.reason, move.reference_id] );
    }
    console.log(`${movements.length} stock movements seeded.`);
  } catch (error) { console.error('Error seeding stock movements:', error); }
}

async function seedCostHistory(client, seededDataIds) {
  console.log('Seeding product cost history...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 || !seededDataIds.suppliers || Object.keys(seededDataIds.suppliers).length === 0) { console.warn("Product IDs or Supplier IDs not available. Skipping cost history seeding."); return; }
  const supplierId1 = seededDataIds.suppliers['Global Electronics Inc.'];
  const productId1 = seededDataIds.products['HDPHN-WL-BT-001'];
  const variantId1_1 = seededDataIds.variants ? seededDataIds.variants['HDPHN-GRN'] : null;
  const historyEntries = [];
  if (productId1 && supplierId1) {
    historyEntries.push({ product_id: productId1, variant_id: null, supplier_id: supplierId1, currency_code: 'USD', cost_price: 85.00, quantity_received: 50, purchase_order_item_id: null, effective_date: '2023-01-15T00:00:00Z', base_currency_cost_price: 85.00, exchange_rate_at_receipt: 1.0 });
    historyEntries.push({ product_id: productId1, variant_id: null, supplier_id: supplierId1, currency_code: 'USD', cost_price: 87.50, quantity_received: 100, purchase_order_item_id: null, effective_date: '2023-03-20T00:00:00Z', base_currency_cost_price: 87.50, exchange_rate_at_receipt: 1.0 });
  }
  if (variantId1_1 && supplierId1 && productId1) { historyEntries.push({ product_id: productId1, variant_id: variantId1_1, supplier_id: supplierId1, currency_code: 'USD', cost_price: 92.00, quantity_received: 20, purchase_order_item_id: null, effective_date: '2023-04-10T00:00:00Z', base_currency_cost_price: 92.00, exchange_rate_at_receipt: 1.0 }); }
  try {
    for (const entry of historyEntries) {
      await client.query( `INSERT INTO product_cost_history (product_id, variant_id, supplier_id, currency_code, cost_price, quantity_received, purchase_order_item_id, effective_date, base_currency_cost_price, exchange_rate_at_receipt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING;`, [entry.product_id, entry.variant_id, entry.supplier_id, entry.currency_code, entry.cost_price, entry.quantity_received, entry.purchase_order_item_id, entry.effective_date, entry.base_currency_cost_price, entry.exchange_rate_at_receipt] );
    }
    console.log(`${historyEntries.length} product cost history entries seeded.`);
  } catch (error) { console.error('Error seeding product cost history:', error); }
}

async function seedInventoryBatches(client, seededDataIds) {
  console.log('Seeding inventory batches...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0) { console.warn("Product IDs not available for inventory batch seeding. Skipping."); return; }
  const productSku1 = 'HDPHN-WL-BT-001'; const variantSku1 = 'HDPHN-GRN';
  const productId1 = seededDataIds.products[productSku1];
  const variantId1 = seededDataIds.variants && seededDataIds.variants[variantSku1] ? seededDataIds.variants[variantSku1] : null;
  const productSku2 = 'TSHRT-MEN-COT-005'; const productId2 = seededDataIds.products[productSku2];
  const productSku3 = 'BOOK-THRILLER-001'; const productId3 = seededDataIds.products[productSku3];
  const productSkuGatsby = 'BOOK-GATSBY-PB'; const productIdGatsby = seededDataIds.products[productSkuGatsby];
  const batchesToSeed = [];
  if (productId1 && variantId1) { batchesToSeed.push({ product_id: productId1, variant_id: variantId1, batch_number: 'BATCH_V001_202305', expiry_date: '2026-05-31', initial_quantity: 50, current_quantity: 45, cost_price_at_receipt: 92.00, currency_code_at_receipt: 'USD', base_currency_cost_price_at_receipt: 92.00, exchange_rate_used: 1.0, purchase_order_item_id: null }); }
  if (productId2) {
    batchesToSeed.push({ product_id: productId2, variant_id: null, batch_number: 'BATCH_P002_202304', expiry_date: null, initial_quantity: 100, current_quantity: 80, cost_price_at_receipt: 12.00, currency_code_at_receipt: 'EUR', base_currency_cost_price_at_receipt: null, exchange_rate_used: null, purchase_order_item_id: null });
    batchesToSeed.push({ product_id: productId2, variant_id: null, batch_number: 'BATCH_P003_202306', expiry_date: null, initial_quantity: 100, current_quantity: 100, cost_price_at_receipt: 12.50, currency_code_at_receipt: 'EUR', purchase_order_item_id: null });
  }
  if (productId3) { batchesToSeed.push({ product_id: productId3, variant_id: null, batch_number: 'BATCH_BOOK001_202301', expiry_date: null, initial_quantity: 250, current_quantity: 250, cost_price_at_receipt: 5.50, currency_code_at_receipt: 'USD', base_currency_cost_price_at_receipt: 5.50, exchange_rate_used: 1.0, purchase_order_item_id: null }); }
  if (productIdGatsby) {
    console.log(`[SeedDB] Preparing batch for 'The Great Gatsby - Paperback' (ID: ${productIdGatsby}) with SKU ${productSkuGatsby}`);
    const gatsbyBatch = { product_id: productIdGatsby, variant_id: null, batch_number: 'BATCH_GATSBY001_202302', expiry_date: null, initial_quantity: 50, current_quantity: 50, cost_price_at_receipt: 3.50, currency_code_at_receipt: 'USD', base_currency_cost_price_at_receipt: 3.50, exchange_rate_used: 1.0, purchase_order_item_id: null };
    batchesToSeed.push(gatsbyBatch); console.log('[SeedDB] Gatsby batch data to be seeded:', gatsbyBatch);
  } else { console.warn(`[SeedDB] productIdGatsby for SKU ${productSkuGatsby} was not found. Cannot seed its batch.`); }
  if (batchesToSeed.length === 0) { console.log('No suitable products/variants found or defined for inventory batch seeding.'); return; }
  try {
    for (const batch of batchesToSeed) {
      await client.query( `INSERT INTO inventory_batches (product_id, variant_id, batch_number, expiry_date, initial_quantity, current_quantity, cost_price_at_receipt, currency_code_at_receipt, base_currency_cost_price_at_receipt, exchange_rate_used, purchase_order_item_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (product_id, variant_id, batch_number) DO NOTHING;`, [ batch.product_id, batch.variant_id, batch.batch_number, batch.expiry_date, batch.initial_quantity, batch.current_quantity, batch.cost_price_at_receipt, batch.currency_code_at_receipt, batch.base_currency_cost_price_at_receipt, batch.exchange_rate_used, batch.purchase_order_item_id ] );
    }
    console.log(`${batchesToSeed.length} inventory batch(es) seeded or already existed.`);
  } catch (error) { console.error('Error seeding inventory batches:', error); }
}

[end of backend/seed.js]
