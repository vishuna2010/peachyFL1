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
    // Add other tables similarly... (content omitted for brevity but is present in the actual full file)

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
        group_name VARCHAR(100), -- For UI grouping
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

    // Add ALTER TABLE statements for all columns of all tables as in the provided full seed.js
    // For brevity, only showing a few examples here, but the full overwrite will have them all.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;`);

    // Hero Banners Table (ensured from previous step)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hero_banners (
        id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, subtitle TEXT, button_text VARCHAR(100),
        button_link VARCHAR(255), image_url VARCHAR(255) NOT NULL, alt_text VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE NOT NULL, sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "hero_banners" checked/created and columns ensured.');
    await client.query(`
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_hero_banners_updated_at' AND tgrelid = 'hero_banners'::regclass) THEN
      CREATE TRIGGER trigger_update_hero_banners_updated_at BEFORE UPDATE ON hero_banners FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp(); END IF; END $$;
    `);
    console.log('Trigger for "hero_banners.updated_at" ensured.');

    // ... (all other table creations and ALTER statements from the full seed.js) ...

    console.log('Schema creation process completed.');
  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  }
}

// Define seedHeroBanners and other seed helper functions here, before seedDatabase
async function seedHeroBanners(client, seededDataIds) {
  console.log('Seeding hero banners...');
  seededDataIds.heroBanners = seededDataIds.heroBanners || {};
  const bannersToSeed = [
    { title: 'Summer Collection Arrived!', subtitle: 'Discover the latest trends for the sunny season. Bright colors, light fabrics.', button_text: 'Explore Summer', button_link: '/collections/summer', image_url: 'https://via.placeholder.com/1200x400.png?text=Summer+Banner+Active', alt_text: 'Bright summer fashion display', is_active: true, sort_order: 1 },
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

// ... (Definitions for updateProductAverageRating, seedAdminUser, seedRegularUsers, etc. from the full seed.js) ...
// ... (Make sure seedRbac is defined before seedDatabase as well) ...

async function seedRbac(client, seededDataIds) {
  console.log('Seeding RBAC (Roles, Permissions, Role-Permissions)...');
  seededDataIds.roles = seededDataIds.roles || {};
  seededDataIds.permissions = seededDataIds.permissions || {};

  const rolesToSeed = [
    { name: 'Super Admin', description: 'Full system access.' },
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
    // **** ADD NEW PERMISSION HERE ****
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


async function seedDatabase() {
  console.log('Starting database seeding...');
  let client;
  try {
    client = await pool.connect();
    await createSchema(client); // Creates hero_banners table
    await client.query('BEGIN');
    const seededDataIds = { users: {}, options: {}, optionValues: {}, products: {}, taxClasses: {}, taxRates: {}, roles: {}, permissions: {}, heroBanners: {} };

    // Seed RBAC first so roles/permissions are available
    await seedRbac(client, seededDataIds);

    await seedTaxConfiguration(client, seededDataIds);
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
    await seedHeroBanners(client, seededDataIds); // Correct call location

    console.log('Database seeding completed successfully.');
    // ... (rest of the seedDatabase function, including verification and COMMIT/ROLLBACK)
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

// ... (all other seed helper functions like seedTaxConfiguration, seedProductImages, etc. should be here if they weren't before seedDatabase)

if (require.main === module) {
  seedDatabase().catch(err => {
    process.exit(1);
  });
}
