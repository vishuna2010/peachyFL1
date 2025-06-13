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
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" checked/created.');

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

    // Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        wholesale_price NUMERIC(10, 2) NULL,
        cost_price NUMERIC(10, 2) NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        sku VARCHAR(100) UNIQUE,
        stock_quantity INTEGER DEFAULT 0 NOT NULL,
        reorder_threshold INTEGER DEFAULT 0,
        image_url TEXT,
        has_variants BOOLEAN DEFAULT FALSE NOT NULL,
        average_rating NUMERIC(3, 2) DEFAULT 0.00,
        review_count INTEGER DEFAULT 0,
        brand_manufacturer TEXT,
        supplier_reference TEXT,
        product_status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (product_status IN ('active', 'inactive', 'archived')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "products" checked/created.');

    // Product Variants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku VARCHAR(100) UNIQUE,
        price_modifier NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
        wholesale_price_modifier NUMERIC(10, 2) DEFAULT 0.00 NULL,
        cost_price NUMERIC(10, 2) NULL,
        stock_quantity INTEGER DEFAULT 0 NOT NULL,
        image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_variants" checked/created.');

    // Product Options Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_options (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log('Table "product_options" checked/created.');

    // Product Option Values Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_option_values (
        id SERIAL PRIMARY KEY,
        product_option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        value VARCHAR(255) NOT NULL,
        UNIQUE (product_option_id, value)
      );
    `);
    console.log('Table "product_option_values" checked/created.');

    // Product Assigned Options Table (linking options to products)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_options (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        UNIQUE (product_id, option_id)
      );
    `);
    console.log('Table "product_assigned_options" checked/created.');

    // Product Assigned Option Values Table (linking specific values of an assigned option to a product)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_option_values (
        id SERIAL PRIMARY KEY,
        product_assigned_option_id INTEGER NOT NULL REFERENCES product_assigned_options(id) ON DELETE CASCADE,
        option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        UNIQUE (product_assigned_option_id, option_value_id)
      );
    `);
    console.log('Table "product_assigned_option_values" checked/created.');

    // Product Variant Option Values Table (linking variants to specific option values)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variant_option_values (
        id SERIAL PRIMARY KEY,
        product_variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        UNIQUE (product_variant_id, product_option_value_id)
      );
    `);
    console.log('Table "product_variant_option_values" checked/created.');

    // Product Images Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        s3_key TEXT,
        alt_text VARCHAR(255),
        display_order INTEGER DEFAULT 0 NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_images" checked/created.');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_primary_image_per_product
      ON product_images (product_id) WHERE is_primary = TRUE;
    `);
    console.log('Unique index "idx_unique_primary_image_per_product" on "product_images" checked/created.');

    // Tags Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log('Table "tags" checked/created.');

    // Product Tags Table (Many-to-Many)
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, tag_id)
      );
    `);
    console.log('Table "product_tags" checked/created.');

    // Product Reviews Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255),
        comment TEXT,
        status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, user_id)
      );
    `);
    console.log('Table "product_reviews" checked/created.');

    // Discounts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
        value NUMERIC(10, 2) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        usage_limit INTEGER,
        times_used INTEGER DEFAULT 0 NOT NULL,
        min_order_amount NUMERIC(10, 2),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "discounts" checked/created.');

    // Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Or SET NULL depending on policy
        status VARCHAR(50) NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        original_total_amount NUMERIC(10,2) NULL,
        discount_id INTEGER REFERENCES discounts(id) ON DELETE SET NULL,
        discount_code_applied VARCHAR(255),
        discount_amount_applied NUMERIC(10,2),
        shipping_address_line1 TEXT NOT NULL,
        shipping_address_line2 TEXT,
        shipping_city VARCHAR(100) NOT NULL,
        shipping_state_province_region VARCHAR(100),
        shipping_postal_code VARCHAR(20) NOT NULL,
        shipping_country VARCHAR(100) NOT NULL,
        billing_address_line1 TEXT,
        billing_address_line2 TEXT,
        billing_city VARCHAR(100),
        billing_state_province_region VARCHAR(100),
        billing_postal_code VARCHAR(20),
        billing_country VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "orders" checked/created.');

    // Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT, -- Prevent product deletion if in order
        product_variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT, -- Prevent variant deletion
        quantity INTEGER NOT NULL,
        price_at_purchase NUMERIC(10, 2) NOT NULL,
        CHECK (product_variant_id IS NOT NULL OR product_id IS NOT NULL) -- Ensure one is present
      );
    `);
    console.log('Table "order_items" checked/created.');

    // Purchase Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        order_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expected_delivery_date TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL, -- e.g., pending, ordered, partially_received, received, cancelled
        notes TEXT,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
        product_variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT,
        quantity_ordered INTEGER NOT NULL,
        quantity_received INTEGER DEFAULT 0 NOT NULL,
        unit_cost_price NUMERIC(10, 2) NOT NULL,
        currency_code VARCHAR(3),
        base_currency_cost_price NUMERIC(12, 2) NULL,
        exchange_rate_at_receipt NUMERIC(12, 6) NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CHECK (product_variant_id IS NOT NULL OR product_id IS NOT NULL)
      );
    `);
    console.log('Table "purchase_order_items" checked/created.');

    // Stock Movement Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_movement_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE, -- Nullable if movement is for base product
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- User who performed/triggered action
        movement_type VARCHAR(50) NOT NULL, -- e.g., 'po_receipt', 'sale_deduction', 'manual_adjustment', 'initial_stock_setup', 'write_off', 'damage', 'stock_take_increase', 'stock_take_decrease'
        quantity_changed INTEGER NOT NULL, -- Positive for increase, negative for decrease
        new_quantity_on_hand INTEGER NOT NULL,
        reason TEXT,
        reference_id VARCHAR(255), -- e.g., order_id, po_item_id, adjustment_batch_id
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Not typically updated, but for consistency
        CHECK ((variant_id IS NOT NULL AND product_id IS NOT NULL) OR (variant_id IS NULL AND product_id IS NOT NULL)) -- Ensure product_id is always there, variant_id is optional but requires product_id
      );
    `);
    console.log('Table "stock_movement_logs" checked/created.');

    // Product Cost History Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_cost_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE, -- Nullable
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        currency_code VARCHAR(3),
        cost_price NUMERIC(10, 2) NOT NULL,
        quantity_received INTEGER NOT NULL,
        purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE SET NULL,
        effective_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        base_currency_cost_price NUMERIC(12, 2) NULL,
        exchange_rate_at_receipt NUMERIC(12, 6) NULL,
        CHECK ((variant_id IS NOT NULL AND product_id IS NOT NULL) OR (variant_id IS NULL AND product_id IS NOT NULL))
      );
    `);
    console.log('Table "product_cost_history" checked/created.');

    console.log('Schema creation process completed.');
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error; // Re-throw to be caught by seedDatabase and potentially rollback
  }
}

// Local helper function for updating product average ratings (copied from adminReviews.js context)
async function updateProductAverageRating(productId, client) {
  try {
    const avgRatingResult = await client.query(
      `SELECT AVG(rating) as average_rating, COUNT(id) as review_count
       FROM product_reviews
       WHERE product_id = $1 AND status = 'approved'`,
      [productId]
    );

    let averageRating = 0;
    let reviewCount = 0;

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
    // Do not re-throw here to allow other seeding operations to continue
  }
}


async function seedAdminUser(client, seededDataIds) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const saltRounds = 10;
  const adminName = 'Admin User';

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
    console.error(`Error seeding admin user ${adminEmail}:`, error);
    throw error;
  }
}

async function seedRegularUsers(client, seededDataIds) {
  const saltRounds = 10;
  seededDataIds.regularUserIds = [];

  const usersToSeed = [
    { name: 'Sample User One', email: 'user1@example.com', password: 'password123', role: 'user' },
    { name: 'Sample User Two', email: 'user2@example.com', password: 'password123', role: 'user' },
  ];

  console.log('Seeding regular users...');
  for (const userData of usersToSeed) {
    try {
      const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);
      if (checkUser.rows.length > 0) {
        const userId = checkUser.rows[0].id;
        seededDataIds.regularUserIds.push(userId);
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
        const userId = result.rows[0].id;
        seededDataIds.regularUserIds.push(userId);
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
        if (optionResult.rows.length === 0) {
            console.error(`Failed to create or find '${opt.name}' option. Skipping its values.`);
            continue;
        }
        optionId = optionResult.rows[0].id;
        console.log(`Product option "${opt.name}" already exists with ID ${optionId}.`);
      }
      const optionKey = `${opt.name.toLowerCase()}OptionId`;
      seededDataIds.options[optionKey] = optionId;

      const valuesKey = opt.name.toLowerCase();
      seededDataIds.optionValues[valuesKey] = seededDataIds.optionValues[valuesKey] || {};

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
           if (valueResult.rows.length === 0) {
                console.error(`Failed to create or find value '${value}' for option '${opt.name}'.`);
                continue;
           }
          valueId = valueResult.rows[0].id;
          console.log(`Value "${value}" for option "${opt.name}" already exists with ID ${valueId}.`);
        }
        const valueKey = value.toLowerCase();
        seededDataIds.optionValues[valuesKey][`${valueKey}Id`] = valueId;
      }
    }
    console.log('Specific global product options and values seeding completed.');
  } catch (error) {
    console.error('Error seeding specific global product options and values:', error);
    throw error;
  }
}


async function seedSuppliers(client, seededDataIds) { // Added seededDataIds for consistency, might need supplier IDs later
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
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET
           contact_person = EXCLUDED.contact_person,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           currency_code = EXCLUDED.currency_code,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [supplier.name, supplier.contact_person, supplier.email, supplier.phone, supplier.currency_code]
      );
      if (result.rows.length > 0) {
        seededDataIds.suppliers[supplier.name] = result.rows[0].id;
        console.log(`Supplier "${supplier.name}" seeded/updated successfully with ID ${result.rows[0].id}.`);
      } else {
        // If ON CONFLICT DO NOTHING and it existed, we need to fetch it if we need the ID
        result = await client.query('SELECT id FROM suppliers WHERE name = $1', [supplier.name]);
        if (result.rows.length > 0) {
          seededDataIds.suppliers[supplier.name] = result.rows[0].id;
          console.log(`Supplier "${supplier.name}" already exists with ID ${result.rows[0].id}.`);
        }
      }
    }
    console.log('Supplier seeding completed.');
  } catch (error) {
    console.error('Error seeding suppliers:', error);
    throw error;
  }
}

async function seedCategories(client) {
  const sampleCategories = [
    'Apparel', 'Accessories', 'Electronics', 'Footwear',
    'Home Goods', 'Books', 'Beauty', 'Sports & Outdoors', 'Digital Music', 'Toys & Games'
  ];

  console.log('Seeding categories...');
  try {
    for (const categoryName of sampleCategories) {
      const result = await client.query(
        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
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
    throw error;
  }
}

async function seedProducts(client, seededProductIds) {
  const sampleProducts = [
    {
      name: 'Wireless Bluetooth Headphones',
      description: 'High-fidelity wireless headphones with noise cancellation and 20-hour battery life.',
      price: 149.99, cost_price: 89.99, wholesale_price: 119.99,
      stock_quantity: 150, category_name: 'Electronics', supplier_name: 'Global Electronics Inc.',
      image_url: null, sku: 'HDPHN-WL-BT-001', reorder_threshold: 25,
      brand_manufacturer: 'AudioMax', supplier_reference: 'AM-HDPN-001', product_status: 'active',
      tags: ['Audio', 'Wireless', 'Gadget']
    },
    {
      name: 'Men\'s Classic Cotton T-Shirt',
      description: 'Comfortable and durable 100% cotton t-shirt, available in various colors.',
      price: 24.99, cost_price: 12.50, wholesale_price: 18.00,
      stock_quantity: 300, category_name: 'Apparel', supplier_name: 'Fashion Forward Ltd.',
      image_url: null, sku: 'TSHRT-MEN-COT-005', reorder_threshold: 50,
      brand_manufacturer: 'Basic Threads', supplier_reference: 'BT-TS-M-COT', product_status: 'active',
      tags: ['Clothing', 'Men', 'Summer'],
    },
    {
      name: 'Smart Home LED Bulb',
      description: 'Wi-Fi enabled smart LED bulb, compatible with Alexa and Google Assistant.',
      price: 19.99, cost_price: 9.00, wholesale_price: null, // No wholesale for this one
      stock_quantity: 200, category_name: 'Home Goods', supplier_name: 'Global Electronics Inc.',
      image_url: null, sku: 'SMBLB-LED-WIFI-012', reorder_threshold: 30,
      brand_manufacturer: 'ConnectHome', supplier_reference: 'CH-BLB-001', product_status: 'active',
      tags: ['Smart Home', 'Lighting']
    },
    {
      name: 'Modern Thriller Novel',
      description: 'A gripping thriller that will keep you on the edge of your seat.',
      price: 12.99, cost_price: 5.50, wholesale_price: 8.99,
      stock_quantity: 250, category_name: 'Books', supplier_name: null,
      image_url: null, sku: 'BOOK-THRILLER-001',
      brand_manufacturer: 'PageTurners Publishing', supplier_reference: null, product_status: 'active',
      tags: ['Thriller', 'Fiction', 'Suspense']
    }
  ];

  console.log('Seeding products...');
  try {
    for (const product of sampleProducts) {
      const categoryResult = await client.query('SELECT id FROM categories WHERE name = $1', [product.category_name]);
      if (categoryResult.rows.length === 0) {
        console.warn(`Category "${product.category_name}" not found for product "${product.name}". Skipping product.`);
        continue;
      }
      const categoryId = categoryResult.rows[0].id;

      let supplierId = null;
      if (product.supplier_name) {
        // Assuming supplier names are unique and seededDataIds.suppliers is populated by seedSuppliers
        supplierId = seededDataIds.suppliers[product.supplier_name];
        if (!supplierId) {
          console.warn(`Supplier ID for "${product.supplier_name}" not found in seededDataIds. Product will have no supplier.`);
        }
      }

      const productInsertResult = await client.query(
        `INSERT INTO products (name, description, price, stock_quantity, category_id, supplier_id, image_url, sku, reorder_threshold,
                                brand_manufacturer, supplier_reference, product_status, cost_price, wholesale_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, stock_quantity = EXCLUDED.stock_quantity,
           category_id = EXCLUDED.category_id, supplier_id = EXCLUDED.supplier_id, image_url = EXCLUDED.image_url,
           reorder_threshold = EXCLUDED.reorder_threshold, brand_manufacturer = EXCLUDED.brand_manufacturer,
           supplier_reference = EXCLUDED.supplier_reference, product_status = EXCLUDED.product_status,
           cost_price = EXCLUDED.cost_price, wholesale_price = EXCLUDED.wholesale_price, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [
          product.name, product.description, product.price, product.stock_quantity,
          categoryId, supplierId, product.image_url, product.sku, product.reorder_threshold || 0,
          product.brand_manufacturer, product.supplier_reference, product.product_status || 'active',
          product.cost_price, product.wholesale_price
        ]
      );

      let productId;
      if (productInsertResult.rows.length > 0) {
          productId = productInsertResult.rows[0].id;
          console.log(`Product "${product.name}" (SKU: ${product.sku}) seeded/updated successfully with ID ${productId}.`);
      } else {
          const existingProduct = await client.query('SELECT id FROM products WHERE sku = $1', [product.sku]);
          if (existingProduct.rows.length > 0) {
              productId = existingProduct.rows[0].id;
              console.log(`Product with SKU "${product.sku}" already exists with ID ${productId} (fetched by fallback).`);
          } else {
              console.error(`CRITICAL: Failed to seed or find product with SKU ${product.sku}. This product cannot be used for variant seeding.`);
              continue;
          }
      }

      if (productId && product.sku) {
        seededProductIds[product.sku] = productId;
      }

      if (productId && product.tags && product.tags.length > 0) {
        for (const tagName of product.tags) {
          const tagResult = await client.query(
            'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id;',
            [tagName]
          );
          const tagId = tagResult.rows[0].id;
          await client.query(
            'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
            [productId, tagId]
          );
        }
      }
    }
    console.log('Product seeding completed.');
  } catch (error) {
    console.error('Error seeding products:', error);
    throw error;
  }
}

