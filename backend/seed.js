// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');
const config = require('./config'); // Added for currencyCode access
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

// --- START OF HELPER FUNCTION DEFINITIONS ---

async function applySchemaMigrations(client) {
  console.log('Applying schema migrations for sales functionality...');
  try {
    await client.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2) NULL,
      ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10, 2) NULL,
      ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sale_percentage DECIMAL(5, 2) NULL;
    `);
    console.log('Sales columns (including percentage) ensured on products table.');
  } catch (e) {
    // Catching all errors here as IF NOT EXISTS might not be universally supported for all parts of ADD COLUMN or specific PG versions.
    // A more robust migration system would handle this better.
    console.error('Error altering products table (or columns already exist):', e.message);
  }

  try {
    await client.query(`
      ALTER TABLE product_variants
      ADD COLUMN IF NOT EXISTS original_price DECIMAL(10, 2) NULL,
      ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10, 2) NULL,
      ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sale_percentage DECIMAL(5, 2) NULL;
    `);
    console.log('Sales columns (including percentage) ensured on product_variants table.');
  } catch (e) {
    console.error('Error altering product_variants table (or columns already exist):', e.message);
  }

  // Add missing columns to order_items table
  try {
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_at_purchase VARCHAR(255);');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku_at_purchase VARCHAR(100);');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_class_id_at_purchase INTEGER REFERENCES tax_classes(id) ON DELETE SET NULL;');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_item_tax_amount DECIMAL(10, 2) DEFAULT 0.00;');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;');
    console.log('✅ Added missing columns to order_items table');
  } catch (error) {
    console.log('Migration error for order_items (may be benign):', error.message);
  }

  console.log('Schema migrations for sales functionality applied (or skipped if existing).');
}


async function createSchema(client) {
  console.log('Starting schema creation...');
  try {
    // RBAC Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Table "roles" checked/created.');
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, description TEXT, group_name VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Table "permissions" checked/created.');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );`);
    console.log('Table "role_permissions" checked/created.');

    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' NOT NULL, role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
        is_tax_exempt BOOLEAN DEFAULT FALSE NOT NULL, tax_exemption_certificate_id VARCHAR(100) NULL, tax_exemption_notes TEXT NULL,
        email_verification_token VARCHAR(255) NULL, email_verification_token_expires_at TIMESTAMPTZ NULL,
        is_email_verified BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Table "users" checked/created.');
    // Ensure all columns exist (idempotent)
    const userColumns = ['name VARCHAR(255)', 'email VARCHAR(255) UNIQUE NOT NULL', 'password VARCHAR(255) NOT NULL',
                         'role VARCHAR(50) DEFAULT \'user\' NOT NULL', 'role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL',
                         'is_tax_exempt BOOLEAN DEFAULT FALSE NOT NULL', 'tax_exemption_certificate_id VARCHAR(100) NULL',
                         'tax_exemption_notes TEXT NULL', 'email_verification_token VARCHAR(255) NULL',
                         'email_verification_token_expires_at TIMESTAMPTZ NULL', 'is_email_verified BOOLEAN NOT NULL DEFAULT FALSE',
                         'created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP'];
    for (const colDef of userColumns) { await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${colDef.split(' ')[0]} ${colDef.substring(colDef.indexOf(' ') + 1)};`).catch(e => console.log(`Note: Error adding column ${colDef.split(' ')[0]} to users, likely already exists or minor issue: ${e.message}`)); }
    console.log('All columns for "users" table ensured/checked.');

    // Suppliers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, contact_person VARCHAR(255), email VARCHAR(255) UNIQUE,
        phone VARCHAR(50), address_line1 TEXT, address_line2 TEXT, city VARCHAR(100), postal_code VARCHAR(20),
        country VARCHAR(100), notes TEXT, currency_code VARCHAR(3), created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Table "suppliers" checked/created.');

    // Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, description TEXT,
        slug VARCHAR(255) UNIQUE, -- Added slug column
        image_url VARCHAR(255), -- Added image_url column for category images
        show_in_menu BOOLEAN DEFAULT FALSE, -- Added flag to control menu bar visibility
        menu_order INTEGER DEFAULT 0, -- Added order for menu bar display
        parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;`); // Ensure slug column if table already exists
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);`); // Ensure image_url column if table already exists
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN DEFAULT FALSE;`); // Ensure show_in_menu column if table already exists
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS menu_order INTEGER DEFAULT 0;`); // Ensure menu_order column if table already exists
    console.log('Table "categories" checked/created and slug/image_url columns ensured.');

    // Hero Banners Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hero_banners (
        id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, subtitle TEXT, button_text VARCHAR(100),
        button_link VARCHAR(255), image_url VARCHAR(255) NOT NULL, alt_text VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE NOT NULL, sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Table "hero_banners" checked/created.');
    const heroBannerColumns = ['title VARCHAR(255) NOT NULL', 'subtitle TEXT', 'button_text VARCHAR(100)',
                               'button_link VARCHAR(255)', 'image_url VARCHAR(255) NOT NULL', 'alt_text VARCHAR(255)',
                               'is_active BOOLEAN DEFAULT TRUE NOT NULL', 'sort_order INTEGER DEFAULT 0 NOT NULL',
                               'created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP'];
    for (const colDef of heroBannerColumns) { await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS ${colDef.split(' ')[0]} ${colDef.substring(colDef.indexOf(' ') + 1)};`).catch(e => console.log(`Note: Error adding column ${colDef.split(' ')[0]} to hero_banners: ${e.message}`)); }
    console.log('All columns for "hero_banners" table ensured/checked.');

    // Tax Classes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_classes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "tax_classes" checked/created.');

    // Tax Rates Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_rates (
          id SERIAL PRIMARY KEY,
          tax_class_id INTEGER NOT NULL REFERENCES tax_classes(id) ON DELETE CASCADE,
          country VARCHAR(2) NOT NULL,
          state_province VARCHAR(100),
          postal_code VARCHAR(20),
          rate DECIMAL(10, 4) NOT NULL,
          name VARCHAR(255) NOT NULL,
          is_compound BOOLEAN DEFAULT FALSE NOT NULL,
          priority INTEGER DEFAULT 0 NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (tax_class_id, country, state_province, postal_code, name)
      );
    `);
    console.log('Table "tax_rates" checked/created.');

    // Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sku VARCHAR(100) UNIQUE NOT NULL, description TEXT,
        price DECIMAL(10, 2) NOT NULL, cost_price DECIMAL(10, 2), stock_quantity INTEGER DEFAULT 0,
        category_id INTEGER REFERENCES categories(id), supplier_id INTEGER REFERENCES suppliers(id),
        weight_kg DECIMAL(10, 3), length_cm DECIMAL(10, 2), width_cm DECIMAL(10, 2), height_cm DECIMAL(10, 2),
        is_active BOOLEAN DEFAULT TRUE, is_featured BOOLEAN DEFAULT FALSE, image_url VARCHAR(255),
        tags TEXT[], average_rating DECIMAL(3, 2) DEFAULT 0.00, review_count INTEGER DEFAULT 0,
        tax_class_id INTEGER REFERENCES tax_classes(id), has_variants BOOLEAN DEFAULT FALSE NOT NULL,
        reorder_threshold INTEGER DEFAULT 0,
        product_status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "products" checked/created.');
     await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_class_id INTEGER REFERENCES tax_classes(id);`);
     await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT FALSE NOT NULL;`);
     await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER DEFAULT 0;`);
     await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_status VARCHAR(50) DEFAULT 'active';`);
     console.log('DEBUG: Ensured all expected columns on products table (including product_status, reorder_threshold).');

    const productsSchemaLog = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'products' AND table_schema = 'public'
        ORDER BY ordinal_position;
    `);
    console.log('DEBUG: Schema of products table immediately after creation/alteration by seed script:');
    console.table(productsSchemaLog.rows);

    // Product Options (Global)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_options (
        id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_options" checked/created.');

    // Product Option Values (Global)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_option_values (
        id SERIAL PRIMARY KEY, product_option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        value VARCHAR(255) NOT NULL, display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_option_id, value)
      );
    `);
    console.log('Table "product_option_values" checked/created.');

    // Product Assigned Options
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_options (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, option_id)
      );
    `);
    console.log('Table "product_assigned_options" checked/created.');

    // Product Assigned Option Specific Values
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_option_specific_values (
        id SERIAL PRIMARY KEY,
        product_assigned_option_id INTEGER NOT NULL REFERENCES product_assigned_options(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_assigned_option_id, product_option_value_id)
      );
    `);
    console.log('Table "product_assigned_option_specific_values" checked/created.');

    // Product Variants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku VARCHAR(100) UNIQUE NOT NULL,
        price_modifier DECIMAL(10, 2),
        stock_quantity INTEGER DEFAULT 0,
        cost_price DECIMAL(10, 2) DEFAULT 0.00,
        wholesale_price_modifier DECIMAL(10, 2) DEFAULT NULL,
        image_url VARCHAR(255),
        weight_override_kg DECIMAL(10,3),
        length_override_cm DECIMAL(10,2),
        width_override_cm DECIMAL(10,2),
        height_override_cm DECIMAL(10,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_variants" checked/created.');

    // Product Variant Option Values
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variant_option_values (
        variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        PRIMARY KEY (variant_id, product_option_value_id)
      );
    `);
    console.log('Table "product_variant_option_values" checked/created.');

    // Product Images Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        image_url VARCHAR(255) NOT NULL,
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT FALSE,
        display_order INTEGER DEFAULT 0,
        s3_key TEXT,
        s3_bucket VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_images" checked/created.');

    // Product Reviews Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), title VARCHAR(255),
        comment TEXT, is_approved BOOLEAN DEFAULT FALSE, status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_reviews" checked/created.');
    
    // Ensure status column exists (in case table was created without it)
    try {
      await client.query('ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT \'pending\' CHECK (status IN (\'pending\', \'approved\', \'rejected\'));');
      console.log('Column "status" ensured in product_reviews.');
    } catch (error) {
      console.log('Column "status" already exists or error (benign):', error.message);
    }

    // Discounts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        valid_from TIMESTAMPTZ NULL,
        valid_until TIMESTAMPTZ NULL,
        usage_limit INTEGER NULL,
        times_used INTEGER NOT NULL DEFAULT 0,
        min_order_amount DECIMAL(10, 2) NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "discounts" checked/created.');

    // Orders Table
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
        total_tax_amount DECIMAL(10, 2) DEFAULT 0.00,
        tax_summary_details JSONB NULL,
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(100) NULL,
        shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
        fulfillment_validation_code VARCHAR(50) NULL,
        fulfillment_validated_at TIMESTAMPTZ NULL,
        fulfillment_validated_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "orders" checked/created.');

    // Fulfillment Validation Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fulfillment_validation_logs (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        validation_code VARCHAR(50) NOT NULL,
        validated_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        validation_method VARCHAR(50) NOT NULL DEFAULT 'qr_scan',
        validation_status VARCHAR(50) NOT NULL DEFAULT 'success',
        validation_notes TEXT NULL,
        scanned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "fulfillment_validation_logs" checked/created.');

    // Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        product_variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price_at_purchase DECIMAL(10, 2) NOT NULL,
        product_name_at_purchase VARCHAR(255) NULL,
        product_sku_at_purchase VARCHAR(100) NULL,
        tax_class_id_at_purchase INTEGER NULL REFERENCES tax_classes(id) ON DELETE SET NULL,
        line_item_tax_amount DECIMAL(10, 2) DEFAULT 0.00,
        applied_tax_rate_percentage DECIMAL(5, 2) NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "order_items" checked/created.');

    // Purchase Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        order_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_delivery_date DATE NULL,
        notes TEXT NULL,
        created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "purchase_orders" checked/created.');

    // Purchase Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        product_variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE SET NULL,
        quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
        unit_cost_price DECIMAL(10, 2) NOT NULL,
        quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity_ordered)
      );
    `);
    console.log('Table "purchase_order_items" checked/created.');

    // Product Variant Option Values Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variant_option_values (
        id SERIAL PRIMARY KEY,
        product_variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        CONSTRAINT uk_variant_option_value_combo UNIQUE (product_variant_id, product_option_value_id)
      );
    `);
    console.log('Table "product_variant_option_values" checked/created.');
    
    // Ensure product_variant_id column exists (in case table was created without it)
    try {
      // First add the column as nullable
      await client.query('ALTER TABLE product_variant_option_values ADD COLUMN IF NOT EXISTS product_variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE CASCADE;');
      console.log('Column "product_variant_id" added as nullable to product_variant_option_values.');
      
      // Check if there are any rows with NULL product_variant_id
      const nullCheck = await client.query('SELECT COUNT(*) FROM product_variant_option_values WHERE product_variant_id IS NULL;');
      if (nullCheck.rows[0].count > 0) {
        console.log(`Found ${nullCheck.rows[0].count} rows with NULL product_variant_id. These will remain nullable.`);
      } else {
        // If no NULL values, we can make it NOT NULL
        await client.query('ALTER TABLE product_variant_option_values ALTER COLUMN product_variant_id SET NOT NULL;');
        console.log('Column "product_variant_id" made NOT NULL in product_variant_option_values.');
      }
    } catch (error) {
      console.log('Column "product_variant_id" already exists or error (benign):', error.message);
    }

    // Inventory Batches Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE NOT NULL, -- product_id should not be null
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE, -- Can be null for base product batches
        batch_number VARCHAR(100), -- Added batch_number
        sku VARCHAR(100) NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE SET NULL, -- For linking to POs
        quantity_received INTEGER NOT NULL DEFAULT 0,
        quantity_remaining INTEGER NOT NULL DEFAULT 0,
        cost_price_at_receipt DECIMAL(12, 2), -- Renamed & adjusted precision
        currency_code_at_receipt VARCHAR(3), -- Added
        received_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Renamed
        expiry_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_batch_number_per_item UNIQUE (product_id, variant_id, batch_number) -- Added constraint
        -- Removed chk_product_or_variant as product_id is NOT NULL, variant_id is optional.
      );
    `);
    console.log('Table "inventory_batches" checked/created.');




    // Stock Movement Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_movement_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        inventory_batch_id INTEGER REFERENCES inventory_batches(id),
        movement_type VARCHAR(50) NOT NULL,
        quantity_changed INTEGER NOT NULL,
        reason TEXT,
        reference_id VARCHAR(255),
        created_by_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_sm_product_or_variant CHECK ( (product_id IS NOT NULL AND variant_id IS NULL) OR (product_id IS NULL AND variant_id IS NOT NULL) OR (product_id IS NOT NULL AND variant_id IS NOT NULL) )
      );
    `);
    console.log('Table "stock_movement_logs" checked/created.');

    // Product Cost History Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_cost_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
        cost_price DECIMAL(10, 2) NOT NULL,
        start_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_pch_product_or_variant CHECK ( (product_id IS NOT NULL AND variant_id IS NULL) OR (product_id IS NULL AND variant_id IS NOT NULL) OR (product_id IS NOT NULL AND variant_id IS NOT NULL) )
      );
    `);
    console.log('Table "product_cost_history" checked/created.');

    // Shipping Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS couriers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        contact_info TEXT
      );
    `);
    console.log('Table "couriers" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS shipping_methods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL,
        description TEXT
      );
    `);
    console.log('Table "shipping_methods" checked/created.');

    // Trigger function for updated_at timestamps
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Function "trigger_set_timestamp" checked/created.');

    const tablesWithTimestampTrigger = ['users', 'roles', 'permissions', 'suppliers', 'categories', 'hero_banners', 'products', 'product_options', 'product_option_values', 'product_variants', 'product_images', 'product_reviews', 'discounts', 'orders', 'fulfillment_validation_logs', 'purchase_orders', 'tax_classes', 'tax_rates', 'inventory_batches', 'product_assigned_options', 'product_assigned_option_specific_values', 'product_cost_history', 'couriers', 'shipping_methods'];
    for (const tableName of tablesWithTimestampTrigger) {
      await client.query(`
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_${tableName}_updated_at' AND tgrelid = '${tableName}'::regclass) THEN
        CREATE TRIGGER trigger_update_${tableName}_updated_at BEFORE UPDATE ON ${tableName} FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp(); END IF; END $$;
      `);
      console.log(`Trigger for "${tableName}.updated_at" ensured.`);
    }

    // Site Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        setting_type VARCHAR(20) NOT NULL DEFAULT 'string' CHECK (setting_type IN ('string', 'boolean', 'number', 'json')),
        setting_description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "site_settings" checked/created.');

    // Add trigger for site_settings updated_at
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_site_settings') THEN
          CREATE TRIGGER set_timestamp_site_settings
          BEFORE UPDATE ON site_settings
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "site_settings.updated_at" ensured.');

    // Email Campaigns Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'paused')),
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        total_sent INTEGER DEFAULT 0,
        total_opens INTEGER DEFAULT 0,
        total_clicks INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "email_campaigns" checked/created.');

    // Add trigger for email_campaigns updated_at
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_email_campaigns') THEN
          CREATE TRIGGER set_timestamp_email_campaigns
          BEFORE UPDATE ON email_campaigns
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "email_campaigns.updated_at" ensured.');

    // Email Unsubscribes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_unsubscribes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
        email_type VARCHAR(100) NOT NULL,
        reason TEXT,
        unsubscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "email_unsubscribes" checked/created.');

    // Add trigger for email_unsubscribes updated_at
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_email_unsubscribes') THEN
          CREATE TRIGGER set_timestamp_email_unsubscribes
          BEFORE UPDATE ON email_unsubscribes
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "email_unsubscribes.updated_at" ensured.');

    console.log('Schema creation process completed.');
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  }
}

async function seedHeroBanners(client, seededDataIds) {
  console.log('Seeding hero banners...');
  seededDataIds.heroBanners = seededDataIds.heroBanners || {};
  const bannersToSeed = [
    { title: 'Summer Collection Arrived!', subtitle: 'Discover the latest trends for the sunny season.', button_text: 'Explore Summer', button_link: '/collections/summer', image_url: 'https://picsum.photos/1200/600?random=1', alt_text: 'Bright summer fashion display', is_active: true, sort_order: 1 },
    { title: 'Flash Sale: 24 Hours Only!', subtitle: 'Get 30% off on all accessories. Use code FLASH30.', button_text: 'Shop Accessories', button_link: '/categories/accessories?promo=flash30', image_url: 'https://picsum.photos/1200/600?random=2', alt_text: 'Exciting flash sale announcement', is_active: true, sort_order: 0 },
    { title: 'New Arrivals: Electronics (Inactive)', subtitle: 'Check out the latest gadgets and tech.', button_text: 'View New Tech', button_link: '/categories/electronics?filter=new', image_url: 'https://picsum.photos/1200/600?random=3', alt_text: 'Sleek display of new electronic gadgets', is_active: false, sort_order: 2 },
    { title: 'Winter Clearance (Active High Prio)', subtitle: 'Up to 70% off last season winter wear.', button_text: 'Shop Clearance', button_link: '/sale/winter-clearance', image_url: 'https://picsum.photos/1200/600?random=4', alt_text: 'Winter clothes on sale', is_active: true, sort_order: 0 }
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

async function seedTaxConfiguration(client, seededDataIds) {
  console.log('Seeding tax configuration...');
  seededDataIds.taxClasses = seededDataIds.taxClasses || {};
  seededDataIds.taxRates = seededDataIds.taxRates || {};

  try {
    const taxClasses = [
      { name: 'Standard Goods', description: 'Standard taxable goods' },
      { name: 'Reduced Rate Goods', description: 'Goods with a reduced tax rate' },
      { name: 'Tax Exempt', description: 'Goods exempt from tax' },
    ];
    for (const tc of taxClasses) {
      const res = await client.query(
        'INSERT INTO tax_classes (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id, name',
        [tc.name, tc.description]
      );
      if (res.rows.length > 0) {
        seededDataIds.taxClasses[res.rows[0].name.replace(/\s+/g, '_').toLowerCase()] = res.rows[0].id;
        console.log(`Tax Class "${res.rows[0].name}" seeded/updated with ID ${res.rows[0].id}.`);
      }
    }

    if (seededDataIds.taxClasses.standard_goods) {
      const taxRates = [
        { tax_class_id: seededDataIds.taxClasses.standard_goods, country: 'US', state_province: 'CA', postal_code: null, rate: 0.0825, name: 'CA State Sales Tax', is_compound: false, priority: 1 },
        { tax_class_id: seededDataIds.taxClasses.standard_goods, country: 'GB', state_province: null, postal_code: null, rate: 0.20, name: 'UK VAT', is_compound: false, priority: 1 },
      ];
      for (const tr of taxRates) {
        const res = await client.query(
          `INSERT INTO tax_rates (tax_class_id, country, state_province, postal_code, rate, name, is_compound, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tax_class_id, country, state_province, postal_code, name) DO UPDATE SET
             rate = EXCLUDED.rate, is_compound = EXCLUDED.is_compound, priority = EXCLUDED.priority
           RETURNING id, name;`,
          [tr.tax_class_id, tr.country, tr.state_province, tr.postal_code, tr.rate, tr.name, tr.is_compound, tr.priority]
        );
        if (res.rows.length > 0) {
          console.log(`Tax Rate "${res.rows[0].name}" seeded/updated with ID ${res.rows[0].id}.`);
        }
      }
    }
    console.log('Tax configuration seeding completed.');
  } catch (error) {
    console.error('Error seeding tax configuration:', error);
    throw error;
  }
}

async function updateProductAverageRating(productId, client) {
    console.log(`Updating average rating for product ID ${productId}...`);
    try {
        const avgRatingRes = await client.query(
            `SELECT AVG(rating) as average_rating, COUNT(id) as review_count
             FROM product_reviews
             WHERE product_id = $1 AND is_approved = TRUE;`,
            [productId]
        );
        const averageRating = avgRatingRes.rows[0]?.average_rating || 0;
        const reviewCount = avgRatingRes.rows[0]?.review_count || 0;

        await client.query(
            `UPDATE products SET average_rating = $1, review_count = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3;`,
            [parseFloat(averageRating).toFixed(2), parseInt(reviewCount), productId]
        );
        console.log(`Product ID ${productId} updated: Avg Rating ${averageRating}, Review Count ${reviewCount}`);
    } catch (error) {
        console.error(`Error updating average rating for product ID ${productId}:`, error);
    }
}


async function seedAdminUser(client, seededUserIds) {
  console.log('Seeding admin user...');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  try {
    const result = await client.query(
      `INSERT INTO users (name, email, password, role, is_email_verified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role, is_email_verified = EXCLUDED.is_email_verified, updated_at = CURRENT_TIMESTAMP
       RETURNING id, email;`,
      ['Admin User', adminEmail, hashedPassword, 'admin', true]
    );
    if (result.rows.length > 0) {
      seededUserIds.adminUserId = result.rows[0].id;
      seededUserIds[adminEmail] = result.rows[0].id;
      console.log(`Admin user "${result.rows[0].email}" seeded/updated with ID ${result.rows[0].id}.`);
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
    throw error;
  }
}

async function seedRegularUsers(client, seededUserIds) {
  console.log('Seeding regular users...');
  const usersToSeed = [
    { name: 'John Doe', email: 'john.doe@example.com', password: 'password123', role: 'customer' },
    { name: 'Jane Smith', email: 'jane.smith@example.com', password: 'password123', role: 'customer' },
    { name: 'Mike Johnson', email: 'mike.johnson@example.com', password: 'password123', role: 'customer' },
    { name: 'Sarah Wilson', email: 'sarah.wilson@example.com', password: 'password123', role: 'customer' },
    { name: 'David Brown', email: 'david.brown@example.com', password: 'password123', role: 'customer' },
    { name: 'Emily Davis', email: 'emily.davis@example.com', password: 'password123', role: 'customer' },
    { name: 'Robert Miller', email: 'robert.miller@example.com', password: 'password123', role: 'customer' },
    { name: 'Lisa Garcia', email: 'lisa.garcia@example.com', password: 'password123', role: 'customer' },
    { name: 'James Rodriguez', email: 'james.rodriguez@example.com', password: 'password123', role: 'customer' },
    { name: 'Maria Martinez', email: 'maria.martinez@example.com', password: 'password123', role: 'customer' },
    { name: 'Christopher Lee', email: 'christopher.lee@example.com', password: 'password123', role: 'customer' },
    { name: 'Amanda Taylor', email: 'amanda.taylor@example.com', password: 'password123', role: 'customer' },
    { name: 'Daniel Anderson', email: 'daniel.anderson@example.com', password: 'password123', role: 'customer' },
    { name: 'Jessica Thomas', email: 'jessica.thomas@example.com', password: 'password123', role: 'customer' },
    { name: 'Matthew Jackson', email: 'matthew.jackson@example.com', password: 'password123', role: 'customer' },
  ];
  try {
    for (const user of usersToSeed) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const result = await client.query(
        `INSERT INTO users (name, email, password, role, is_email_verified)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role, is_email_verified = EXCLUDED.is_email_verified, updated_at = CURRENT_TIMESTAMP
         RETURNING id, email;`,
        [user.name, user.email, hashedPassword, user.role, true]
      );
      if (result.rows.length > 0) {
        seededUserIds[user.email] = result.rows[0].id;
        console.log(`User "${result.rows[0].email}" seeded/updated with ID ${result.rows[0].id}.`);
      }
    }
    console.log('Regular users seeding completed.');
  } catch (error) {
    console.error('Error seeding regular users:', error);
    throw error;
  }
}

async function seedSpecificGlobalOptionsAndValues(client, seededDataIds) {
  console.log('Seeding specific global options (Color, Size) and their values...');
  seededDataIds.options = seededDataIds.options || {};
  seededDataIds.optionValues = seededDataIds.optionValues || {};

  try {
    const colorOptionRes = await client.query(
      "INSERT INTO product_options (name, display_order) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order RETURNING id, name",
      ['Color', 1]
    );
    if (colorOptionRes.rows.length > 0) {
      seededDataIds.options.colorOptionId = colorOptionRes.rows[0].id;
      console.log(`Seeded/Ensured option: ${colorOptionRes.rows[0].name} with ID: ${seededDataIds.options.colorOptionId}`);

      const colorValues = ['Red', 'Green', 'Blue', 'Black', 'White', 'Yellow', 'Orange', 'Pink', 'Purple', 'Brown', 'Gray', 'Aqua'];
      seededDataIds.optionValues.color = {};
      for (let i = 0; i < colorValues.length; i++) {
        const valRes = await client.query(
          "INSERT INTO product_option_values (product_option_id, value, display_order) VALUES ($1, $2, $3) ON CONFLICT (product_option_id, value) DO UPDATE SET display_order = EXCLUDED.display_order RETURNING id, value",
          [seededDataIds.options.colorOptionId, colorValues[i], i]
        );
        if (valRes.rows.length > 0) {
          seededDataIds.optionValues.color[valRes.rows[0].value] = valRes.rows[0].id;
        }
      }
      console.log(`Seeded values for Color option.`);
    }

    const sizeOptionRes = await client.query(
      "INSERT INTO product_options (name, display_order) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order RETURNING id, name",
      ['Size', 2]
    );
    if (sizeOptionRes.rows.length > 0) {
      seededDataIds.options.sizeOptionId = sizeOptionRes.rows[0].id;
      console.log(`Seeded/Ensured option: ${sizeOptionRes.rows[0].name} with ID: ${seededDataIds.options.sizeOptionId}`);

      const sizeValues = ['XS', 'Small', 'Medium', 'Large', 'XL', 'XXL'];
      seededDataIds.optionValues.size = {};
      for (let i = 0; i < sizeValues.length; i++) {
        const valRes = await client.query(
          "INSERT INTO product_option_values (product_option_id, value, display_order) VALUES ($1, $2, $3) ON CONFLICT (product_option_id, value) DO UPDATE SET display_order = EXCLUDED.display_order RETURNING id, value",
          [seededDataIds.options.sizeOptionId, sizeValues[i], i]
        );
         if (valRes.rows.length > 0) {
          seededDataIds.optionValues.size[valRes.rows[0].value] = valRes.rows[0].id;
        }
      }
      console.log(`Seeded values for Size option.`);
    }
    console.log('Finished seeding specific global options and their values.');
  } catch (error) {
    console.error('Error seeding global options and values:', error);
    throw error;
  }
}

async function seedSuppliers(client, seededDataIds) {
  console.log('Seeding suppliers...');
  seededDataIds.suppliers = seededDataIds.suppliers || {};
  const suppliersToSeed = [
    { name: 'TechGadget Inc.', contact_person: 'Alice Wonderland', email: 'alice@techgadget.com', phone: '555-0101', country: 'USA' },
    { name: 'FashionFabrics Co.', contact_person: 'Bob The Builder', email: 'bob@fashionfabrics.co', phone: '555-0202', country: 'UK' },
  ];
  try {
    for (const sup of suppliersToSeed) {
      const result = await client.query(
        `INSERT INTO suppliers (name, contact_person, email, phone, country) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET contact_person=EXCLUDED.contact_person, email=EXCLUDED.email, phone=EXCLUDED.phone, country=EXCLUDED.country
         RETURNING id, name;`,
        [sup.name, sup.contact_person, sup.email, sup.phone, sup.country]
      );
      if (result.rows.length > 0) {
        seededDataIds.suppliers[result.rows[0].name] = result.rows[0].id;
        console.log(`Supplier "${result.rows[0].name}" seeded/updated with ID ${result.rows[0].id}.`);
      }
    }
    console.log('Suppliers seeding completed.');
  } catch (error) {
    console.error('Error seeding suppliers:', error);
    throw error;
  }
}

async function seedCategories(client, seededDataIds) {
  console.log('Seeding categories...');
  seededDataIds.categories = seededDataIds.categories || {};

  const slugify = (text) => text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w-]+/g, '')       // Remove all non-word chars
    .replace(/--+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text

  const categoriesToSeed = [
    { name: 'Electronics', description: 'Gadgets, devices, and accessories.', show_in_menu: true, menu_order: 1 },
    { name: 'Apparel', description: 'Clothing for men, women, and children.', show_in_menu: true, menu_order: 2 },
    { name: 'Books', description: 'Various genres of books.', show_in_menu: true, menu_order: 3 },
    { name: 'Home Goods', description: 'Items for home and kitchen.', show_in_menu: true, menu_order: 4 },
    // Adding categories from the console log provided by user
    { name: 'Accessories', description: 'Fashion accessories.', show_in_menu: true, menu_order: 5},
    { name: 'Beauty', description: 'Beauty and personal care products.', show_in_menu: true, menu_order: 6},
    { name: 'Digital Music', description: 'Digital music albums and tracks.', show_in_menu: false, menu_order: null},
    { name: 'Footwear', description: 'Shoes, boots, and sandals.', show_in_menu: true, menu_order: 7},
    { name: 'Sports & Outdoors', description: 'Equipment for sports and outdoor activities.', show_in_menu: true, menu_order: 8},
    { name: 'Toys & Games', description: 'Toys and games for all ages.', show_in_menu: true, menu_order: 9},

  ];
  try {
    for (const cat of categoriesToSeed) {
      const slug = slugify(cat.name);
      const result = await client.query(
        `INSERT INTO categories (name, slug, description, show_in_menu, menu_order) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET slug=EXCLUDED.slug, description=EXCLUDED.description, show_in_menu=EXCLUDED.show_in_menu, menu_order=EXCLUDED.menu_order
         RETURNING id, name, slug;`,
        [cat.name, slug, cat.description, cat.show_in_menu, cat.menu_order]
      );
      if (result.rows.length > 0) {
        seededDataIds.categories[result.rows[0].name] = {id: result.rows[0].id, slug: result.rows[0].slug};
        console.log(`Category "${result.rows[0].name}" (slug: ${result.rows[0].slug}) seeded/updated with ID ${result.rows[0].id}.`);
      }
    }
    // Example of sub-category
    const electronicsData = seededDataIds.categories['Electronics'];
    if (electronicsData && electronicsData.id) {
        const subCatName = 'Headphones';
        const subCatSlug = slugify(subCatName);
        const subCatRes = await client.query(
            `INSERT INTO categories (name, slug, description, parent_category_id, show_in_menu, menu_order) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (name) DO UPDATE SET slug=EXCLUDED.slug, description=EXCLUDED.description, parent_category_id=EXCLUDED.parent_category_id, show_in_menu=EXCLUDED.show_in_menu, menu_order=EXCLUDED.menu_order
             RETURNING id, name, slug;`,
            [subCatName, subCatSlug, 'Audio listening devices', electronicsData.id, false, null]
        );
        if (subCatRes.rows.length > 0) {
            seededDataIds.categories[subCatRes.rows[0].name] = {id: subCatRes.rows[0].id, slug: subCatRes.rows[0].slug};
            console.log(`Sub-Category "${subCatRes.rows[0].name}" (slug: ${subCatRes.rows[0].slug}) seeded/updated with ID ${subCatRes.rows[0].id}.`);
        }
    }
    console.log('Categories seeding completed.');
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error;
  }
}

async function seedProducts(client, seededDataIds) {
  console.log('Seeding products...');
  seededDataIds.products = seededDataIds.products || {};

  const productsToSeed = [
    {
      name: 'Wireless Bluetooth Headphones', sku: 'HDPHN-WL-BT-001', description: 'High-fidelity wireless headphones with noise cancellation and 20-hour battery life.',
      price: 149.99, cost_price: 75.00, stock_quantity: 10, // changed from 0 to 10
      category_id: seededDataIds.categories?.Headphones?.id, // Correctly access .id
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=10',
      has_variants: false, // Will be set to true later if options/variants are added
      reorder_threshold: 5,
      tags: ['wireless', 'bluetooth', 'noise-cancelling', 'audio', 'headphones'],
      is_featured: true
    },
    {
      name: 'Men\'s Cotton T-Shirt', sku: 'TSHRT-MEN-COT-005', description: 'Comfortable and durable 100% cotton t-shirt for everyday wear.',
      price: 25.99, cost_price: 10.00, stock_quantity: 10, // changed from 0 to 10
      category_id: seededDataIds.categories?.Apparel?.id, // Correctly access .id
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=11',
      has_variants: false, // Will be set to true later if options/variants are added
      reorder_threshold: 10,
      tags: ['cotton', 't-shirt', 'men', 'casual', 'comfortable']
    },
    {
      name: 'Simple LED Desk Lamp', sku: 'LAMP-DSK-LED-010', description: 'Modern LED desk lamp with adjustable brightness.',
      price: 39.99, cost_price: 15.00, stock_quantity: 10, // changed from 50 to 10 for consistency
      category_id: seededDataIds.categories?.['Home Goods']?.id, // Correctly access .id
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=12',
      has_variants: false,
      reorder_threshold: 5
    },
    {
      name: 'Premium Wireless Earbuds', sku: 'EARBUDS-WL-PREM-001', description: 'High-quality wireless earbuds with noise cancellation.',
      price: 199.99, cost_price: 80.00, stock_quantity: 10, // changed from 25 to 10 for consistency
      category_id: seededDataIds.categories?.Electronics?.id,
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=13',
      has_variants: false,
      reorder_threshold: 8
    },
    {
      name: 'Women\'s Running Shoes', sku: 'SHOES-WOM-RUN-001', description: 'Comfortable running shoes with excellent cushioning.',
      price: 89.99, cost_price: 35.00, stock_quantity: 40,
      category_id: seededDataIds.categories?.Footwear?.id,
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=14',
      has_variants: false,
      reorder_threshold: 12
    },
    {
      name: 'Smart Fitness Watch', sku: 'WATCH-SMART-FIT-001', description: 'Advanced fitness tracking watch with heart rate monitor.',
      price: 299.99, cost_price: 120.00, stock_quantity: 15,
      category_id: seededDataIds.categories?.Electronics?.id,
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=15',
      has_variants: false,
      reorder_threshold: 5,
      is_featured: true
    },
    {
      name: 'Organic Cotton Hoodie', sku: 'HOODIE-ORG-COT-001', description: 'Comfortable organic cotton hoodie for everyday wear.',
      price: 59.99, cost_price: 22.00, stock_quantity: 30,
      category_id: seededDataIds.categories?.Apparel?.id,
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=16',
      has_variants: false,
      reorder_threshold: 8
    },
    {
      name: 'Portable Bluetooth Speaker', sku: 'SPEAKER-BT-PORT-001', description: 'Waterproof portable speaker with 20-hour battery life.',
      price: 79.99, cost_price: 30.00, stock_quantity: 10, // changed from 35 to 10 for consistency
      category_id: seededDataIds.categories?.Electronics?.id,
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=17',
      has_variants: false,
      reorder_threshold: 10
    },
    {
      name: 'Yoga Mat Premium', sku: 'MAT-YOGA-PREM-001', description: 'Non-slip yoga mat with carrying strap.',
      price: 45.99, cost_price: 18.00, stock_quantity: 10, // changed from 50 to 10 for consistency
      category_id: seededDataIds.categories?.['Sports & Outdoors']?.id,
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=18',
      has_variants: false,
      reorder_threshold: 15
    },
    {
      name: 'Stainless Steel Water Bottle', sku: 'BOTTLE-SS-WATER-001', description: 'Insulated stainless steel water bottle, 32oz.',
      price: 34.99, cost_price: 12.00, stock_quantity: 10, // changed from 60 to 10 for consistency
      category_id: seededDataIds.categories?.['Sports & Outdoors']?.id,
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=19',
      has_variants: false,
      reorder_threshold: 20
    },
    {
      name: 'Natural Face Cream', sku: 'CREAM-FACE-NAT-001', description: 'Organic face cream with natural ingredients.',
      price: 24.99, cost_price: 8.00, stock_quantity: 10, // changed from 45 to 10 for consistency
      category_id: seededDataIds.categories?.Beauty?.id,
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=20',
      has_variants: false,
      reorder_threshold: 12
    },
    {
      name: 'Board Game Collection', sku: 'GAME-BOARD-COLL-001', description: 'Family board game collection with 5 popular games.',
      price: 69.99, cost_price: 25.00, stock_quantity: 10, // changed from 20 to 10 for consistency
      category_id: seededDataIds.categories?.['Toys & Games']?.id,
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://picsum.photos/300/300?random=21',
      has_variants: false,
      reorder_threshold: 8
    },
  ];

  try {
    for (const prod of productsToSeed) {
      const result = await client.query(
        `INSERT INTO products (name, sku, description, price, cost_price, stock_quantity, category_id, supplier_id, tax_class_id, image_url, is_active, has_variants, reorder_threshold, product_status, tags, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (sku) DO UPDATE SET
           name=EXCLUDED.name, description=EXCLUDED.description, price=EXCLUDED.price, cost_price=EXCLUDED.cost_price, stock_quantity=EXCLUDED.stock_quantity,
           category_id=EXCLUDED.category_id, supplier_id=EXCLUDED.supplier_id, tax_class_id=EXCLUDED.tax_class_id, image_url=EXCLUDED.image_url, is_active=EXCLUDED.is_active, has_variants=EXCLUDED.has_variants,
           reorder_threshold=EXCLUDED.reorder_threshold, product_status=EXCLUDED.product_status, tags=EXCLUDED.tags, is_featured=EXCLUDED.is_featured
         RETURNING id, sku;`,
        [prod.name, prod.sku, prod.description, prod.price, prod.cost_price, prod.stock_quantity, prod.category_id, prod.supplier_id, prod.tax_class_id, prod.image_url, prod.is_active, prod.has_variants, prod.reorder_threshold, prod.product_status, prod.tags || null, prod.is_featured || false]
      );
      if (result.rows.length > 0) {
        seededDataIds.products[result.rows[0].sku] = { id: result.rows[0].id, sku: result.rows[0].sku, image_url: prod.image_url, cost_price: prod.cost_price };
        console.log(`Product "${prod.name}" (SKU: ${result.rows[0].sku}) seeded/updated with ID ${result.rows[0].id}.`);
      }
    }
    console.log('Products seeding completed.');
  } catch (error) {
    console.error('Error seeding products:', error);
    throw error;
  }
}

async function seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure) {
  console.log('Seeding product option configurations...');
  if (!productSkusToConfigure || productSkusToConfigure.length === 0) {
    console.log('No product SKUs provided for option configuration. Skipping.');
    return;
  }
  if (!seededDataIds.options?.colorOptionId || !seededDataIds.options?.sizeOptionId) {
    console.error('Color or Size option IDs not found in seededDataIds.options. Cannot configure product options.');
    return;
  }
   if (!seededDataIds.optionValues?.color || !seededDataIds.optionValues?.size ||
       Object.keys(seededDataIds.optionValues.color).length === 0 || Object.keys(seededDataIds.optionValues.size).length === 0) {
    console.error('Color or Size option values not found or empty in seededDataIds.optionValues. Cannot configure product options.');
    return;
  }

  const colorOptionId = seededDataIds.options.colorOptionId;
  const sizeOptionId = seededDataIds.options.sizeOptionId;

  const colorValueIdsToAssign = [
      seededDataIds.optionValues.color['Red'],
      seededDataIds.optionValues.color['Blue'],
      seededDataIds.optionValues.color['Green']
  ].filter(id => id);

  const sizeValueIdsToAssign = [
      seededDataIds.optionValues.size['Small'],
      seededDataIds.optionValues.size['Medium'],
      seededDataIds.optionValues.size['Large']
  ].filter(id => id);

  if (colorValueIdsToAssign.length === 0 || sizeValueIdsToAssign.length === 0) {
      console.error("Not enough specific Color/Size values found to assign. Check seedSpecificGlobalOptionsAndValues.");
      return;
  }


  try {
    for (const sku of productSkusToConfigure) {
      const productInfo = seededDataIds.products[sku];
      if (!productInfo) {
        console.warn(`Product with SKU ${sku} not found in seededDataIds.products. Skipping option configuration.`);
        continue;
      }
      const productId = productInfo.id;
      let optionsAssignedToProduct = false;

      const assignedColorOptRes = await client.query(
        `INSERT INTO product_assigned_options (product_id, option_id) VALUES ($1, $2)
         ON CONFLICT (product_id, option_id) DO NOTHING RETURNING id;`,
        [productId, colorOptionId]
      );
      const assignedColorOptionQuery = await client.query('SELECT id FROM product_assigned_options WHERE product_id = $1 AND option_id = $2', [productId, colorOptionId]);
      const assignedColorOptionId = assignedColorOptionQuery.rows[0]?.id;

      if (assignedColorOptionId) {
        console.log(`Assigned/Ensured Color option to product ID ${productId} (AssignedOptionID: ${assignedColorOptionId})`);
        for (const colorValueId of colorValueIdsToAssign) {
          if(colorValueId) {
            await client.query(
              `INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
              [assignedColorOptionId, colorValueId]
            );
          }
        }
        console.log(`Configured specific color values for product ID ${productId}`);
        optionsAssignedToProduct = true;
      }

      if (sku === 'TSHRT-MEN-COT-005') {
        const assignedSizeOptRes = await client.query(
          `INSERT INTO product_assigned_options (product_id, option_id) VALUES ($1, $2)
           ON CONFLICT (product_id, option_id) DO NOTHING RETURNING id;`,
          [productId, sizeOptionId]
        );
        const assignedSizeOptionQuery = await client.query('SELECT id FROM product_assigned_options WHERE product_id = $1 AND option_id = $2', [productId, sizeOptionId]);
        const assignedSizeOptionId = assignedSizeOptionQuery.rows[0]?.id;

        if (assignedSizeOptionId) {
          console.log(`Assigned/Ensured Size option to product ID ${productId} (AssignedOptionID: ${assignedSizeOptionId})`);
          for (const sizeValueId of sizeValueIdsToAssign) {
            if(sizeValueId) {
              await client.query(
                `INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
                [assignedSizeOptionId, sizeValueId]
              );
            }
          }
          console.log(`Configured specific size values for product ID ${productId}`);
          optionsAssignedToProduct = true;
        }
      }

      if (optionsAssignedToProduct) {
        await client.query('UPDATE products SET has_variants = TRUE WHERE id = $1;', [productId]);
        console.log(`Set has_variants = TRUE for product ID ${productId}`);
      }
    }
    console.log('Product option configurations seeding completed.');
  } catch (error) {
    console.error('Error seeding product option configurations:', error);
    throw error;
  }
}

async function seedProductVariants(client, seededDataIds) {
  console.log('Seeding product variants...');
  seededDataIds.variants = seededDataIds.variants || {};

  try {
    const productsWithVariantsResult = await client.query('SELECT id, sku, name, cost_price FROM products WHERE has_variants = TRUE;');
    const productsToProcess = productsWithVariantsResult.rows;

    if (productsToProcess.length === 0) {
        console.log("No products marked with has_variants = TRUE. Skipping variant seeding.");
        return;
    }

    for (const product of productsToProcess) {
      const productId = product.id;
      const productSku = product.sku;
      const productCostPrice = product.cost_price || 0;
      console.log(`Processing variants for product: ${product.name} (ID: ${productId})`);

      const assignedOptionsRes = await client.query(
        `SELECT pao.option_id, po.name as option_name, paosv.product_option_value_id, pov.value as option_value
         FROM product_assigned_options pao
         JOIN product_options po ON pao.option_id = po.id
         JOIN product_assigned_option_specific_values paosv ON paosv.product_assigned_option_id = pao.id
         JOIN product_option_values pov ON paosv.product_option_value_id = pov.id
         WHERE pao.product_id = $1
         ORDER BY po.display_order, pov.display_order;`,
        [productId]
      );

      if (assignedOptionsRes.rows.length === 0) {
        console.log(`No assigned options with specific values found for product ID ${productId}. Cannot generate variants.`);
        continue;
      }

      const optionsMap = new Map();
      for (const row of assignedOptionsRes.rows) {
        if (!optionsMap.has(row.option_id)) {
          optionsMap.set(row.option_id, { name: row.option_name, values: [] });
        }
        optionsMap.get(row.option_id).values.push({ id: row.product_option_value_id, value: row.option_value });
      }

      const optionsArray = Array.from(optionsMap.values()).filter(opt => opt.values.length > 0);
      if (optionsArray.length === 0) {
          console.log(`Product ID ${productId} has assigned options but no specific values for them. Skipping variant generation.`);
          continue;
      }

      const generateCombinations = (options, index = 0, currentCombination = []) => {
        if (index === options.length) {
          return [currentCombination];
        }
        let allCombinations = [];
        if (!options[index] || !options[index].values || options[index].values.length === 0) {
            return generateCombinations(options, index + 1, currentCombination);
        }
        for (const valueObj of options[index].values) {
          allCombinations = allCombinations.concat(
            generateCombinations(options, index + 1, [...currentCombination, valueObj])
          );
        }
        return allCombinations;
      };

      const variantValueCombinations = generateCombinations(optionsArray);
      console.log(`Generated ${variantValueCombinations.length} variant combinations for product ID ${productId}.`);

      for (const combination of variantValueCombinations) {
        if (combination.length === 0) continue;

        const variantSkuSuffix = combination.map(v => v.value.substring(0, 3).toUpperCase()).join('-');
        const variantSku = `${productSku}-${variantSkuSuffix}`;
        const variantPriceModifier = null;
        const variantStock = 10;
        const variantCostPrice = productCostPrice; // Default variant cost to product cost
        const variantWholesalePriceModifier = null;


        const variantRes = await client.query(
          `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, cost_price, wholesale_price_modifier, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (sku) DO UPDATE SET
             price_modifier = EXCLUDED.price_modifier,
             stock_quantity = EXCLUDED.stock_quantity,
             cost_price = EXCLUDED.cost_price,
             wholesale_price_modifier = EXCLUDED.wholesale_price_modifier,
             is_active = EXCLUDED.is_active,
             product_id = EXCLUDED.product_id
           RETURNING id, sku;`,
          [productId, variantSku, variantPriceModifier, variantStock, variantCostPrice, variantWholesalePriceModifier, true]
        );
        const variantId = variantRes.rows[0].id;
        seededDataIds.variants[variantSku] = variantId;
        console.log(`  Created/Updated variant: SKU ${variantSku}, ID ${variantId}`);

        for (const optionValue of combination) {
          await client.query(
            `INSERT INTO product_variant_option_values (variant_id, product_option_value_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [variantId, optionValue.id]
          );
        }

        await client.query(
          `INSERT INTO inventory_batches (variant_id, product_id, sku, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, batch_number, received_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (product_id, variant_id, batch_number) DO NOTHING;`, // Using the unique constraint for conflict
          [variantId, productId, variantSku, variantStock, variantStock, variantCostPrice, (config.company && config.company.currencyCode) || 'USD', `SEED-${variantSku}`]
        );
        console.log(`    Created/Ensured initial inventory batch for variant SKU ${variantSku}`);
      }
    }
    console.log('Product variants seeding completed.');
  } catch (error) {
    console.error('Error seeding product variants:', error);
    throw error;
  }
}


