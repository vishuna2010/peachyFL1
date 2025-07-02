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
        parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('Table "categories" checked/created.');

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
        comment TEXT, is_approved BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_reviews" checked/created.');

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

    // Purchase Order Items Table (ensure it exists before inventory_batches references it)
    // This might need to be moved earlier if not already defined. Assuming it's defined before this point.
    // For safety, let's add a check here, though ideally it's part of a more structured migration.
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        -- other columns...
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        -- Ensure other necessary columns like purchase_order_id, product_id, etc., are defined elsewhere or add them.
        -- This is a minimal stub to ensure the FK in inventory_batches can be created if PO items are not fully defined yet.
      );
    `);
    console.log('Table "purchase_order_items" checked/created (minimal stub for FK if not already fully defined).');


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

    const tablesWithTimestampTrigger = ['users', 'roles', 'permissions', 'suppliers', 'categories', 'hero_banners', 'products', 'product_options', 'product_option_values', 'product_variants', 'product_images', 'product_reviews', 'tax_classes', 'tax_rates', 'inventory_batches', 'product_assigned_options', 'product_assigned_option_specific_values', 'product_cost_history'];
    for (const tableName of tablesWithTimestampTrigger) {
      await client.query(`
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_${tableName}_updated_at' AND tgrelid = '${tableName}'::regclass) THEN
        CREATE TRIGGER trigger_update_${tableName}_updated_at BEFORE UPDATE ON ${tableName} FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp(); END IF; END $$;
      `);
      console.log(`Trigger for "${tableName}.updated_at" ensured.`);
    }
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
    { title: 'Summer Collection Arrived!', subtitle: 'Discover the latest trends for the sunny season.', button_text: 'Explore Summer', button_link: '/collections/summer', image_url: 'https://via.placeholder.com/1200x400.png?text=Summer+Banner+Active', alt_text: 'Bright summer fashion display', is_active: true, sort_order: 1 },
    { title: 'Flash Sale: 24 Hours Only!', subtitle: 'Get 30% off on all accessories. Use code FLASH30.', button_text: 'Shop Accessories', button_link: '/categories/accessories?promo=flash30', image_url: 'https://via.placeholder.com/1200x400.png?text=Flash+Sale+Active', alt_text: 'Exciting flash sale announcement', is_active: true, sort_order: 0 },
    { title: 'New Arrivals: Electronics (Inactive)', subtitle: 'Check out the latest gadgets and tech.', button_text: 'View New Tech', button_link: '/categories/electronics?filter=new', image_url: 'https://via.placeholder.com/1200x400.png?text=Tech+Banner+Inactive', alt_text: 'Sleek display of new electronic gadgets', is_active: false, sort_order: 2 },
    { title: 'Winter Clearance (Active High Prio)', subtitle: 'Up to 70% off last season winter wear.', button_text: 'Shop Clearance', button_link: '/sale/winter-clearance', image_url: 'https://via.placeholder.com/1200x400.png?text=Winter+Clearance+Active', alt_text: 'Winter clothes on sale', is_active: true, sort_order: 0 }
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
  const categoriesToSeed = [
    { name: 'Electronics', description: 'Gadgets, devices, and accessories.' },
    { name: 'Apparel', description: 'Clothing for men, women, and children.' },
    { name: 'Books', description: 'Various genres of books.' },
    { name: 'Home Goods', description: 'Items for home and kitchen.' },
  ];
  try {
    for (const cat of categoriesToSeed) {
      const result = await client.query(
        `INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description RETURNING id, name;`,
        [cat.name, cat.description]
      );
      if (result.rows.length > 0) {
        seededDataIds.categories[result.rows[0].name] = result.rows[0].id;
        console.log(`Category "${result.rows[0].name}" seeded/updated with ID ${result.rows[0].id}.`);
      }
    }
    if (seededDataIds.categories['Electronics']) {
        const subCatRes = await client.query(
            `INSERT INTO categories (name, description, parent_category_id) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, parent_category_id=EXCLUDED.parent_category_id RETURNING id, name;`,
            ['Headphones', 'Audio listening devices', seededDataIds.categories['Electronics']]
        );
        if (subCatRes.rows.length > 0) {
            seededDataIds.categories[subCatRes.rows[0].name] = subCatRes.rows[0].id;
            console.log(`Sub-Category "${subCatRes.rows[0].name}" seeded/updated with ID ${subCatRes.rows[0].id}.`);
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
      price: 149.99, cost_price: 75.00, stock_quantity: 0,
      category_id: seededDataIds.categories?.Headphones,
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://via.placeholder.com/300x300.png?text=Headphones', is_active: true,
      has_variants: false,
      reorder_threshold: 5,
      product_status: 'active'
    },
    {
      name: 'Men\'s Cotton T-Shirt', sku: 'TSHRT-MEN-COT-005', description: 'Comfortable and durable 100% cotton t-shirt for everyday wear.',
      price: 25.99, cost_price: 10.00, stock_quantity: 0,
      category_id: seededDataIds.categories?.Apparel,
      supplier_id: seededDataIds.suppliers?.['FashionFabrics Co.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://via.placeholder.com/300x300.png?text=T-Shirt', is_active: true,
      has_variants: false,
      reorder_threshold: 10,
      product_status: 'active'
    },
    {
      name: 'Simple LED Desk Lamp', sku: 'LAMP-DSK-LED-010', description: 'Modern LED desk lamp with adjustable brightness.',
      price: 39.99, cost_price: 15.00, stock_quantity: 50,
      category_id: seededDataIds.categories?.['Home Goods'],
      supplier_id: seededDataIds.suppliers?.['TechGadget Inc.'],
      tax_class_id: seededDataIds.taxClasses?.standard_goods,
      image_url: 'https://via.placeholder.com/300x300.png?text=Desk+Lamp', is_active: true,
      has_variants: false,
      reorder_threshold: 5,
      product_status: 'draft'
    },
  ];

  try {
    for (const prod of productsToSeed) {
      const result = await client.query(
        `INSERT INTO products (name, sku, description, price, cost_price, stock_quantity, category_id, supplier_id, tax_class_id, image_url, is_active, has_variants, reorder_threshold, product_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (sku) DO UPDATE SET
           name=EXCLUDED.name, description=EXCLUDED.description, price=EXCLUDED.price, cost_price=EXCLUDED.cost_price, stock_quantity=EXCLUDED.stock_quantity,
           category_id=EXCLUDED.category_id, supplier_id=EXCLUDED.supplier_id, tax_class_id=EXCLUDED.tax_class_id, image_url=EXCLUDED.image_url, is_active=EXCLUDED.is_active, has_variants=EXCLUDED.has_variants,
           reorder_threshold=EXCLUDED.reorder_threshold, product_status=EXCLUDED.product_status
         RETURNING id, sku;`,
        [prod.name, prod.sku, prod.description, prod.price, prod.cost_price, prod.stock_quantity, prod.category_id, prod.supplier_id, prod.tax_class_id, prod.image_url, prod.is_active, prod.has_variants, prod.reorder_threshold, prod.product_status]
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
    { name: 'discounts:manage', description: 'Can create, edit, and delete discounts.', group_name: 'Discounts' },
    { name: 'taxes:manage_classes', description: 'Can manage tax classes.', group_name: 'Taxes' },
    { name: 'taxes:manage_rates', description: 'Can manage tax rates.', group_name: 'Taxes' },
    { name: 'suppliers:manage', description: 'Can manage suppliers.', group_name: 'Suppliers' },
    { name: 'purchase_orders:manage', description: 'Can manage purchase orders.', group_name: 'Purchase Orders' },
    { name: 'reports:view', description: 'Can view admin reports.', group_name: 'Reports' },
    { name: 'settings:manage_general', description: 'Can manage general store settings.', group_name: 'Settings' },
    { name: 'options:manage_global', description: 'Can manage global product options and their values.', group_name: 'Products' },
    { name: 'returns:manage', description: 'Can manage customer returns.', group_name: 'Orders' },
    { name: 'reviews:manage', description: 'Can manage product reviews (approve, reject, delete).', group_name: 'Products' },
    { name: 'auditlogs:view', description: 'Can view system audit logs.', group_name: 'System' },
    { name: 'marketing:send_emails', description: 'Allows sending of marketing emails to user segments.', group_name: 'Marketing' },
    { name: 'marketing:manage_hero_banners', description: 'Can create, read, update, and delete hero banners.', group_name: 'Marketing' }
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
      'product_manager': [ 'admin:access_dashboard', 'products:view', 'products:create', 'products:edit', 'products:delete', 'categories:manage', 'tags:manage', 'options:manage_global', 'reviews:manage' ],
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

// --- END OF HELPER SEED FUNCTION DEFINITIONS ---

async function seedDatabase() {
  console.log('Starting database seeding...');
  let client;
  try {
    client = await pool.connect();
    await createSchema(client);
    await client.query('BEGIN');

    const seededDataIds = {
        users: {}, options: {}, optionValues: {}, products: {},
        taxClasses: {}, taxRates: {}, roles: {}, permissions: {},
        heroBanners: {}, categories: {}, suppliers: {}, variants: {}
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