async function seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure) {
  console.log('Seeding product option configurations...');
  if (!seededDataIds.options || !seededDataIds.optionValues || Object.keys(seededDataIds.options).length === 0) {
    console.error("Global options/values IDs not available in seededDataIds. Skipping product option configuration.");
    return;
  }
  const { colorOptionId, sizeOptionId } = seededDataIds.options;
  const { color: colorValues, size: sizeValues } = seededDataIds.optionValues;

  if (!colorOptionId || !sizeOptionId || !colorValues || Object.keys(colorValues).length === 0 || !sizeValues || Object.keys(sizeValues).length === 0) {
    console.error("Color or Size option/values IDs are missing or not fully populated. Skipping configuration.");
    return;
  }

  const configurations = [
    {
      sku: productSkusToConfigure[0],
      options: [
        {
          optionId: colorOptionId,
          allowedValueIds: [colorValues.redId, colorValues.blueId]
        },
        {
          optionId: sizeOptionId,
          allowedValueIds: [sizeValues.smallId, sizeValues.mediumId]
        },
      ]
    },
    {
      sku: productSkusToConfigure[1],
      options: [
        {
          optionId: colorOptionId,
          allowedValueIds: [colorValues.greenId, colorValues.blueId]
        },
      ]
    }
  ];

  for (const config of configurations) {
    const productId = seededDataIds.products[config.sku];
    if (!productId) {
      console.warn(`Product with SKU ${config.sku} not found in seededProductIds. Skipping its option configuration.`);
      continue;
    }
    console.log(`Configuring options for Product ID: ${productId} (SKU: ${config.sku})`);

    await client.query('UPDATE products SET has_variants = TRUE WHERE id = $1', [productId]);
    console.log(`Marked product ID ${productId} as has_variants = true.`);

    for (const optConfig of config.options) {
      if (!optConfig.optionId || !optConfig.allowedValueIds || optConfig.allowedValueIds.length === 0) {
          console.warn(`Skipping invalid option configuration for product ${productId}:`, optConfig);
          continue;
      }
      const assignedOptResult = await client.query(
        `INSERT INTO product_assigned_options (product_id, option_id)
         VALUES ($1, $2)
         ON CONFLICT (product_id, option_id) DO UPDATE SET option_id = EXCLUDED.option_id RETURNING id;`,
        [productId, optConfig.optionId]
      );
      const assignedOptionId = assignedOptResult.rows[0]?.id;

      if (!assignedOptionId) {
        console.error(`Failed to assign option ID ${optConfig.optionId} to product ID ${productId}. Skipping its values.`);
        continue;
      }
      console.log(`Assigned option ID ${optConfig.optionId} to product ID ${productId} (Assigned ID: ${assignedOptionId}).`);

      for (const valueId of optConfig.allowedValueIds) {
        if (!valueId) {
            console.warn(`Undefined valueId found for product ${productId}, option ${optConfig.optionId}. Skipping.`);
            continue;
        }
        await client.query(
          `INSERT INTO product_assigned_option_values (product_assigned_option_id, option_value_id)
           VALUES ($1, $2)
           ON CONFLICT (product_assigned_option_id, option_value_id) DO NOTHING;`,
          [assignedOptionId, valueId]
        );
        console.log(`  - Allowed value ID ${valueId} for assigned option ID ${assignedOptionId}.`);
      }
    }
  }
  console.log('Product option configurations seeding completed.');
}