async function seedProductReviews(client, seededDataIds) {
  console.log('Seeding product reviews...');
  if (!seededDataIds.users || Object.keys(seededDataIds.users).length === 0 ||
      !seededDataIds.products || Object.keys(seededDataIds.products).length === 0) {
    console.warn('Users or products not seeded. Skipping product reviews.');
    return;
  }

  const product1Info = seededDataIds.products['HDPHN-WL-BT-001'];
  const userJohnId = seededDataIds.users['john.doe@example.com'];

  if (product1Info && userJohnId) {
    try {
      await client.query(
        `INSERT INTO product_reviews (product_id, user_id, rating, title, comment, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING;`,
        [product1Info.id, userJohnId, 5, 'Amazing Headphones!', 'These are the best headphones I have ever owned. Noise cancellation is superb.', true]
      );
      console.log('Seeded a review for HDPHN-WL-BT-001.');
      await updateProductAverageRating(product1Info.id, client);
    } catch (error) {
      console.error('Error seeding product review:', error);
    }
  } else {
      console.warn("Could not seed review for HDPHN-WL-BT-001, product or user not found in seededDataIds.");
  }
  console.log('Product reviews seeding completed (minimal).');
}

async function seedProductImages(client, seededDataIds) {
  console.log('Seeding product images (basic, using main product image_url)...');
  try {
    for (const sku in seededDataIds.products) {
        const productInfo = seededDataIds.products[sku];
        if (productInfo && productInfo.id && productInfo.image_url) {
            await client.query(
                `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order, s3_key, s3_bucket)
                 VALUES ($1, $2, $3, $4, $5, NULL, NULL)
                 ON CONFLICT DO NOTHING;`,
                [productInfo.id, productInfo.image_url, `Main image for ${productInfo.sku}`, true, 0]
            );
        }
    }
    console.log('Basic product images seeding completed.');
  } catch(error) {
      console.error('Error seeding product images:', error);
      throw error;
  }
}

