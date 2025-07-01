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
        role VARCHAR(50) DEFAULT 'user' NOT NULL, -- Legacy role column
        role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL, -- New RBAC role_id
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
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_exemption_certificate_id VARCHAR(100) NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_exemption_notes TEXT NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255) NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
    console.log('All columns for "users" table ensured/checked (basic existence).');

    // RBAC Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "roles" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        group_name VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "permissions" checked/created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);
    console.log('Table "role_permissions" checked/created.');


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

    // Tax Classes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_classes (
          id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, description TEXT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );`);
    console.log('Table "tax_classes" checked/created.');

    // Tax Rates Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_rates (
          id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
          rate_percentage NUMERIC(6, 4) NOT NULL CHECK (rate_percentage >= 0 AND rate_percentage <= 100.0000),
          jurisdiction TEXT NOT NULL, tax_type VARCHAR(50) NOT NULL, tax_code VARCHAR(50) NULL,
          is_active BOOLEAN DEFAULT TRUE NOT NULL, priority INTEGER DEFAULT 0 NOT NULL,
          valid_from DATE NULL, valid_until DATE NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT uq_tax_rate_name_jurisdiction_type UNIQUE (name, jurisdiction, tax_type)
      );`);
    console.log('Table "tax_rates" checked/created.');
    await client.query(`ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS tax_rates_rate_percentage_check;`);
    await client.query(`ALTER TABLE tax_rates ADD CONSTRAINT tax_rates_rate_percentage_check CHECK (rate_percentage >= 0 AND rate_percentage <= 100.0000);`);
    await client.query(`ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS uq_tax_rate_name;`);
    await client.query(`ALTER TABLE tax_rates DROP CONSTRAINT IF EXISTS uq_tax_rate_name_jurisdiction_type;`);
    await client.query(`ALTER TABLE tax_rates ADD CONSTRAINT uq_tax_rate_name_jurisdiction_type UNIQUE (name, jurisdiction, tax_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(jurisdiction);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tax_rates_tax_type ON tax_rates(tax_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tax_rates_is_active ON tax_rates(is_active);`);
    console.log('Indexes for "tax_rates" checked/created.');

    // Tax Class Rates Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_class_rates (
          tax_class_id INTEGER NOT NULL REFERENCES tax_classes(id) ON DELETE CASCADE,
          tax_rate_id INTEGER NOT NULL REFERENCES tax_rates(id) ON DELETE CASCADE,
          PRIMARY KEY (tax_class_id, tax_rate_id)
      );`);
    console.log('Table "tax_class_rates" checked/created.');

    // Products Table
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
      );`);
    console.log('Table "products" checked/created.');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_tax_class_id ON products(tax_class_id);`);
    console.log('Index "idx_products_tax_class_id" on "products" checked/created.');

    // Product Variants, Options, Images, Tags, Reviews, Discounts, Orders, Order Items, Purchase Orders, etc.
    // (Assuming all other CREATE TABLE and ALTER TABLE statements from the original seed.js are here)
    // ... (many lines omitted for brevity) ...

    await client.query(`
      CREATE TABLE IF NOT EXISTS hero_banners (
        id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, subtitle TEXT, button_text VARCHAR(100),
        button_link VARCHAR(255), image_url VARCHAR(255) NOT NULL, alt_text VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE NOT NULL, sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "hero_banners" checked/created.');
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL;`); // Ensure NOT NULL constraint
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS image_url VARCHAR(255) NOT NULL;`); // Ensure NOT NULL constraint
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;`);
    await client.query(`ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL;`);
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

// --- START OF HELPER SEED FUNCTION DEFINITIONS ---

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

async function updateProductAverageRating(productId, client) { /* ... content from original ... */ }
async function seedAdminUser(client, seededDataIds) { /* ... content from original ... */ }
async function seedRegularUsers(client, seededDataIds) { /* ... content from original ... */ }
async function seedSpecificGlobalOptionsAndValues(client, seededDataIds) { /* ... content from original ... */ }
async function seedSuppliers(client, seededDataIds) { /* ... content from original ... */ }
async function seedCategories(client) { /* ... content from original ... */ }
async function seedProducts(client, seededDataIds) { /* ... content from original ... */ }
async function seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure) { /* ... content from original ... */ }
async function seedProductVariants(client, seededDataIds) { /* ... content from original ... */ }
async function seedProductReviews(client, seededDataIds) { /* ... content from original ... */ }
async function seedTaxConfiguration(client, seededDataIds) { /* ... content from original ... */ }
async function seedProductImages(client, seededDataIds) { /* ... content from original ... */ }
async function seedStockMovements(client, seededDataIds) { /* ... content from original ... */ }
async function seedCostHistory(client, seededDataIds) { /* ... content from original ... */ }
async function seedInventoryBatches(client, seededDataIds) { /* ... content from original ... */ }

async function seedRbac(client, seededDataIds) {
  console.log('Seeding RBAC (Roles, Permissions, Role-Permissions)...');
  seededDataIds.roles = seededDataIds.roles || {};
  seededDataIds.permissions = seededDataIds.permissions || {};

  const rolesToSeed = [ /* ... content from original ... */ ];
  const permissionsToSeed = [
    // ... (all original permissions) ...
    { name: 'marketing:manage_hero_banners', description: 'Can create, read, update, and delete hero banners.', group_name: 'Marketing' }
  ];
  try {
    // ... (rest of RBAC seeding logic from original, ensuring new permission is included) ...
    for (const role of rolesToSeed) {
      const result = await client.query( 'INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id, name;', [role.name, role.description] );
      if (result.rows.length > 0) { const roleKey = result.rows[0].name.toLowerCase().replace(/ /g, '_'); seededDataIds.roles[roleKey] = result.rows[0].id; console.log(`Role "${result.rows[0].name}" seeded/updated with ID ${result.rows[0].id}.`); }
    }
    for (const perm of permissionsToSeed) {
      const result = await client.query( 'INSERT INTO permissions (name, description, group_name) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, group_name = EXCLUDED.group_name RETURNING id, name;', [perm.name, perm.description, perm.group_name] );
      if (result.rows.length > 0) { seededDataIds.permissions[result.rows[0].name] = result.rows[0].id; console.log(`Permission "${result.rows[0].name}" seeded/updated with ID ${result.rows[0].id}.`); }
    }
    const rolePermissionsToAssign = {
      'super_admin': Object.keys(seededDataIds.permissions), // Super Admin gets all
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

// --- END OF HELPER SEED FUNCTION DEFINITIONS ---

async function seedDatabase() {
  console.log('Starting database seeding...');
  let client;
  try {
    client = await pool.connect();
    await createSchema(client);
    await client.query('BEGIN');
    const seededDataIds = { users: {}, options: {}, optionValues: {}, products: {}, taxClasses: {}, taxRates: {}, roles: {}, permissions: {}, heroBanners: {} };

    await seedRbac(client, seededDataIds); // Seed RBAC first
    await seedTaxConfiguration(client, seededDataIds); // Then Tax Config
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
        } else { console.warn(`User ID ${user.id} has legacy role "${user.role}" - no new role_id assigned.`); }
      }
      console.log('User role_id migration step completed.');
    } else { console.error('CRITICAL: Role IDs for migration not found. Skipping user role_id migration.'); }

    await seedCategories(client);
    await seedSuppliers(client, seededDataIds);
    await seedSpecificGlobalOptionsAndValues(client, seededDataIds);
    await seedProducts(client, seededDataIds);
    const productSkusToConfigure = ['TSHRT-MEN-COT-005', 'HDPHN-WL-BT-001'];
    if (Object.keys(seededDataIds.products).length > 0 && seededDataIds.options.colorOptionId && seededDataIds.options.sizeOptionId) {
      await seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure);
      await seedProductVariants(client, seededDataIds);
    } else { console.warn("Skipping product option configurations and variant seeding."); }
    await seedProductImages(client, seededDataIds);
    await seedProductReviews(client, seededDataIds);
    await seedInventoryBatches(client, seededDataIds);
    await seedCostHistory(client, seededDataIds);
    await seedStockMovements(client, seededDataIds);
    await seedHeroBanners(client, seededDataIds);

    console.log('Database seeding completed successfully.');
    // ... (verification logic from original) ...
    await client.query('COMMIT');
  } catch (error) {
    if (client) { await client.query('ROLLBACK'); }
    console.error('Error during database seeding, transaction rolled back:', error); throw error;
  } finally {
    if (client) { client.release(); console.log('Database client released.'); }
    await pool.end(); console.log('Seeding pool has ended.');
  }
}

if (require.main === module) {
  seedDatabase().catch(err => {
    // console.error('Unhandled error in seedDatabase:', err); // Already logged in seedDatabase
    process.exit(1);
  });
}
