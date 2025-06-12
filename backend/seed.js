// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configure the database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: process.env.DB_SSL_REQUIRED === 'true' ? { rejectUnauthorized: false } : false, // Optional: Add SSL if your DB requires it and you have DB_SSL_REQUIRED in .env
});

pool.on('connect', () => {
  console.log('Connected to the database for seeding.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client for seeding', err);
  process.exit(-1);
});

async function seedAdminUser(client) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Ensure this is for dev only, not hardcoded for prod builds
  const saltRounds = 10; // Or use a value from config

  try {
    // Check if admin user already exists
    const checkUser = await client.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    if (checkUser.rows.length > 0) {
      console.log(`Admin user with email ${adminEmail} already exists. Skipping creation.`);
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    const adminName = 'Admin User'; // Default name for the admin

    await client.query(
      'INSERT INTO users (email, password, role, name) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name',
      [adminEmail, hashedPassword, 'admin', adminName]
    );
    console.log(`Admin user ${adminEmail} (Name: ${adminName}) processed for seeding.`);
  } catch (error) {
    console.error(`Error seeding admin user ${adminEmail}:`, error);
    throw error;
  }
}

async function seedSuppliers(client) {
  const sampleSuppliers = [
    { name: 'Global Electronics Inc.', contact_person: 'Jane Doe', email: 'jane.doe@globalelectronics.com', phone: '123-456-7890' },
    { name: 'Fashion Forward Ltd.', contact_person: 'John Smith', email: 'john.smith@fashionforward.com', phone: '098-765-4321' },
    { name: 'Home Comforts Co.', contact_person: 'Alice Brown', email: 'alice.brown@homecomforts.co', phone: '111-222-3333' },
  ];

  console.log('Seeding suppliers...');
  try {
    for (const supplier of sampleSuppliers) {
      const result = await client.query(
        `INSERT INTO suppliers (name, contact_person, email, phone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO NOTHING RETURNING id;`,
        [supplier.name, supplier.contact_person, supplier.email, supplier.phone]
      );
      if (result.rowCount > 0) {
        console.log(`Supplier "${supplier.name}" seeded successfully.`);
      } else {
        console.log(`Supplier "${supplier.name}" already exists or conflict occurred. Skipped.`);
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
    throw error; // Re-throw to be caught by seedDatabase's transaction logic
  }
}

async function seedProducts(client) {
  const sampleProducts = [
    {
      name: 'Wireless Bluetooth Headphones',
      description: 'High-fidelity wireless headphones with noise cancellation and 20-hour battery life.',
      price: 149.99,
      stock_quantity: 150,
      category_name: 'Electronics',
      supplier_name: 'Global Electronics Inc.',
      image_url: 'https://via.placeholder.com/300x300.png?text=Headphones',
      sku: 'HDPHN-WL-BT-001',
      reorder_threshold: 25,
      tags: ['Audio', 'Wireless', 'Gadget']
    },
    {
      name: 'Men\'s Classic Cotton T-Shirt',
      description: 'Comfortable and durable 100% cotton t-shirt, available in various colors.',
      price: 24.99,
      stock_quantity: 300,
      category_name: 'Apparel',
      supplier_name: 'Fashion Forward Ltd.',
      image_url: 'https://via.placeholder.com/300x300.png?text=T-Shirt',
      sku: 'TSHRT-MEN-COT-005',
      reorder_threshold: 50,
      tags: ['Clothing', 'Men', 'Summer']
    },
    {
      name: 'Smart Home LED Bulb',
      description: 'Wi-Fi enabled smart LED bulb, compatible with Alexa and Google Assistant.',
      price: 19.99,
      stock_quantity: 200,
      category_name: 'Home Goods',
      supplier_name: 'Global Electronics Inc.',
      image_url: 'https://via.placeholder.com/300x300.png?text=Smart+Bulb',
      sku: 'SMBLB-LED-WIFI-012',
      reorder_threshold: 30,
      tags: ['Smart Home', 'Lighting']
    },
    {
      name: 'The Great Gatsby - Paperback',
      description: 'Classic novel by F. Scott Fitzgerald, new paperback edition.',
      price: 9.99,
      stock_quantity: 500,
      category_name: 'Books',
      supplier_name: null, // Example of a product without a specific supplier from our list
      image_url: 'https://via.placeholder.com/300x300.png?text=Book+Cover',
      sku: 'BOOK-GATSBY-PB-001',
      tags: ['Classic', 'Literature', 'Novel']
    },
     {
      name: 'Organic Green Tea Bags',
      description: 'Box of 100 premium organic green tea bags, rich in antioxidants.',
      price: 15.49,
      stock_quantity: 120,
      category_name: 'Home Goods', // Could also be 'Beauty' or a new 'Grocery' category
      supplier_name: 'Home Comforts Co.',
      image_url: 'https://via.placeholder.com/300x300.png?text=Green+Tea',
      sku: 'TEA-GRN-ORG-100',
      reorder_threshold: 20,
      tags: ['Tea', 'Organic', 'Beverage']
    }
  ];

  console.log('Seeding products...');
  try {
    for (const product of sampleProducts) {
      // Get category_id
      const categoryResult = await client.query('SELECT id FROM categories WHERE name = $1', [product.category_name]);
      if (categoryResult.rows.length === 0) {
        console.warn(`Category "${product.category_name}" not found for product "${product.name}". Skipping product.`);
        continue;
      }
      const categoryId = categoryResult.rows[0].id;

      // Get supplier_id (if supplier_name is provided)
      let supplierId = null;
      if (product.supplier_name) {
        const supplierResult = await client.query('SELECT id FROM suppliers WHERE name = $1', [product.supplier_name]);
        if (supplierResult.rows.length > 0) {
          supplierId = supplierResult.rows[0].id;
        } else {
          console.warn(`Supplier "${product.supplier_name}" not found for product "${product.name}". Product will have no supplier.`);
        }
      }

      // Insert product
      const productInsertResult = await client.query(
        `INSERT INTO products (name, description, price, stock_quantity, category_id, supplier_id, image_url, sku, reorder_threshold)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (sku) DO NOTHING RETURNING id;`,
        [
          product.name, product.description, product.price, product.stock_quantity,
          categoryId, supplierId, product.image_url, product.sku, product.reorder_threshold || 0
        ]
      );

      if (productInsertResult.rowCount > 0) {
        const productId = productInsertResult.rows[0].id;
        console.log(`Product "${product.name}" seeded successfully with ID ${productId}.`);

        // Seed tags and product_tags
        if (product.tags && product.tags.length > 0) {
          for (const tagName of product.tags) {
            // Insert tag if not exists, get tag_id
            const tagResult = await client.query(
              'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id;',
              [tagName]
            );
            const tagId = tagResult.rows[0].id;

            // Insert into product_tags
            await client.query(
              'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
              [productId, tagId]
            );
            // console.log(`Associated tag "${tagName}" with product "${product.name}".`);
          }
        }
      } else {
        console.log(`Product with SKU "${product.sku}" already exists or conflict occurred. Skipped.`);
      }
    }
    console.log('Product seeding completed.');
  } catch (error) {
    console.error('Error seeding products:', error);
    throw error;
  }
}


async function seedDatabase() {
  console.log('Starting database seeding...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    await seedAdminUser(client);
    await seedCategories(client);
    await seedSuppliers(client); // Add suppliers
    await seedProducts(client);  // Add products

    console.log('Database seeding completed successfully.');
    await client.query('COMMIT'); // Commit transaction
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
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