async function seedInventoryBatches(client, seededDataIds) {
  console.log('Seeding inventory batches (for non-variant products)...');
  try {
    const productsWithoutVariantsResult = await client.query(
      'SELECT id, sku, stock_quantity, cost_price FROM products WHERE has_variants = FALSE AND stock_quantity > 0'
    );
    const productsWithoutVariants = productsWithoutVariantsResult.rows;

    for (const product of productsWithoutVariants) {
      const seedBatchNumber = `SEED-NONVARIANT-${product.sku}`;
      const costAtReceipt = product.cost_price || 0;
      const currencyCode = (config.company && config.company.currencyCode) || 'USD';

      // Check if a batch with the same characteristics already exists
      const existingBatchResult = await client.query(
        'SELECT id FROM inventory_batches WHERE product_id = $1 AND variant_id IS NULL AND quantity_received = $2 AND cost_price_at_receipt = $3 AND batch_number = $4 LIMIT 1',
        [product.id, product.stock_quantity, costAtReceipt, seedBatchNumber]
      );

      if (existingBatchResult.rows.length === 0) {
        await client.query(
          `INSERT INTO inventory_batches (product_id, variant_id, sku, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, batch_number, received_date)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, NOW());`,
          [product.id, product.sku, product.stock_quantity, product.stock_quantity, costAtReceipt, currencyCode, seedBatchNumber]
        );
        console.log(`Created initial inventory batch for non-variant product SKU ${product.sku}, quantity ${product.stock_quantity}, batch: ${seedBatchNumber}.`);
      } else {
        console.log(`Skipping batch creation for non-variant product SKU ${product.sku} (batch: ${seedBatchNumber}) as a similar batch already exists.`);
      }
    }
    console.log('Inventory batches seeding for non-variant products completed.');
  } catch (error) {
    console.error('Error seeding inventory batches for non-variant products:', error);
    throw error;
  }
}