async function seedProductVariants(client, seededDataIds) {
    console.log('Seeding product variants...');
    if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 ||
        !seededDataIds.optionValues || Object.keys(seededDataIds.optionValues).length === 0) {
        console.error("Product IDs or global option value IDs not available. Skipping product variant seeding.");
        return;
    }

    const variantsToSeed = [
        {
            baseProductSku: 'TSHRT-MEN-COT-005', // T-Shirt
            variantSku: 'TSHRT-RD-S',
            price_modifier: 0.00, cost_price: 12.50, wholesale_price_modifier: -1.00,
            stock_quantity: 10, image_url: 'https://via.placeholder.com/300x300.png?text=T-Shirt+Red+S',
            optionValueMapping: [ { option: 'color', valueKey: 'redId' }, { option: 'size', valueKey: 'smallId' } ]
        },
        {
            baseProductSku: 'TSHRT-MEN-COT-005',
            variantSku: 'TSHRT-BL-M',
            price_modifier: 1.50, cost_price: 13.00, wholesale_price_modifier: -0.50,
            stock_quantity: 7, image_url: 'https://via.placeholder.com/300x300.png?text=T-Shirt+Blue+M',
            optionValueMapping: [ { option: 'color', valueKey: 'blueId' }, { option: 'size', valueKey: 'mediumId' } ]
        },
        {
            baseProductSku: 'HDPHN-WL-BT-001', // Headphones
            variantSku: 'HDPHN-GRN',
            price_modifier: 5.00, cost_price: 92.00, wholesale_price_modifier: 2.00,
            stock_quantity: 20, image_url: 'https://via.placeholder.com/300x300.png?text=Headphones+Green',
            optionValueMapping: [ { option: 'color', valueKey: 'greenId' } ]
        },
    ];
    seededDataIds.variants = seededDataIds.variants || {};

    try {
        for (const variantData of variantsToSeed) {
            const productId = seededDataIds.products[variantData.baseProductSku]; // Corrected to productId
            if (!productId) {
                console.warn(`Base product with SKU ${variantData.baseProductSku} not found. Skipping variant ${variantData.variantSku}.`);
                continue;
            }

            const optionValueIdsForVariant = variantData.optionValueMapping.map(map => {
                return seededDataIds.optionValues[map.option]?.[map.valueKey];
            }).filter(id => id);

            if (optionValueIdsForVariant.length !== variantData.optionValueMapping.length) {
                console.warn(`Could not resolve all option value IDs for variant ${variantData.variantSku}. Skipping.`);
                continue;
            }

            console.log(`Processing variant ${variantData.variantSku} for product ID ${productId}`);

            const variantResult = await client.query(
                `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, wholesale_price_modifier)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (sku) DO UPDATE SET
                   price_modifier = EXCLUDED.price_modifier,
                   stock_quantity = EXCLUDED.stock_quantity,
                   image_url = EXCLUDED.image_url,
                   cost_price = EXCLUDED.cost_price,
                   wholesale_price_modifier = EXCLUDED.wholesale_price_modifier,
                   updated_at = CURRENT_TIMESTAMP
                 RETURNING id;`,
                [productId, variantData.variantSku, variantData.price_modifier, variantData.stock_quantity, variantData.image_url, variantData.cost_price, variantData.wholesale_price_modifier]
            );

            let variantId;
            if (variantResult.rows.length > 0) {
                variantId = variantResult.rows[0].id;
                 console.log(`  - Variant ${variantData.variantSku} created/updated with ID ${variantId}.`);
            } else {
                const existingVariant = await client.query('SELECT id FROM product_variants WHERE sku = $1', [variantData.variantSku]);
                if (existingVariant.rows.length > 0) {
                    variantId = existingVariant.rows[0].id;
                    console.log(`  - Variant ${variantData.variantSku} confirmed existing with ID ${variantId}.`);
                } else {
                    console.error(`  - CRITICAL: Failed to create or find variant with SKU ${variantData.variantSku}.`);
                    continue;
                }
            }

            if (variantId) {
                for (const ovId of optionValueIdsForVariant) {
                    await client.query(
                        `INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id)
                         VALUES ($1, $2)
                         ON CONFLICT (product_variant_id, product_option_value_id) DO NOTHING;`,
                        [variantId, ovId]
                    );
                    console.log(`    - Linked option value ID ${ovId} to variant ID ${variantId}.`);
                }
            }
        }
        console.log('Product variant seeding completed.');
    } catch (error) {
        console.error('Error seeding product variants:', error);
        throw error;
    }
}

