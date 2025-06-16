const { Pool } = require('pg');

const placeholderConnectionString = 'postgresql://user:password@host:port/database';
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(`
    *****************************************************************************
    WARNING: DATABASE_URL environment variable is not set.
    Falling back to a placeholder connection string: ${placeholderConnectionString}
    Please create a backend/.env file and set DATABASE_URL for the application
    to connect to your actual database.
    *****************************************************************************
  `);
  connectionString = placeholderConnectionString;
}

const pool = new Pool({
  connectionString: connectionString,
});

pool.on('connect', () => {
  console.log('Connected to the database');
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    // --- Function to update updated_at timestamp ---
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Function "trigger_set_timestamp" created or replaced successfully.');

    // --- Users Table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'customer',
        two_fa_secret VARCHAR(255) NULL,
        is_two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "users" created or already exists.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users') THEN
          CREATE TRIGGER set_timestamp_users
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "users.updated_at" ensured.');
     // Backward compatibility for users table (name, updated_at)
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
      await client.query('UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;');
      console.log('Backward compatibility for "users" (name, updated_at) applied.');
    } catch (alterError) {
        // Ignore errors if columns already exist, etc.
    }


    // --- Categories Table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "categories" created or already exists.');
    await client.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
    await client.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_categories') THEN
          CREATE TRIGGER set_timestamp_categories
          BEFORE UPDATE ON categories
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "categories.updated_at" ensured.');

    // --- Tags Table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "tags" created or already exists.');
    await client.query('ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
    await client.query('ALTER TABLE tags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_tags') THEN
          CREATE TRIGGER set_timestamp_tags
          BEFORE UPDATE ON tags
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "tags.updated_at" ensured.');

    // --- Suppliers Table ---
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
    console.log('Table "suppliers" created or already exists.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_suppliers') THEN
          CREATE TRIGGER set_timestamp_suppliers
          BEFORE UPDATE ON suppliers
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "suppliers.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);');

    // --- Products Table ---
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
        has_variants BOOLEAN NOT NULL DEFAULT FALSE,
        average_rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
        review_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "products" created or already exists (with review fields).');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT FALSE;');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00;');
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;');
    console.log('Columns "products.has_variants", "average_rating", "review_count" ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_products') THEN
          CREATE TRIGGER set_timestamp_products
          BEFORE UPDATE ON products
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "products.updated_at" ensured.');
    // Indexes for products
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_stock_reorder ON products(stock_quantity, reorder_threshold);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);');


    // --- Product Tags (Junction Table) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, tag_id)
      );
    `);
    console.log('Table "product_tags" created or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON product_tags(tag_id);');


    // --- Product Options Table (as per existing schema: product-specific options) ---
    // This table is being redefined for GLOBAL options as per subtask requirements.
    // Previous version was product-specific.
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_options (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_options" (global) ensured/redefined.');
    // Attempt to drop old product_id specific index and constraint if they exist from a previous schema.
    // These will fail gracefully if they don't exist.
    try {
      await client.query('ALTER TABLE product_options DROP CONSTRAINT IF EXISTS uk_product_option_name;');
      await client.query('DROP INDEX IF EXISTS idx_option_product_id;');
      await client.query('ALTER TABLE product_options DROP COLUMN IF EXISTS product_id;');
      console.log('Cleaned up old product-specific fields/constraints from product_options if they existed.');
    } catch (cleanupError) {
      console.warn('Warning during product_options cleanup (may be benign if schema was already global):', cleanupError.message);
    }
    // Ensure the global unique constraint on name exists
    try {
        await client.query('ALTER TABLE product_options ADD CONSTRAINT product_options_name_key UNIQUE (name);');
        console.log('Ensured global unique constraint on product_options.name.');
    } catch (constraintError) {
        if (!constraintError.message.includes("already exists")) {
             console.warn('Warning ensuring unique constraint on product_options.name (may be benign):', constraintError.message);
        }
    }
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_product_options') THEN
          CREATE TRIGGER set_timestamp_product_options
          BEFORE UPDATE ON product_options
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_options.updated_at" ensured.');
    // No index on product_id anymore. Index on name is implicitly created by UNIQUE constraint.

    // --- Product Option Values Table ---
    // This table's structure is largely fine, references product_options.id
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_option_values (
        id SERIAL PRIMARY KEY,
        product_option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        value VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_option_value UNIQUE (product_option_id, value)
      );
    `);
    console.log('Table "product_option_values" ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_product_option_values') THEN
          CREATE TRIGGER set_timestamp_product_option_values
          BEFORE UPDATE ON product_option_values
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_option_values.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_option_value_product_option_id ON product_option_values(product_option_id);');

    // --- Product Variants Table ---
    // This table was found to already exist. Ensuring its definition and adding trigger.
    // Sticking to existing `product_id` and `price_modifier`.
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- Renamed from base_product_id for consistency with existing
        sku VARCHAR(100) UNIQUE NULL, -- Existing schema was 100
        price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- Kept existing price_modifier logic
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        image_url VARCHAR(255) NULL, -- Existing schema was 255
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "product_variants" ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_product_variants') THEN
          CREATE TRIGGER set_timestamp_product_variants
          BEFORE UPDATE ON product_variants
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_variants.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_variant_product_id ON product_variants(product_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_variant_sku ON product_variants(sku);');

    // --- Product Assigned Options Table (Links a product to a global option type) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_options (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_product_assigned_option UNIQUE (product_id, option_id)
      );
    `);
    console.log('Table "product_assigned_options" created or ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_product_assigned_options') THEN
          CREATE TRIGGER set_timestamp_product_assigned_options
          BEFORE UPDATE ON product_assigned_options
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_assigned_options.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pao_product_id ON product_assigned_options(product_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pao_option_id ON product_assigned_options(option_id);');

    // --- Product Assigned Option Values Table (Links specific global values to a product's assigned option) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_option_values (
        id SERIAL PRIMARY KEY,
        product_assigned_option_id INTEGER NOT NULL REFERENCES product_assigned_options(id) ON DELETE CASCADE,
        option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_product_assigned_option_value UNIQUE (product_assigned_option_id, option_value_id)
      );
    `);
    console.log('Table "product_assigned_option_values" created or ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_product_assigned_option_values') THEN
          CREATE TRIGGER set_timestamp_product_assigned_option_values
          BEFORE UPDATE ON product_assigned_option_values
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_assigned_option_values.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_paov_assigned_option_id ON product_assigned_option_values(product_assigned_option_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_paov_option_value_id ON product_assigned_option_values(option_value_id);');

    // --- Product Assigned Option Specific Values (NEW TABLE) ---
    // This table defines the specific subset of global option values that are applicable
    // for a particular product's assigned option type. E.g., for Product A's "Color" option,
    // only "Red" and "Blue" might be allowed from the global "Red", "Blue", "Green" values.
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_assigned_option_specific_values (
        id SERIAL PRIMARY KEY,
        product_assigned_option_id INTEGER NOT NULL REFERENCES product_assigned_options(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_assigned_option_id, product_option_value_id)
      );
    `);
    console.log('Table "product_assigned_option_specific_values" created or ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_paosv_updated_at') THEN
          CREATE TRIGGER trigger_update_paosv_updated_at
          BEFORE UPDATE ON product_assigned_option_specific_values
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_assigned_option_specific_values.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_paosv_assigned_option_id ON product_assigned_option_specific_values(product_assigned_option_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_paosv_option_value_id ON product_assigned_option_specific_values(product_option_value_id);');


    // --- Product Variant Option Values (Junction Table) ---
    // This table was found to already exist. Ensuring its definition.
    // This links a specific variant to a specific global option value.
    // It seems this table might be what `product_assigned_option_values` was intended to be by the subtask,
    // or there's a subtle difference in modeling.
    // The subtask's `product_assigned_option_values` links a *product's use of an option type* to a *global value*.
    // The existing `product_variant_option_values` links a *specific variant instance* to a *global value*.
    // These can coexist if the model is: Product -> AssignedOption (Color) -> AssignedOptionValue (Red), AssignedOptionValue (Blue)
    // And then Variant -> VariantOptionValue (pointing to global "Red" OptionValue).
    // For now, I will keep BOTH as per my interpretation of the subtask adding new tables.
    // The existing product_variant_option_values links a product_variant to a product_option_value. This is correct for defining a variant.
    // The new product_assigned_option_values links a product's *choice of available values for an option* to product_option_value.
    // This could be used, for example, if a T-Shirt product is assigned the "Color" option, and is made available only in "Red" and "Blue",
    // even if "Green" exists as a global value for "Color".
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variant_option_values (
        id SERIAL PRIMARY KEY,
        product_variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        product_option_value_id INTEGER NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
        CONSTRAINT uk_variant_option_value_combo UNIQUE (product_variant_id, product_option_value_id)
      );
    `);
    console.log('Table "product_variant_option_values" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pvov_variant_id ON product_variant_option_values(product_variant_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pvov_option_value_id ON product_variant_option_values(product_option_value_id);');

    // --- Discounts Table ---
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
    console.log('Table "discounts" created or already exists.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_discounts') THEN
          CREATE TRIGGER set_timestamp_discounts
          BEFORE UPDATE ON discounts
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "discounts.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_discounts_validity ON discounts(is_active, valid_from, valid_until);');

    // --- Orders Table ---
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
    console.log('Table "orders" created or already exists.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_orders') THEN
          CREATE TRIGGER set_timestamp_orders
          BEFORE UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "orders.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);');


    // --- Order Items Table ---
    // Note: product_variant_id FK needs product_variants table to exist.
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        product_variant_id INTEGER NULL REFERENCES product_variants(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price_at_purchase DECIMAL(10, 2) NOT NULL
      );
    `);
    console.log('Table "order_items" created or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_product_variant_id ON order_items(product_variant_id);');


    // --- Purchase Orders Table ---
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
    console.log('Table "purchase_orders" created or already exists.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_purchase_orders') THEN
          CREATE TRIGGER set_timestamp_purchase_orders
          BEFORE UPDATE ON purchase_orders
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "purchase_orders.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);');

    // --- Purchase Order Items Table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
        unit_cost_price DECIMAL(10, 2) NOT NULL,
        quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity_ordered)
        -- No created_at/updated_at on this table by design, changes are part of PO
      );
    `);
    console.log('Table "purchase_order_items" created or already exists.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_poi_purchase_order_id ON purchase_order_items(purchase_order_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_poi_product_id ON purchase_order_items(product_id);');

    // --- Product Reviews Table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255) NULL,
        comment TEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_product_user_review UNIQUE (product_id, user_id)
      );
    `);
    console.log('Table "product_reviews" created or ensured.');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_product_reviews') THEN
          CREATE TRIGGER set_timestamp_product_reviews
          BEFORE UPDATE ON product_reviews
          FOR EACH ROW
          EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END
      $$;
    `);
    console.log('Trigger for "product_reviews.updated_at" ensured.');
    await client.query('CREATE INDEX IF NOT EXISTS idx_review_product_id ON product_reviews(product_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_review_user_id ON product_reviews(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_review_status ON product_reviews(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_review_rating ON product_reviews(rating);');


    // Final check on users table role default (already present in original file, kept for safety)
    try {
      await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';");
    } catch (alterError) {
        // Benign if already set or other non-critical issues
    }

    console.log('All tables and triggers ensured.');

  } catch (err) {
    console.error('Error creating/altering tables or setting up triggers:', err.stack);
    // Consider re-throwing or handling more gracefully for startup
  } finally {
    client.release();
  }
};

createTables().catch(err => console.error('Failed to create tables on startup:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