async function seedCostHistory(client, seededDataIds) { console.log("Placeholder: seedCostHistory"); }
async function seedStockMovements(client, seededDataIds) { console.log("Placeholder: seedStockMovements"); }


async function seedRbac(client, seededDataIds) {
  console.log('Seeding RBAC (Roles, Permissions, Role-Permissions)...');
  seededDataIds.roles = seededDataIds.roles || {};
  seededDataIds.permissions = seededDataIds.permissions || {};
  const rolesToSeed = [
    { name: 'Super Admin', description: 'Full system access.' },
    { name: 'Admin', description: 'Administrator with significant privileges.' },
    { name: 'Product Manager', description: 'Manages products, categories, and tags.' },
    { name: 'Customer', description: 'Standard customer account.' },
  ];
  const permissionsToSeed = [
    { name: 'admin:access_dashboard', description: 'Can access the admin dashboard area.', group_name: 'Admin' },
    { name: 'products:view', description: 'Can view products.', group_name: 'Products' },
    { name: 'products:create', description: 'Can create new products.', group_name: 'Products' },
    { name: 'products:edit', description: 'Can edit existing products (details, pricing, inventory, variants, images).', group_name: 'Products' },
    { name: 'products:edit_pricing', description: 'Can edit product prices and cost price.', group_name: 'Products' },
    { name: 'products:edit_inventory', description: 'Can edit product stock levels and reorder thresholds.', group_name: 'Products' },
    { name: 'products:delete', description: 'Can delete products.', group_name: 'Products' },
    { name: 'categories:manage', description: 'Can manage product categories.', group_name: 'Products' },
    { name: 'tags:manage', description: 'Can manage product tags.', group_name: 'Products' },
    { name: 'users:view', description: 'Can view users.', group_name: 'Users' },
    { name: 'users:create', description: 'Can create new users.', group_name: 'Users' },
    { name: 'users:edit', description: 'Can edit user details.', group_name: 'Users' },
    { name: 'users:assign_roles', description: 'Can assign roles to users.', group_name: 'Users' },
    { name: 'users:delete', description: 'Can delete users.', group_name: 'Users' },
    { name: 'rbac:manage', description: 'Can manage roles and permissions assignments.', group_name: 'System' },
    { name: 'orders:view_all', description: 'Can view all orders.', group_name: 'Orders' },
    { name: 'orders:view_details', description: 'Can view details of any order.', group_name: 'Orders' },
    { name: 'orders:update_status', description: 'Can update order statuses.', group_name: 'Orders' },
    { name: 'orders:manage_refunds', description: 'Can process refunds.', group_name: 'Orders' },
    { name: 'orders:delete', description: 'Can delete orders.', group_name: 'Orders' },
    { name: 'discounts:manage', description: 'Can create, edit, and delete discounts.', group_name: 'Discounts' },
    { name: 'taxes:manage_classes', description: 'Can manage tax classes.', group_name: 'Taxes' },
    { name: 'taxes:manage_rates', description: 'Can manage tax rates.', group_name: 'Taxes' },
    { name: 'suppliers:manage', description: 'Can manage suppliers.', group_name: 'Suppliers' },
    { name: 'purchase_orders:manage', description: 'Can manage purchase orders.', group_name: 'Purchase Orders' },
    { name: 'purchase_orders:delete', description: 'Can delete purchase orders.', group_name: 'Purchase Orders' },
    { name: 'reports:view', description: 'Can view admin reports.', group_name: 'Reports' },
    { name: 'settings:manage_general', description: 'Can manage general store settings.', group_name: 'Settings' },
    { name: 'options:manage_global', description: 'Can manage global product options and their values.', group_name: 'Products' },
    { name: 'returns:manage', description: 'Can manage customer returns.', group_name: 'Orders' },
    { name: 'reviews:manage', description: 'Can manage product reviews (approve, reject, delete).', group_name: 'Products' },
    { name: 'auditlogs:view', description: 'Can view system audit logs.', group_name: 'System' },
    { name: 'marketing:send_emails', description: 'Allows sending of marketing emails to user segments.', group_name: 'Marketing' },
    { name: 'marketing:manage_hero_banners', description: 'Can create, read, update, and delete hero banners.', group_name: 'Marketing' },
    { name: 'marketing:view_campaigns', description: 'Can view email campaigns and their tracking data.', group_name: 'Marketing' },
    { name: 'marketing:view_unsubscribes', description: 'Can view unsubscribe lists and manage email preferences.', group_name: 'Marketing' },
    { name: 'products:view_stock', description: 'Can view product stock levels and inventory batches.', group_name: 'Products' },
    { name: 'orders:validate_fulfillment', description: 'Can validate order fulfillment using QR codes or manual entry.', group_name: 'Orders' },
    { name: 'orders:manage_fulfillment', description: 'Can assign and manage fulfillment validation codes for orders.', group_name: 'Orders' },
    { name: 'orders:print_shipping_label', description: 'Can generate shipping labels for orders.', group_name: 'Orders' },
    { name: 'shipping:manage_couriers', description: 'Can create, edit, and delete shipping couriers.', group_name: 'Shipping' },
    { name: 'shipping:manage_methods', description: 'Can create, edit, and delete shipping methods.', group_name: 'Shipping' },
    { name: 'shipping:view_options', description: 'Can view available shipping options for checkout.', group_name: 'Shipping' }
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
      'admin': Object.keys(seededDataIds.permissions),
      'product_manager': [ 'admin:access_dashboard', 'products:view', 'products:create', 'products:edit', 'products:delete', 'categories:manage', 'tags:manage', 'options:manage_global', 'reviews:manage', 'products:view_stock', 'shipping:view_options' ], // Added products:view_stock and shipping:view_options
      'customer': ['products:view', 'orders:view_details']
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

async function seedOrders(client, seededDataIds) {
  console.log('Seeding orders...');
  seededDataIds.orders = seededDataIds.orders || {};

  // Use seeded users and products
  const userIds = Object.values(seededDataIds.users);
  const productList = Object.values(seededDataIds.products);
  if (userIds.length === 0 || productList.length === 0) {
    console.warn('No users or products found for order seeding. Skipping.');
    return;
  }

  // Create more comprehensive sample orders for better reports
  const orderStatuses = ['pending', 'processing', 'dispatched', 'delivered', 'completed', 'cancelled', 'refunded'];
  const paymentStatuses = ['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided'];
  const paymentMethods = ['credit_card', 'paypal', 'bank_transfer', 'cash_on_delivery'];
  const countries = ['US', 'CA', 'GB', 'DE', 'FR', 'AU'];
  const cities = ['New York', 'Los Angeles', 'Toronto', 'London', 'Berlin', 'Paris', 'Sydney'];
  
  // Generate orders over the past 6 months for time series data
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  
  let orderCounter = 0;
  
  // Create multiple orders per user with different dates and statuses
  for (let userIndex = 0; userIndex < userIds.length; userIndex++) {
    const userId = userIds[userIndex];
    
    // Create 3-8 orders per user
    const ordersPerUser = 3 + (userIndex % 6);
    
    for (let orderIndex = 0; orderIndex < ordersPerUser; orderIndex++) {
      orderCounter++;
      
      // Generate random date within the past 6 months
      const randomDaysAgo = Math.floor(Math.random() * 180);
      const orderDate = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000));
      
      // Select random products for this order (1-3 products)
      const numProducts = 1 + (orderIndex % 3);
      const selectedProducts = [];
      for (let p = 0; p < numProducts; p++) {
        const product = productList[(userIndex + orderIndex + p) % productList.length];
        selectedProducts.push(product);
      }
      
      // Calculate order totals
      let subtotal = 0;
      let taxAmount = 0;
      const shippingCost = 5.99 + (orderIndex * 2); // Varying shipping costs
      const discountAmount = orderIndex % 3 === 0 ? (subtotal * 0.1) : 0; // 10% discount on some orders
      
      // Calculate subtotal and tax
      for (const product of selectedProducts) {
        const productPrice = parseFloat(product.price) || 29.99;
        const quantity = 1 + (orderIndex % 3); // 1-3 quantity
        subtotal += productPrice * quantity;
      }
      
      // Add tax (8.5% for US, 13% for CA, 20% for EU, 10% for AU)
      const country = countries[userIndex % countries.length];
      const taxRate = country === 'US' ? 0.085 : country === 'CA' ? 0.13 : country === 'AU' ? 0.10 : 0.20;
      taxAmount = subtotal * taxRate;
      
      const totalAmount = subtotal + taxAmount + shippingCost - discountAmount;
      
      // Select order status (weighted towards completed/delivered for revenue reports)
      const statusWeights = [0.1, 0.15, 0.2, 0.25, 0.2, 0.05, 0.05]; // pending, processing, dispatched, delivered, completed, cancelled, refunded
      const random = Math.random();
      let cumulativeWeight = 0;
      let selectedStatus = orderStatuses[0];
      for (let i = 0; i < orderStatuses.length; i++) {
        cumulativeWeight += statusWeights[i];
        if (random <= cumulativeWeight) {
          selectedStatus = orderStatuses[i];
          break;
        }
      }
      
      // Select payment status based on order status
      let selectedPaymentStatus = 'paid';
      if (selectedStatus === 'pending' || selectedStatus === 'processing') {
        selectedPaymentStatus = paymentStatuses[Math.floor(Math.random() * 3)]; // pending, paid, partially_paid
      } else if (selectedStatus === 'cancelled') {
        selectedPaymentStatus = paymentStatuses[Math.floor(Math.random() * 4) + 4]; // failed, cancelled, voided, refunded
      } else if (selectedStatus === 'refunded') {
        selectedPaymentStatus = paymentStatuses[Math.floor(Math.random() * 2) + 3]; // refunded, partially_refunded
      } else {
        selectedPaymentStatus = paymentStatuses[Math.floor(Math.random() * 2) + 1]; // paid, partially_paid
      }
      
      const paymentMethod = paymentMethods[orderIndex % paymentMethods.length];
      const city = cities[userIndex % cities.length];
      
      // Insert order
      const orderRes = await client.query(
        `INSERT INTO orders (
          user_id, status, total_amount, original_total_amount, discount_amount_applied, payment_status,
          shipping_address_line1, shipping_city, shipping_postal_code, shipping_country,
          billing_address_line1, billing_city, billing_postal_code, billing_country,
          total_tax_amount, payment_method, shipping_cost, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18
        ) RETURNING id;`,
        [
          userId, selectedStatus, totalAmount, subtotal, discountAmount, selectedPaymentStatus,
          `${100 + orderCounter} Main St`, city, `${10000 + orderCounter}`, country,
          `${100 + orderCounter} Main St`, city, `${10000 + orderCounter}`, country,
          taxAmount, paymentMethod, shippingCost, orderDate
        ]
      );
      
      const orderId = orderRes.rows[0].id;
      seededDataIds.orders[orderId] = { id: orderId, user_id: userId };
      
      // Insert order items
      for (const product of selectedProducts) {
        const productPrice = parseFloat(product.price) || 29.99;
        const quantity = 1 + (orderIndex % 3);
        
        // Check if product has variants and randomly assign some to variants
        let variantId = null;
        if (product.has_variants && seededDataIds.productVariants && seededDataIds.productVariants[product.id]) {
          const productVariants = seededDataIds.productVariants[product.id];
          if (productVariants.length > 0 && Math.random() < 0.3) { // 30% chance to use variant
            const randomVariant = productVariants[Math.floor(Math.random() * productVariants.length)];
            variantId = randomVariant.id;
          }
        }
        
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_variant_id, quantity, price_at_purchase, 
            product_name_at_purchase, product_sku_at_purchase,
            line_item_tax_amount, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            orderId, product.id, variantId, quantity, productPrice,
            product.name, product.sku,
            (productPrice * quantity * taxRate), orderDate
          ]
        );
      }
      
      console.log(`Seeded order ${orderId} for user ${userId} with ${selectedProducts.length} products, status: ${selectedStatus}, payment: ${selectedPaymentStatus}, total: $${totalAmount.toFixed(2)}`);
    }
  }
  
  console.log(`Orders seeding completed. Created ${orderCounter} orders.`);
}