async function seedProductReviews(client, seededDataIds) {
    console.log('Seeding product reviews...');
    if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 ||
        !seededDataIds.users || (!seededDataIds.users.adminUserId && (!seededDataIds.users.regularUserIds || seededDataIds.users.regularUserIds.length === 0))) {
        console.error("Product or User IDs not available. Skipping review seeding.");
        return;
    }

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
            if (reviewData.userIdKey === 'adminUserId') {
                userId = seededDataIds.users.adminUserId;
            } else if (reviewData.userIdKey.startsWith('regularUserIds[')) {
                const index = parseInt(reviewData.userIdKey.match(/\[(\d+)\]/)[1], 10);
                userId = seededDataIds.users.regularUserIds?.[index];
            }

            if (!productId) {
                console.warn(`Product with SKU ${reviewData.productSku} not found for review. Skipping.`);
                continue;
            }
            if (!userId) {
                console.warn(`User with key ${reviewData.userIdKey} not found for review on product ${reviewData.productSku}. Skipping.`);
                continue;
            }

            console.log(`Seeding review for product ID ${productId} by user ID ${userId}.`);
            await client.query(
                `INSERT INTO product_reviews (product_id, user_id, rating, title, comment, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (product_id, user_id) DO NOTHING;`,
                [productId, userId, reviewData.rating, reviewData.title, reviewData.comment, reviewData.status]
            );
            reviewedProductIds.add(productId);
        }

        // Update average ratings for all affected products
        console.log('Updating average ratings for products with new reviews...');
        for (const productId of reviewedProductIds) {
            await updateProductAverageRating(productId, client);
        }

        console.log('Product review seeding completed.');
    } catch (error) {
        console.error('Error seeding product reviews:', error);
        throw error; // Re-throw to be caught by seedDatabase transaction
    }
}