async function seedSiteSettings(client) {
  console.log('Seeding site settings...');
  
  const defaultSettings = [
    // General Settings
    { setting_key: 'site_name', setting_value: 'PeachyFL' },
    { setting_key: 'site_description', setting_value: 'Your premium online store for quality products' },
    { setting_key: 'contact_email', setting_value: 'contact@peachyfl.com' },
    { setting_key: 'contact_phone', setting_value: '+1 (555) 123-4567' },
    { setting_key: 'address', setting_value: '123 Business Street, Suite 100, City, State 12345' },
    { setting_key: 'site_logo', setting_value: '' },
    
    // Locale & Currency Settings
    { setting_key: 'default_locale', setting_value: 'en-US' },
    { setting_key: 'default_currency', setting_value: 'USD' },
    { setting_key: 'currency_symbol', setting_value: '$' },
    { setting_key: 'timezone', setting_value: 'America/New_York' },
    
    // Geographic Service Locations
    { setting_key: 'service_locations', setting_value: 'US,CA,GB,DE,FR,IT,ES,NL,JP,KR,CN,AU,SG,IN' },
    { setting_key: 'geo_location_service', setting_value: 'ipapi' },
    { setting_key: 'geo_location_api_key', setting_value: '' },
    
    // Social Media Settings
    { setting_key: 'social_facebook', setting_value: '' },
    { setting_key: 'social_instagram', setting_value: '' },
    { setting_key: 'social_twitter', setting_value: '' },
    
    // Feature Toggles
    { setting_key: 'shipping_calculator_enabled', setting_value: 'true' },
    { setting_key: 'tax_calculator_enabled', setting_value: 'true' },
    { setting_key: 'guest_checkout_enabled', setting_value: 'true' },
    { setting_key: 'reviews_enabled', setting_value: 'true' },
    { setting_key: 'wishlist_enabled', setting_value: 'true' },
    { setting_key: 'new_arrivals_days', setting_value: '30' },
    
    // Maintenance Settings
    { setting_key: 'maintenance_mode_enabled', setting_value: 'false' },
    { setting_key: 'maintenance_message', setting_value: '' },
    
    // Email Settings
    { setting_key: 'order_confirmation_email_template', setting_value: '' },
    { setting_key: 'email_from_name', setting_value: 'PeachyFL Store' },
    { setting_key: 'email_from_address', setting_value: 'noreply@peachyfl.com' },
    
    // SEO Settings
    { setting_key: 'meta_title', setting_value: 'PeachyFL - Premium Online Store' },
    { setting_key: 'meta_description', setting_value: 'Discover quality products at PeachyFL. Shop with confidence for the best deals and premium service.' },
    { setting_key: 'meta_keywords', setting_value: 'online store, shopping, quality products, premium service' },
    
    // Analytics Settings
    { setting_key: 'google_analytics_id', setting_value: '' },
    { setting_key: 'facebook_pixel_id', setting_value: '' },
    
    // Security Settings
    { setting_key: 'max_login_attempts', setting_value: '5' },
    { setting_key: 'session_timeout_minutes', setting_value: '60' },
    { setting_key: 'require_email_verification', setting_value: 'true' },
    
    // Performance Settings
    { setting_key: 'cache_enabled', setting_value: 'true' },
    { setting_key: 'image_optimization_enabled', setting_value: 'true' },
    { setting_key: 'cdn_enabled', setting_value: 'false' },
    
    // Notification Settings
    { setting_key: 'low_stock_threshold', setting_value: '10' },
    { setting_key: 'out_of_stock_notifications', setting_value: 'true' },
    { setting_key: 'order_notifications', setting_value: 'true' },
    { setting_key: 'review_notifications', setting_value: 'true' },
    
    // Shipping Settings
    { setting_key: 'free_shipping_threshold', setting_value: '50.00' },
    { setting_key: 'default_shipping_cost', setting_value: '5.99' },
    { setting_key: 'shipping_zones_enabled', setting_value: 'false' },
    
    // Tax Settings
    { setting_key: 'tax_included_in_price', setting_value: 'false' },
    { setting_key: 'tax_display_type', setting_value: 'exclusive' }, // exclusive or inclusive
    { setting_key: 'tax_rounding', setting_value: 'nearest' },
    
    // Inventory Settings
    { setting_key: 'allow_backorders', setting_value: 'false' },
    { setting_key: 'track_inventory', setting_value: 'true' },
    { setting_key: 'reserve_stock_on_cart', setting_value: 'true' },
    { setting_key: 'reserve_stock_duration_minutes', setting_value: '30' },
    
    // Customer Settings
    { setting_key: 'customer_registration_enabled', setting_value: 'true' },
    { setting_key: 'customer_approval_required', setting_value: 'false' },
    { setting_key: 'customer_groups_enabled', setting_value: 'false' },
    { setting_key: 'customer_points_enabled', setting_value: 'false' },
    
    // Product Settings
    { setting_key: 'product_reviews_require_approval', setting_value: 'true' },
    { setting_key: 'product_ratings_enabled', setting_value: 'true' },
    { setting_key: 'product_comparison_enabled', setting_value: 'true' },
    { setting_key: 'product_wishlist_enabled', setting_value: 'true' },
    { setting_key: 'product_share_enabled', setting_value: 'true' },
    
    // Order Settings
    { setting_key: 'order_number_prefix', setting_value: 'ORD' },
    { setting_key: 'order_number_suffix', setting_value: '' },
    { setting_key: 'order_auto_cancel_hours', setting_value: '24' },
    { setting_key: 'order_auto_complete_days', setting_value: '7' },
    { setting_key: 'order_notes_enabled', setting_value: 'true' },
    
    // Discount Settings
    { setting_key: 'coupon_codes_enabled', setting_value: 'true' },
    { setting_key: 'automatic_discounts_enabled', setting_value: 'true' },
    { setting_key: 'bulk_discounts_enabled', setting_value: 'true' },
    
    // Return/Refund Settings
    { setting_key: 'returns_enabled', setting_value: 'true' },
    { setting_key: 'return_window_days', setting_value: '30' },
    { setting_key: 'refund_method', setting_value: 'original_payment' }, // original_payment, store_credit, bank_transfer
    
    // Integration Settings
    { setting_key: 'google_shopping_enabled', setting_value: 'false' },
    { setting_key: 'facebook_catalog_enabled', setting_value: 'false' },
    { setting_key: 'instagram_shopping_enabled', setting_value: 'false' },
    
    // API Settings
    { setting_key: 'api_enabled', setting_value: 'false' },
    { setting_key: 'api_rate_limit', setting_value: '1000' },
    { setting_key: 'webhook_enabled', setting_value: 'false' },
    
    // Backup Settings
    { setting_key: 'auto_backup_enabled', setting_value: 'false' },
    { setting_key: 'backup_frequency_days', setting_value: '7' },
    { setting_key: 'backup_retention_days', setting_value: '30' },
    { setting_key: 'mock_gateway_enabled', setting_value: 'true' },
  ];

  for (const setting of defaultSettings) {
    try {
      await client.query(
        `INSERT INTO site_settings (setting_key, setting_value) 
         VALUES ($1, $2) 
         ON CONFLICT (setting_key) DO UPDATE SET 
         setting_value = EXCLUDED.setting_value,
         updated_at = CURRENT_TIMESTAMP`,
        [setting.setting_key, setting.setting_value]
      );
    } catch (error) {
      console.error(`Error seeding setting ${setting.setting_key}:`, error.message);
    }
  }
  
  console.log('Site settings seeded successfully.');
}

async function seedDiscounts(client, seededDataIds) {
  console.log('Seeding discounts...');
  
  const discounts = [
    {
      code: 'WELCOME10',
      type: 'percentage',
      value: 10.00,
      description: 'Welcome discount for new customers',
      is_active: true,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      usage_limit: 1000,
      times_used: 0,
      min_order_amount: 25.00
    },
    {
      code: 'FREESHIP',
      type: 'fixed_amount',
      value: 5.99,
      description: 'Free shipping on orders over $50',
      is_active: true,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      usage_limit: 500,
      times_used: 0,
      min_order_amount: 50.00
    },
    {
      code: 'FLASH20',
      type: 'percentage',
      value: 20.00,
      description: 'Flash sale - 20% off everything',
      is_active: true,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      usage_limit: 100,
      times_used: 0,
      min_order_amount: 0.00
    }
  ];

  for (const discount of discounts) {
    try {
      await client.query(
        `INSERT INTO discounts (code, type, value, description, is_active, valid_from, valid_until, usage_limit, times_used, min_order_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (code) DO UPDATE SET
           type = EXCLUDED.type,
           value = EXCLUDED.value,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active,
           valid_from = EXCLUDED.valid_from,
           valid_until = EXCLUDED.valid_until,
           usage_limit = EXCLUDED.usage_limit,
           min_order_amount = EXCLUDED.min_order_amount`,
        [discount.code, discount.type, discount.value, discount.description, discount.is_active, 
         discount.valid_from, discount.valid_until, discount.usage_limit, discount.times_used, discount.min_order_amount]
      );
      console.log(`Discount code "${discount.code}" seeded/updated.`);
    } catch (error) {
      console.error(`Error seeding discount ${discount.code}:`, error.message);
    }
  }
  
  console.log('Discounts seeding completed.');
}