async function seedDatabase() {
  console.log('Starting database seeding...');
  let client; // Declare client here to be available in finally block
  try {
    client = await pool.connect();
    await createSchema(client); // Call schema creation first

    await client.query('BEGIN'); // Start transaction for data seeding

    const seededDataIds = { users: {}, options: {}, optionValues: {}, products: {} };
    await seedAdminUser(client, seededDataIds.users);
    await seedRegularUsers(client, seededDataIds.users);
    await seedCategories(client);
    await seedSuppliers(client, seededDataIds); // Pass seededDataIds
    await seedSpecificGlobalOptionsAndValues(client, seededDataIds);
    await seedProducts(client, seededDataIds); // Pass seededDataIds (already was, now for suppliers)

    const productSkusToConfigure = ['TSHRT-MEN-COT-005', 'HDPHN-WL-BT-001'];
    if (Object.keys(seededDataIds.products).length > 0 &&
        seededDataIds.options.colorOptionId && seededDataIds.options.sizeOptionId) {
      await seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure);
      await seedProductVariants(client, seededDataIds);
    } else {
      console.warn("Skipping product option configurations and variant seeding due to missing product IDs or global option/value IDs.");
    }

    await seedProductImages(client, seededDataIds);
    await seedProductReviews(client, seededDataIds);
    // Seed new tables after products/variants and users are created
    await seedCostHistory(client, seededDataIds);
    await seedStockMovements(client, seededDataIds);


    console.log('Database seeding completed successfully.');
    console.log('IDs of critical seeded data:', JSON.stringify(seededDataIds, null, 2));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
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

// --- New Seeding Functions ---

async function seedProductImages(client, seededDataIds) {
  console.log('Seeding product images...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0) {
    console.warn("Product IDs not available. Skipping product image seeding.");
    return;
  }

  const imagesToSeed = [
    {
      productSku: 'HDPHN-WL-BT-001',
      images: [
        { image_url: 'https://via.placeholder.com/600x600.png?text=Headphones+Gallery+1', alt_text: 'Headphones Side View', display_order: 1, is_primary: true },
        { image_url: 'https://via.placeholder.com/600x600.png?text=Headphones+Gallery+2', alt_text: 'Headphones Front View', display_order: 2, is_primary: false },
      ]
    },
    {
      productSku: 'TSHRT-MEN-COT-005',
      images: [
        { image_url: 'https://via.placeholder.com/600x600.png?text=T-Shirt+Gallery+1', alt_text: 'T-Shirt Front', display_order: 1, is_primary: true },
      ]
    }
  ];

  try {
    for (const productImageData of imagesToSeed) {
      const productId = seededDataIds.products[productImageData.productSku];
      if (!productId) {
        console.warn(`Product with SKU ${productImageData.productSku} not found for image seeding. Skipping.`);
        continue;
      }

      let primaryImageUrlForProduct = null;

      for (const img of productImageData.images) {
        const result = await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (product_id, image_url) DO NOTHING RETURNING id, image_url, is_primary;`,
          [productId, img.image_url, img.alt_text, img.display_order, img.is_primary]
        );
        if (result.rows.length > 0 && result.rows[0].is_primary) {
          primaryImageUrlForProduct = result.rows[0].image_url;
        }
        console.log(`Seeded image "${img.alt_text}" for product ID ${productId}.`);
      }

      if (primaryImageUrlForProduct) {
        await client.query('UPDATE products SET image_url = $1 WHERE id = $2', [primaryImageUrlForProduct, productId]);
        console.log(`Updated main image_url for product ID ${productId} to ${primaryImageUrlForProduct}.`);
      }
    }
    console.log('Product images seeding completed.');
  } catch (error) {
    console.error('Error seeding product images:', error);
    // Do not re-throw to allow other seeding to continue if non-critical
  }
}

async function seedStockMovements(client, seededDataIds) {
  console.log('Seeding stock movements...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 || !seededDataIds.users.adminUserId) {
    console.warn("Product IDs or Admin User ID not available. Skipping stock movement seeding.");
    return;
  }

  const productId1 = seededDataIds.products['HDPHN-WL-BT-001']; // Headphones
  const variantId1_1 = seededDataIds.variants ? seededDataIds.variants['HDPHN-GRN'] : null; // Green Headphones variant
  const productId2 = seededDataIds.products['TSHRT-MEN-COT-005']; // T-shirt
  const adminUserId = seededDataIds.users.adminUserId;

  const movements = [];

  if (productId1) {
    movements.push({
        product_id: productId1, variant_id: null, user_id: adminUserId, movement_type: 'initial_stock_setup',
        quantity_changed: 150, new_quantity_on_hand: 150, reason: 'Initial stock from seed'
    });
    movements.push({
        product_id: productId1, variant_id: null, user_id: adminUserId, movement_type: 'stock_take_decrease',
        quantity_changed: -5, new_quantity_on_hand: 145, reason: 'Stock count adjustment'
    });
  }
  if (variantId1_1) { // Assuming HDPHN-GRN was seeded and its ID captured in seededDataIds.variants
     movements.push({
        product_id: productId1, variant_id: variantId1_1, user_id: adminUserId, movement_type: 'po_receipt',
        quantity_changed: 10, new_quantity_on_hand: 20, reason: 'PO #123 Receipt', reference_id: 'poitem_placeholder_1'
    });
  }
   if (productId2) {
    movements.push({
        product_id: productId2, variant_id: null, user_id: adminUserId, movement_type: 'sale_deduction',
        quantity_changed: -2, new_quantity_on_hand: 298, reason: 'Order #XYZ Sale', reference_id: 'order_placeholder_1'
    });
  }

  try {
    for (const move of movements) {
      await client.query(
        `INSERT INTO stock_movement_logs
          (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING;`,
        [move.product_id, move.variant_id, move.user_id, move.movement_type, move.quantity_changed, move.new_quantity_on_hand, move.reason, move.reference_id]
      );
    }
    console.log(`${movements.length} stock movements seeded.`);
  } catch (error) {
    console.error('Error seeding stock movements:', error);
  }
}

async function seedCostHistory(client, seededDataIds) {
  console.log('Seeding product cost history...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0 || !seededDataIds.suppliers || Object.keys(seededDataIds.suppliers).length === 0) {
    console.warn("Product IDs or Supplier IDs not available. Skipping cost history seeding.");
    return;
  }

  const supplierId1 = seededDataIds.suppliers['Global Electronics Inc.'];
  const productId1 = seededDataIds.products['HDPHN-WL-BT-001']; // Headphones
  const variantId1_1 = seededDataIds.variants ? seededDataIds.variants['HDPHN-GRN'] : null; // Green Headphones variant

  const historyEntries = [];

  if (productId1 && supplierId1) {
    historyEntries.push({
        product_id: productId1, variant_id: null, supplier_id: supplierId1, currency_code: 'USD', cost_price: 85.00, quantity_received: 50,
        purchase_order_item_id: null, effective_date: '2023-01-15T00:00:00Z', base_currency_cost_price: 85.00, exchange_rate_at_receipt: 1.0
    });
    historyEntries.push({
        product_id: productId1, variant_id: null, supplier_id: supplierId1, currency_code: 'USD', cost_price: 87.50, quantity_received: 100,
        purchase_order_item_id: null, effective_date: '2023-03-20T00:00:00Z', base_currency_cost_price: 87.50, exchange_rate_at_receipt: 1.0
    });
  }
  if (variantId1_1 && supplierId1 && productId1) { // productId1 here refers to the parent product of variantId1_1
     historyEntries.push({
        product_id: productId1, variant_id: variantId1_1, supplier_id: supplierId1, currency_code: 'USD', cost_price: 92.00, quantity_received: 20,
        purchase_order_item_id: null, effective_date: '2023-04-10T00:00:00Z', base_currency_cost_price: 92.00, exchange_rate_at_receipt: 1.0
    });
  }

  try {
    for (const entry of historyEntries) {
      await client.query(
        `INSERT INTO product_cost_history
          (product_id, variant_id, supplier_id, currency_code, cost_price, quantity_received,
           purchase_order_item_id, effective_date, base_currency_cost_price, exchange_rate_at_receipt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING;`,
        [entry.product_id, entry.variant_id, entry.supplier_id, entry.currency_code, entry.cost_price, entry.quantity_received,
         entry.purchase_order_item_id, entry.effective_date, entry.base_currency_cost_price, entry.exchange_rate_at_receipt]
      );
    }
    console.log(`${historyEntries.length} product cost history entries seeded.`);
  } catch (error) {
    console.error('Error seeding product cost history:', error);
  }
}

[end of backend/seed.js]