async function seedCouriersAndShippingMethods(client, seededDataIds) {
  console.log('Seeding couriers and shipping methods...');
  // Seed couriers
  const couriers = [
    { name: 'FastExpress', contact_info: 'support@fastexpress.com' },
    { name: 'EcoShip', contact_info: 'info@ecoship.com' },
  ];
  const courierIds = [];
  for (const c of couriers) {
    const res = await client.query(
      `INSERT INTO couriers (name, contact_info) VALUES ($1, $2) RETURNING id`,
      [c.name, c.contact_info]
    );
    courierIds.push(res.rows[0].id);
  }
  // Seed shipping methods
  const methods = [
    { name: 'Standard Shipping', price: 5.99, courier_id: courierIds[0], description: '3-5 business days' },
    { name: 'Express Shipping', price: 12.99, courier_id: courierIds[0], description: '1-2 business days' },
    { name: 'Eco Saver', price: 3.99, courier_id: courierIds[1], description: '5-8 business days' },
  ];
  for (const m of methods) {
    await client.query(
      `INSERT INTO shipping_methods (name, price, courier_id, description) VALUES ($1, $2, $3, $4)`,
      [m.name, m.price, m.courier_id, m.description]
    );
  }
  console.log('Couriers and shipping methods seeded.');
}

// --- END OF HELPER SEED FUNCTION DEFINITIONS ---

async function seedDatabase() {
  console.log('Starting database seeding...');
  let client;
  try {
    client = await pool.connect();
    await createSchema(client); // Creates tables if they don't exist
    await applySchemaMigrations(client); // Add new columns if they don't exist
    await client.query('BEGIN');

    // Seed site settings before other seeders
    await seedSiteSettings(client);

    const seededDataIds = {
        users: {}, options: {}, optionValues: {}, products: {},
        taxClasses: {}, taxRates: {}, roles: {}, permissions: {},
        heroBanners: {}, categories: {}, suppliers: {}, variants: {},
        orders: {}
    };

    await seedRbac(client, seededDataIds);
    await seedTaxConfiguration(client, seededDataIds);

    await seedAdminUser(client, seededDataIds.users);
    await seedRegularUsers(client, seededDataIds.users);

    console.log('Migrating users to role_ids...');
    if (seededDataIds.roles.admin && seededDataIds.roles.customer) {
      const allUsers = await client.query('SELECT id, email, role FROM users WHERE role_id IS NULL');
      for (const user of allUsers.rows) {
        let targetRoleId = null;
        if (user.email === (process.env.ADMIN_EMAIL || 'admin@example.com') || user.role.toLowerCase() === 'admin') {
            targetRoleId = seededDataIds.roles.admin;
        } else if (user.role.toLowerCase() === 'customer' || user.role.toLowerCase() === 'user' || user.role.toLowerCase() === 'guest') {
            targetRoleId = seededDataIds.roles.customer;
        }

        if (targetRoleId) {
          await client.query('UPDATE users SET role_id = $1 WHERE id = $2', [targetRoleId, user.id]);
          console.log(`Updated user ID ${user.id} (legacy role: ${user.role}) to new role_id: ${targetRoleId}`);
        } else {
          console.warn(`User ID ${user.id} (email: ${user.email}, legacy role: "${user.role}") - no new role_id assigned.`);
        }
      }
      console.log('User role_id migration step completed.');
    } else {
      console.error('CRITICAL: Role IDs for migration (admin, customer) not found in seededDataIds.roles. Skipping user role_id migration.');
    }


    await seedCategories(client, seededDataIds);
    await seedSuppliers(client, seededDataIds);
    await seedSpecificGlobalOptionsAndValues(client, seededDataIds);
    await seedProducts(client, seededDataIds);
    await seedCouriersAndShippingMethods(client, seededDataIds);
    await seedDiscounts(client, seededDataIds);
    await seedOrders(client, seededDataIds);

    const productSkusToConfigure = ['TSHRT-MEN-COT-005', 'HDPHN-WL-BT-001'];
    console.log('Checking conditions for product option/variant seeding:');
    console.log(`  seededDataIds.products populated: ${Object.keys(seededDataIds.products).length > 0}`);
    console.log(`  seededDataIds.options.colorOptionId exists: ${!!seededDataIds.options?.colorOptionId}`);
    console.log(`  seededDataIds.options.sizeOptionId exists: ${!!seededDataIds.options?.sizeOptionId}`);
    console.log(`  seededDataIds.optionValues.color populated: ${Object.keys(seededDataIds.optionValues?.color || {}).length > 0}`);
    console.log(`  seededDataIds.optionValues.size populated: ${Object.keys(seededDataIds.optionValues?.size || {}).length > 0}`);


    if (Object.keys(seededDataIds.products).length > 0 &&
        seededDataIds.options?.colorOptionId &&
        seededDataIds.options?.sizeOptionId &&
        seededDataIds.optionValues?.color && Object.keys(seededDataIds.optionValues.color).length > 0 &&
        seededDataIds.optionValues?.size && Object.keys(seededDataIds.optionValues.size).length > 0
        ) {
      console.log('Proceeding with product option configurations and variant seeding.');
      await seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure);
      await seedProductVariants(client, seededDataIds);
      await seedInventoryBatchesForVariants(client, seededDataIds);
    } else {
      console.warn("Skipping product option configurations and variant seeding due to missing prerequisite data. Check logs above for details on options/values.");
    }

    await seedProductImages(client, seededDataIds);
    await seedProductReviews(client, seededDataIds);

    await seedInventoryBatches(client, seededDataIds);

    await seedCostHistory(client, seededDataIds);
    await seedStockMovements(client, seededDataIds);

    await seedHeroBanners(client, seededDataIds);

    console.log('Database seeding completed successfully.');
    await client.query('COMMIT');
  } catch (error) {
    if (client) {
      console.error('Error detected during seeding, attempting to rollback transaction...');
      await client.query('ROLLBACK');
      console.error('Transaction rolled back.');
    }
    console.error('Error during database seeding:', error);
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

async function seedInventoryBatchesForVariants(client, seededDataIds) {
  console.log('Seeding inventory batches for product variants...');
  try {
    // Get all variants
    const variantsResult = await client.query('SELECT id, product_id, sku, cost_price FROM product_variants');
    const variants = variantsResult.rows;
    for (const variant of variants) {
      const seedBatchNumber = `SEED-VARIANT-${variant.sku}`;
      const costAtReceipt = variant.cost_price || 0;
      const currencyCode = (config.company && config.company.currencyCode) || 'USD';
      // Check if a batch with the same characteristics already exists
      const existingBatchResult = await client.query(
        'SELECT id FROM inventory_batches WHERE product_id = $1 AND variant_id = $2 AND batch_number = $3 LIMIT 1',
        [variant.product_id, variant.id, seedBatchNumber]
      );
      if (existingBatchResult.rows.length === 0) {
        await client.query(
          `INSERT INTO inventory_batches (product_id, variant_id, sku, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, batch_number, received_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
          [variant.product_id, variant.id, variant.sku, 10, 10, costAtReceipt, currencyCode, seedBatchNumber]
        );
        console.log(`Created initial inventory batch for variant SKU ${variant.sku}, quantity 10, batch: ${seedBatchNumber}.`);
      } else {
        console.log(`Skipping batch creation for variant SKU ${variant.sku} (batch: ${seedBatchNumber}) as a similar batch already exists.`);
      }
    }
    console.log('Inventory batches seeding for variants completed.');
  } catch (error) {
    console.error('Error seeding inventory batches for variants:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase().then(() => {
    console.log("Seeding script finished successfully.");
    process.exit(0);
  }).catch(err => {
    console.error("Seeding script failed overall.");
    process.exit(1);
  });
}

module.exports = { seedDatabase, pool };
