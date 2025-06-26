const bcrypt = require('bcrypt');
const db = require('../db'); // Assuming db.js exports the pool

// Placeholder for individual seeding functions - to be defined in subsequent steps
async function seedUsers(client, seededDataIds) {
  console.log('[SeedDB] Seeding users...');
  const usersToSeed = [
    { name: 'Admin User', email: 'admin@example.com', password: 'admin123', role: 'admin' },
    { name: 'Guest User', email: 'guest@example.com', password: 'password123', role: 'guest' },
    // Add more sample users if needed
  ];

  seededDataIds.users = {}; // Initialize if not already

  for (const userData of usersToSeed) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    try {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [userData.name, userData.email, hashedPassword, userData.role]
      );
      if (result.rows.length > 0) {
        seededDataIds.users[userData.email] = result.rows[0].id; // Store ID by email for potential reference
        console.log(`[SeedDB] User seeded/updated: ${userData.email} (ID: ${result.rows[0].id})`);
      } else {
         // This case should ideally not be hit with ON CONFLICT...RETURNING id
         // but if an existing user was found and DO NOTHING was used, result.rows could be empty.
         // For DO UPDATE, it should always return the ID.
         const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);
         if(existingUser.rows.length > 0) {
            seededDataIds.users[userData.email] = existingUser.rows[0].id;
            console.log(`[SeedDB] User ${userData.email} already existed (ID: ${existingUser.rows[0].id}), details potentially updated.`);
         } else {
            console.warn(`[SeedDB] Failed to insert or find user ${userData.email} after ON CONFLICT.`);
         }
      }
    } catch (error) {
      console.error(`[SeedDB] Error seeding user ${userData.email}:`, error);
      // Decide if this is a fatal error for the whole seed process
    }
  }
  console.log('[SeedDB] User seeding complete.');
}

async function seedCategories(client, seededDataIds) {
  console.log('[SeedDB] Seeding categories...');
  const categoriesToSeed = [
    { name: 'Electronics', description: 'Gadgets, devices, and accessories.' },
    { name: 'Apparel', description: 'Clothing, footwear, and fashion.' },
    { name: 'Books', description: 'Fiction, non-fiction, educational.' },
    { name: 'Home & Garden', description: 'Items for home improvement and gardening.' },
    { name: 'Sports & Outdoors', description: 'Equipment and gear for sports and outdoor activities.' }
  ];

  seededDataIds.categories = {}; // Initialize

  for (const catData of categoriesToSeed) {
    const slug = catData.name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
    try {
      const result = await client.query(
        `INSERT INTO categories (name, slug, description, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [catData.name, slug, catData.description]
      );
      if (result.rows.length > 0) {
        seededDataIds.categories[slug] = result.rows[0].id; // Store ID by slug
        console.log(`[SeedDB] Category seeded/updated: ${catData.name} (ID: ${result.rows[0].id}, Slug: ${slug})`);
      } else {
        const existingCat = await client.query('SELECT id FROM categories WHERE slug = $1', [slug]);
        if (existingCat.rows.length > 0) {
            seededDataIds.categories[slug] = existingCat.rows[0].id;
            console.log(`[SeedDB] Category ${catData.name} (Slug: ${slug}) already existed (ID: ${existingCat.rows[0].id}), details potentially updated.`);
        } else {
            console.warn(`[SeedDB] Failed to insert or find category ${catData.name} after ON CONFLICT.`);
        }
      }
    } catch (error) {
      console.error(`[SeedDB] Error seeding category ${catData.name}:`, error);
    }
  }
  console.log('[SeedDB] Category seeding complete.');
}

async function seedSuppliers(client, seededDataIds) {
  console.log('[SeedDB] Seeding suppliers...');
  const suppliersToSeed = [
    { name: 'Global Electronics Inc.', contact_person: 'Jane Doe', email: 'contact@globalelectronics.com', phone: '555-0101', address: '123 Tech Park, Silicon Valley, CA', currency_code: 'USD' },
    { name: 'Fashion Forward Ltd.', contact_person: 'John Smith', email: 'sales@fashionforward.com', phone: '555-0202', address: '456 Fashion Ave, New York, NY', currency_code: 'USD' },
    { name: 'ReadMore Books Co.', contact_person: 'Alice Brown', email: 'info@readmorebooks.com', phone: '555-0303', address: '789 Library Ln, Boston, MA', currency_code: 'USD' },
    { name: 'Home Essentials LLC', contact_person: 'Robert Green', email: 'support@homeessentials.com', phone: '555-0404', address: '101 Home St, Chicago, IL', currency_code: 'USD' },
    { name: 'Outdoor Gear Supplies', contact_person: 'Emily White', email: 'orders@outdoorgear.com', phone: '555-0505', address: '202 Adventure Rd, Denver, CO', currency_code: 'CAD' }
  ];

  seededDataIds.suppliers = {}; // Initialize

  for (const supData of suppliersToSeed) {
    try {
      const result = await client.query(
        `INSERT INTO suppliers (name, contact_person, email, phone, address, currency_code, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           contact_person = EXCLUDED.contact_person,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           currency_code = EXCLUDED.currency_code,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [supData.name, supData.contact_person, supData.email, supData.phone, supData.address, supData.currency_code]
      );
      if (result.rows.length > 0) {
        seededDataIds.suppliers[supData.email] = result.rows[0].id; // Store ID by email
        console.log(`[SeedDB] Supplier seeded/updated: ${supData.name} (ID: ${result.rows[0].id})`);
      } else {
         const existingSup = await client.query('SELECT id FROM suppliers WHERE email = $1', [supData.email]);
         if (existingSup.rows.length > 0) {
            seededDataIds.suppliers[supData.email] = existingSup.rows[0].id;
            console.log(`[SeedDB] Supplier ${supData.name} (Email: ${supData.email}) already existed (ID: ${existingSup.rows[0].id}), details potentially updated.`);
         } else {
            console.warn(`[SeedDB] Failed to insert or find supplier ${supData.name} after ON CONFLICT.`);
         }
      }
    } catch (error) {
      // If unique constraint is on 'name' instead of 'email', this error handling might need adjustment
      if (error.code === '23505' && error.constraint && error.constraint.includes('name')) { // Example if name was unique
         console.warn(`[SeedDB] Supplier with name "${supData.name}" likely already exists (or other unique constraint violation). Details: ${error.detail}`);
         // Try to fetch ID by name if name is unique, otherwise this specific error is harder to recover from gracefully
         const existingSupByName = await client.query('SELECT id FROM suppliers WHERE name = $1', [supData.name]);
         if (existingSupByName.rows.length > 0) {
            seededDataIds.suppliers[supData.name] = existingSupByName.rows[0].id; // Store by name if email failed
         }
      } else {
        console.error(`[SeedDB] Error seeding supplier ${supData.name}:`, error);
      }
    }
  }
  console.log('[SeedDB] Supplier seeding complete.');
}

async function seedTags(client, seededDataIds) {
  console.log('[SeedDB] Seeding tags...');
  const tagsToSeed = [
    'new', 'featured', 'sale', 'electronics', 'apparel', 'books',
    'eco-friendly', 'handmade', 'vintage', 'staff pick', 'popular', 'gadget', 'audio', 'wireless'
  ];

  seededDataIds.tags = {}; // Initialize

  for (const tagName of tagsToSeed) {
    try {
      const result = await client.query(
        `INSERT INTO tags (name, created_at, updated_at)
         VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (name) DO UPDATE SET
           name = EXCLUDED.name, -- Though name is the conflict target, this handles potential case changes if desired
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [tagName.toLowerCase()] // Store tags in lowercase for consistency
      );
      if (result.rows.length > 0) {
        seededDataIds.tags[tagName.toLowerCase()] = result.rows[0].id; // Store ID by lowercase name
        console.log(`[SeedDB] Tag seeded/updated: ${tagName.toLowerCase()} (ID: ${result.rows[0].id})`);
      } else {
        // This block might be hit if ON CONFLICT DO NOTHING was used and the tag existed.
        // With DO UPDATE RETURNING id, it should always return a row.
        // Fallback to select if needed, though less likely with current ON CONFLICT.
        const existingTag = await client.query('SELECT id FROM tags WHERE name = $1', [tagName.toLowerCase()]);
        if(existingTag.rows.length > 0) {
            seededDataIds.tags[tagName.toLowerCase()] = existingTag.rows[0].id;
             console.log(`[SeedDB] Tag ${tagName.toLowerCase()} already existed (ID: ${existingTag.rows[0].id}).`);
        } else {
             console.warn(`[SeedDB] Failed to insert or find tag ${tagName.toLowerCase()} after ON CONFLICT.`);
        }
      }
    } catch (error) {
      console.error(`[SeedDB] Error seeding tag ${tagName}:`, error);
    }
  }
  console.log('[SeedDB] Tag seeding complete.');
}

async function seedTaxClassesAndRates(client, seededDataIds) {
  console.log('[SeedDB] Seeding tax classes and rates...');
  seededDataIds.taxClasses = {};
  seededDataIds.taxRates = {};

  const taxClassesToSeed = [
    { name: 'Standard Goods', description: 'Default tax class for most products.' },
    { name: 'Reduced Rate Goods', description: 'Goods with a reduced tax rate.' },
    { name: 'Tax Exempt', description: 'Goods exempt from tax.' },
  ];

  for (const tcData of taxClassesToSeed) {
    try {
      const result = await client.query(
        `INSERT INTO tax_classes (name, description, created_at, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (name) DO UPDATE SET
           description = EXCLUDED.description,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [tcData.name, tcData.description]
      );
      const taxClassId = result.rows[0].id;
      seededDataIds.taxClasses[tcData.name] = taxClassId;
      console.log(`[SeedDB] Tax Class seeded/updated: ${tcData.name} (ID: ${taxClassId})`);

      // Seed a default rate for some classes (example)
      if (tcData.name === 'Standard Goods') {
        const rateResult = await client.query(
          `INSERT INTO tax_rates (tax_class_id, rate, name, country, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (tax_class_id, name, COALESCE(country, ''), COALESCE(state, ''), COALESCE(postal_code, '')) DO UPDATE SET -- Example unique constraint
             rate = EXCLUDED.rate,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id;`,
          [taxClassId, 20.00, 'Standard VAT (20%)', null, true] // Example: 20% VAT, applies to all countries if country is null
        );
        seededDataIds.taxRates['Standard VAT'] = rateResult.rows[0].id;
        console.log(`[SeedDB] Tax Rate seeded for Standard Goods: 20% (ID: ${rateResult.rows[0].id})`);
      } else if (tcData.name === 'Reduced Rate Goods') {
         const rateResult = await client.query(
          `INSERT INTO tax_rates (tax_class_id, rate, name, country, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (tax_class_id, name, COALESCE(country, ''), COALESCE(state, ''), COALESCE(postal_code, '')) DO UPDATE SET
             rate = EXCLUDED.rate,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id;`,
          [taxClassId, 5.00, 'Reduced VAT (5%)', null, true]
        );
        seededDataIds.taxRates['Reduced VAT'] = rateResult.rows[0].id;
        console.log(`[SeedDB] Tax Rate seeded for Reduced Rate Goods: 5% (ID: ${rateResult.rows[0].id})`);
      }
      // Tax Exempt class typically has no rate or a 0% rate entry.
      // For simplicity, we might not add a tax_rates entry for "Tax Exempt" unless a 0% rate record is meaningful.

    } catch (error) {
      console.error(`[SeedDB] Error seeding tax class ${tcData.name} or its rates:`, error);
    }
  }
  console.log('[SeedDB] Tax class and rate seeding complete.');
}

async function seedProductOptions(client, seededDataIds) {
  console.log('[SeedDB] Seeding product option types...');
  const optionTypesToSeed = [
    { name: 'Color', display_order: 1, type: 'select' }, // Assuming 'type' and 'display_order' columns exist
    { name: 'Size', display_order: 2, type: 'select' },
    { name: 'Material', display_order: 3, type: 'select' },
    { name: 'Style', display_order: 4, type: 'select' }
  ];

  seededDataIds.productOptions = {}; // Initialize

  for (const optData of optionTypesToSeed) {
    try {
      const result = await client.query(
        `INSERT INTO product_options (name, display_order, type, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (name) DO UPDATE SET
           display_order = EXCLUDED.display_order,
           type = EXCLUDED.type,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [optData.name, optData.display_order, optData.type]
      );
      if (result.rows.length > 0) {
        seededDataIds.productOptions[optData.name] = result.rows[0].id; // Store ID by name
        console.log(`[SeedDB] Product Option Type seeded/updated: ${optData.name} (ID: ${result.rows[0].id})`);
      } else {
        const existingOpt = await client.query('SELECT id FROM product_options WHERE name = $1', [optData.name]);
        if (existingOpt.rows.length > 0) {
            seededDataIds.productOptions[optData.name] = existingOpt.rows[0].id;
            console.log(`[SeedDB] Product Option Type ${optData.name} already existed (ID: ${existingOpt.rows[0].id}), details potentially updated.`);
        } else {
             console.warn(`[SeedDB] Failed to insert or find Product Option Type ${optData.name} after ON CONFLICT.`);
        }
      }
    } catch (error) {
      console.error(`[SeedDB] Error seeding product option type ${optData.name}:`, error);
    }
  }
  console.log('[SeedDB] Product option type seeding complete.');
}

async function seedProductOptionValues(client, seededDataIds) {
  console.log('[SeedDB] Seeding product option values...');
  // Assumes seededDataIds.productOptions is populated by seedProductOptions
  // e.g., seededDataIds.productOptions['Color'] = 1; seededDataIds.productOptions['Size'] = 2;

  const optionValuesToSeed = [
    // Colors
    { optionTypeName: 'Color', value: 'Red', display_order: 1 },
    { optionTypeName: 'Color', value: 'Blue', display_order: 2 },
    { optionTypeName: 'Color', value: 'Green', display_order: 3 },
    { optionTypeName: 'Color', value: 'Black', display_order: 4 },
    { optionTypeName: 'Color', value: 'White', display_order: 5 },
    { optionTypeName: 'Color', value: 'Yellow', display_order: 6 },
    { optionTypeName: 'Color', value: 'Pink', display_order: 7 },
    { optionTypeName: 'Color', value: 'Purple', display_order: 8 },
    { optionTypeName: 'Color', value: 'Orange', display_order: 9 },
    { optionTypeName: 'Color', value: 'Aqua', display_order: 10 },


    // Sizes
    { optionTypeName: 'Size', value: 'XS', display_order: 1 },
    { optionTypeName: 'Size', value: 'Small', display_order: 2 },
    { optionTypeName: 'Size', value: 'Medium', display_order: 3 },
    { optionTypeName: 'Size', value: 'Large', display_order: 4 },
    { optionTypeName: 'Size', value: 'XL', display_order: 5 },
    { optionTypeName: 'Size', value: 'XXL', display_order: 6 },

    // Materials
    { optionTypeName: 'Material', value: 'Cotton', display_order: 1 },
    { optionTypeName: 'Material', value: 'Polyester', display_order: 2 },
    { optionTypeName: 'Material', value: 'Silk', display_order: 3 },
    { optionTypeName: 'Material', value: 'Wool', display_order: 4 },

    // Styles
    { optionTypeName: 'Style', value: 'Casual', display_order: 1 },
    { optionTypeName: 'Style', value: 'Formal', display_order: 2 },
    { optionTypeName: 'Style', value: 'Sport', display_order: 3 },
  ];

  seededDataIds.productOptionValues = {}; // Initialize

  for (const valData of optionValuesToSeed) {
    const productOptionId = seededDataIds.productOptions[valData.optionTypeName];
    if (!productOptionId) {
      console.warn(`[SeedDB] Product Option Type "${valData.optionTypeName}" not found in seededDataIds. Skipping value "${valData.value}".`);
      continue;
    }

    try {
      // Assuming a unique constraint on (product_option_id, value)
      const result = await client.query(
        `INSERT INTO product_option_values (product_option_id, value, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (product_option_id, value) DO UPDATE SET
           display_order = EXCLUDED.display_order,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [productOptionId, valData.value, valData.display_order]
      );
      if (result.rows.length > 0) {
        // Store ID by a composite key like "OptionName-ValueName" for easier lookup if needed
        const key = `${valData.optionTypeName}-${valData.value}`;
        seededDataIds.productOptionValues[key] = result.rows[0].id;
        console.log(`[SeedDB] Product Option Value seeded/updated: ${valData.optionTypeName} - ${valData.value} (ID: ${result.rows[0].id})`);
      } else {
        const existingVal = await client.query(
          'SELECT id FROM product_option_values WHERE product_option_id = $1 AND value = $2',
          [productOptionId, valData.value]
        );
        if(existingVal.rows.length > 0) {
            const key = `${valData.optionTypeName}-${valData.value}`;
            seededDataIds.productOptionValues[key] = existingVal.rows[0].id;
            console.log(`[SeedDB] Product Option Value ${valData.optionTypeName} - ${valData.value} already existed (ID: ${existingVal.rows[0].id}), details potentially updated.`);
        } else {
            console.warn(`[SeedDB] Failed to insert or find Product Option Value ${valData.optionTypeName} - ${valData.value} after ON CONFLICT.`);
        }
      }
    } catch (error) {
      console.error(`[SeedDB] Error seeding product option value ${valData.value} for ${valData.optionTypeName}:`, error);
    }
  }
  console.log('[SeedDB] Product option value seeding complete.');
}

async function seedProducts(client, seededDataIds) {
  console.log('[SeedDB] Seeding products...');
  // Assumes seededDataIds.categories, .suppliers, .taxClasses, .tags are populated

  // Using productSkuMap and productDefinitions from seedInventoryBatches as a base for sample products
  const productSkuMap = {
    headphones: 'HDPHN-WL-BT-001',
    tshirt: 'TSHRT-MEN-COT-005',
    ledBulb: 'SMBLB-LED-WIFI-012',
    thrillerNovel: 'BOOK-THRILLER-001',
    gatsbyBook: 'BOOK-GATSBY-PB',
    greenTea: 'TEA-GRN-ORG-100'
  };

  const sampleProducts = [
    {
      key: 'headphones', // Internal key for seededDataIds.products
      name: 'Wireless Bluetooth Headphones',
      description: 'High-fidelity wireless headphones with noise cancellation and 20-hour battery life.',
      price: 149.99,
      stock_quantity: 0, // Stock managed by variants for this one
      sku: productSkuMap.headphones,
      categoryName: 'Electronics', // Will look up ID from seededDataIds.categories
      supplierName: 'Global Electronics Inc.', // Will look up ID
      taxClassName: 'Standard Goods', // Will look up ID
      cost_price: 89.99,
      has_variants: true, // Important flag
      image_url: 'https://shippinsoft.s3.amazonaws.com/product-gallery/1/image-1750900844277-Peachy_Headphone_pink.png', // Example primary image
      tags: ['audio', 'gadget', 'wireless', 'featured']
    },
    {
      key: 'tshirt',
      name: 'Men\'s Cotton T-Shirt',
      description: 'Comfortable and durable 100% cotton t-shirt for everyday wear.',
      price: 25.00,
      stock_quantity: 0, // Stock managed by variants
      sku: productSkuMap.tshirt,
      categoryName: 'Apparel',
      supplierName: 'Fashion Forward Ltd.',
      taxClassName: 'Standard Goods',
      cost_price: 12.50,
      has_variants: true,
      image_url: null, // Example: no main image, rely on variant images or gallery
      tags: ['apparel', 'men', 'cotton', 'sale']
    },
    {
      key: 'ledBulb',
      name: 'Smart LED WiFi Bulb',
      description: 'Energy-efficient smart LED bulb, controllable via WiFi app. RGB and white light.',
      price: 19.99,
      stock_quantity: 200, // This product does not have variants in sample data, so stock is here
      sku: productSkuMap.ledBulb,
      categoryName: 'Home & Garden',
      supplierName: 'Global Electronics Inc.',
      taxClassName: 'Standard Goods',
      cost_price: 9.00,
      has_variants: false,
      image_url: null,
      tags: ['smart home', 'lighting', 'led']
    },
     {
      key: 'thrillerNovel',
      name: 'The Midnight Hour - A Thriller Novel',
      description: 'A gripping psychological thriller that will keep you on the edge of your seat.',
      price: 14.95,
      stock_quantity: 250,
      sku: productSkuMap.thrillerNovel,
      categoryName: 'Books',
      supplierName: 'ReadMore Books Co.',
      taxClassName: 'Reduced Rate Goods', // Example of different tax class
      cost_price: 5.50,
      has_variants: false,
      image_url: null,
      tags: ['books', 'thriller', 'fiction', 'new']
    },
    {
      key: 'gatsbyBook',
      name: 'The Great Gatsby - Paperback',
      description: 'Classic novel by F. Scott Fitzgerald. Paperback edition.',
      price: 8.99,
      stock_quantity: 50,
      sku: productSkuMap.gatsbyBook,
      categoryName: 'Books',
      supplierName: 'ReadMore Books Co.',
      taxClassName: 'Reduced Rate Goods',
      cost_price: 3.50,
      has_variants: false,
      tags: ['books', 'classic', 'literature']
    },
    {
      key: 'greenTea',
      name: 'Organic Green Tea Bags (100 ct)',
      description: 'Premium organic green tea, 100 tea bags.',
      price: 15.00,
      stock_quantity: 100,
      sku: productSkuMap.greenTea,
      categoryName: 'Home & Garden', // Or a 'Groceries' category if exists
      supplierName: null, // Example of no supplier
      taxClassName: 'Tax Exempt', // Example of tax exempt
      cost_price: 7.00,
      has_variants: false,
      tags: ['tea', 'organic', 'beverage', 'healthy']
    }
  ];

  seededDataIds.products = {}; // Initialize

  for (const prodData of sampleProducts) {
    const categoryId = seededDataIds.categories[prodData.categoryName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')] || null;
    const supplierId = prodData.supplierName ? seededDataIds.suppliers[prodData.supplierName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/\./g, '')] : null; // Simplified keying for suppliers
    const taxClassId = prodData.taxClassName ? seededDataIds.taxClasses[prodData.taxClassName] : null;

    try {
      const result = await client.query(
        `INSERT INTO products
          (name, description, price, stock_quantity, sku, category_id, supplier_id, tax_class_id, cost_price, has_variants, image_url, product_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           stock_quantity = EXCLUDED.stock_quantity,
           category_id = EXCLUDED.category_id,
           supplier_id = EXCLUDED.supplier_id,
           tax_class_id = EXCLUDED.tax_class_id,
           cost_price = EXCLUDED.cost_price,
           has_variants = EXCLUDED.has_variants,
           image_url = EXCLUDED.image_url,
           product_status = EXCLUDED.product_status,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [
          prodData.name, prodData.description, prodData.price, prodData.stock_quantity, prodData.sku,
          categoryId, supplierId, taxClassId, prodData.cost_price, prodData.has_variants, prodData.image_url,
          'active' // Default product_status to active
        ]
      );

      const productId = result.rows[0].id;
      seededDataIds.products[prodData.key] = productId; // Store ID by the internal key
      console.log(`[SeedDB] Product seeded/updated: ${prodData.name} (ID: ${productId}, SKU: ${prodData.sku})`);

      // Seed product_tags
      if (prodData.tags && prodData.tags.length > 0) {
        // Clear existing tags for this product first to handle updates correctly
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
        for (const tagName of prodData.tags) {
          const tagId = seededDataIds.tags[tagName.toLowerCase()];
          if (tagId) {
            await client.query(
              'INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
              [productId, tagId]
            );
          } else {
            console.warn(`[SeedDB] Tag "${tagName}" not found in seededDataIds.tags for product ${prodData.name}.`);
          }
        }
      }
    } catch (error) {
      console.error(`[SeedDB] Error seeding product ${prodData.name}:`, error);
    }
  }
  console.log('[SeedDB] Product seeding complete.');
}

async function seedProductOptionConfigurations(client, seededDataIds) {
  console.log('[SeedDB] Seeding product option configurations (assigned options and their specific values)...');

  // Example configurations:
  // Product 'headphones' (HDPHN-WL-BT-001) will be configurable by 'Color' and 'Size'.
  // Product 'tshirt' (TSHRT-MEN-COT-005) will be configurable by 'Color' and 'Size'.

  const configurations = [
    {
      productKey: 'headphones', // Key used in seededDataIds.products
      optionConfigurations: [
        {
          optionTypeName: 'Color', // Key used in seededDataIds.productOptions
          allowedValues: ['Red', 'Blue', 'Green', 'Black', 'White', 'Aqua', 'Pink', 'Yellow', 'Purple', 'Orange'] // Values (keys for seededDataIds.productOptionValues)
        },
        {
          optionTypeName: 'Size',
          allowedValues: ['Small', 'Medium', 'Large', 'XL', 'XXL', 'XS']
        }
      ]
    },
    {
      productKey: 'tshirt',
      optionConfigurations: [
        {
          optionTypeName: 'Color',
          allowedValues: ['Red', 'Blue', 'Black']
        },
        {
          optionTypeName: 'Size',
          allowedValues: ['Small', 'Medium', 'Large']
        }
      ]
    }
    // Add more products and their option configurations as needed
  ];

  for (const config of configurations) {
    const productId = seededDataIds.products[config.productKey];
    if (!productId) {
      console.warn(`[SeedDB] Product with key "${config.productKey}" not found in seededDataIds.products. Skipping its option configurations.`);
      continue;
    }

    console.log(`[SeedDB] Configuring options for Product ID: ${productId} (${config.productKey})`);

    for (const optConfig of config.optionConfigurations) {
      const productOptionId = seededDataIds.productOptions[optConfig.optionTypeName];
      if (!productOptionId) {
        console.warn(`[SeedDB] Option Type "${optConfig.optionTypeName}" not found for product ${config.productKey}. Skipping this option.`);
        continue;
      }

      // 1. Assign the global option type to the product (product_assigned_options)
      let assignedOptionId;
      try {
        const assignResult = await client.query(
          `INSERT INTO product_assigned_options (product_id, option_id, created_at, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (product_id, option_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
           RETURNING id;`,
          [productId, productOptionId]
        );
        assignedOptionId = assignResult.rows[0].id;
        console.log(`[SeedDB] Assigned option type "${optConfig.optionTypeName}" (ID: ${productOptionId}) to product ID ${productId}. AssignedOptionID: ${assignedOptionId}`);
      } catch (assignError) {
         // If ON CONFLICT DO UPDATE SET ... RETURNING id; still results in empty rows if the conflict target is hit but no actual update to `updated_at` occurs due to same timestamp precision.
         // A fallback select is safer if RETURNING id is not guaranteed after conflict update.
        const existingAssignedOpt = await client.query(
            'SELECT id FROM product_assigned_options WHERE product_id = $1 AND option_id = $2',
            [productId, productOptionId]
        );
        if (existingAssignedOpt.rows.length > 0) {
            assignedOptionId = existingAssignedOpt.rows[0].id;
            console.log(`[SeedDB] Option type "${optConfig.optionTypeName}" was already assigned to product ID ${productId}. AssignedOptionID: ${assignedOptionId}`);
        } else {
            console.error(`[SeedDB] Error assigning option type "${optConfig.optionTypeName}" to product ${config.productKey}:`, assignError);
            continue; // Skip to next option configuration if assignment fails
        }
      }

      if (!assignedOptionId) { // Should be caught by error or existing check, but defensive
          console.error(`[SeedDB] Failed to get an assigned_option_id for ${optConfig.optionTypeName} on product ${config.productKey}.`);
          continue;
      }

      // 2. Assign specific allowed values for this product-option assignment (product_assigned_option_specific_values)
      if (optConfig.allowedValues && optConfig.allowedValues.length > 0) {
        // First, clear existing specific values for this assigned_option_id to handle updates correctly
        await client.query('DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1', [assignedOptionId]);

        for (const valueName of optConfig.allowedValues) {
          const valueKey = `${optConfig.optionTypeName}-${valueName}`; // Key used in seededDataIds.productOptionValues
          const productOptionValueId = seededDataIds.productOptionValues[valueKey];

          if (!productOptionValueId) {
            console.warn(`[SeedDB] Option Value "${valueName}" for Option Type "${optConfig.optionTypeName}" not found. Skipping for product ${config.productKey}.`);
            continue;
          }

          try {
            await client.query(
              `INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id, created_at, updated_at)
               VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT (product_assigned_option_id, product_option_value_id) DO NOTHING;`, // Or DO UPDATE if there are fields to update
              [assignedOptionId, productOptionValueId]
            );
            // console.log(`[SeedDB] Assigned value "${valueName}" (ID: ${productOptionValueId}) to "${optConfig.optionTypeName}" for product ID ${productId}`);
          } catch (specificValueError) {
            console.error(`[SeedDB] Error assigning value "${valueName}" to "${optConfig.optionTypeName}" for product ${config.productKey}:`, specificValueError);
          }
        }
        console.log(`[SeedDB] Finished assigning ${optConfig.allowedValues.length} specific values for "${optConfig.optionTypeName}" on product ${config.productKey}.`);
      }
    }
  }
  console.log('[SeedDB] Product option configurations seeding complete.');
}

async function seedVariants(client, seededDataIds) {
  console.log('[SeedDB] Seeding product variants...');
  // Assumes seededDataIds.products, .productOptions, .productOptionValues are populated

  // Variant SKUs and their definitions (similar to seedInventoryBatches)
  const variantSkuMap = {
    headphonesGreen: 'HDPHN-GRN',
    tshirtRedS: 'TSHRT-RD-S',
    tshirtBlueM: 'TSHRT-BL-M'
  };

  const variantsToSeed = [
    {
      key: 'headphonesGreen', // Internal key for seededDataIds.variants
      productKey: 'headphones', // Key for seededDataIds.products
      sku: variantSkuMap.headphonesGreen,
      price_modifier: 5.00,
      stock_quantity: 20, // This stock will also be put into a batch by seedInventoryBatches
      cost_price: 92.00,
      image_url: 'https://shippinsoft.s3.amazonaws.com/product-gallery/1/image-1750900844277-Peachy_Headphone_pink.png', // Example, could be specific
      optionValueKeys: ['Color-Aqua', 'Size-Medium'] // Keys for seededDataIds.productOptionValues
    },
    {
      key: 'tshirtRedS',
      productKey: 'tshirt',
      sku: variantSkuMap.tshirtRedS,
      price_modifier: 0.00,
      stock_quantity: 10,
      cost_price: 12.50,
      image_url: null,
      optionValueKeys: ['Color-Red', 'Size-Small']
    },
    {
      key: 'tshirtBlueM',
      productKey: 'tshirt',
      sku: variantSkuMap.tshirtBlueM,
      price_modifier: 1.50,
      stock_quantity: 7,
      cost_price: 13.00,
      image_url: null,
      optionValueKeys: ['Color-Blue', 'Size-Medium']
    }
    // Add more variants as needed
  ];

  seededDataIds.variants = {}; // Initialize

  for (const varData of variantsToSeed) {
    const productId = seededDataIds.products[varData.productKey];
    if (!productId) {
      console.warn(`[SeedDB] Product with key "${varData.productKey}" not found for variant SKU "${varData.sku}". Skipping variant.`);
      continue;
    }

    const optionValueIds = varData.optionValueKeys.map(key => seededDataIds.productOptionValues[key]).filter(id => id !== undefined);
    if (optionValueIds.length !== varData.optionValueKeys.length) {
      console.warn(`[SeedDB] Not all option values found for variant SKU "${varData.sku}". Required keys: ${varData.optionValueKeys.join(', ')}. Found IDs: ${optionValueIds.join(', ')}. Skipping variant.`);
      continue;
    }

    try {
      // Insert into product_variants
      const variantResult = await client.query(
        `INSERT INTO product_variants
          (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (sku) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           price_modifier = EXCLUDED.price_modifier,
           stock_quantity = EXCLUDED.stock_quantity,
           image_url = EXCLUDED.image_url,
           cost_price = EXCLUDED.cost_price,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [
          productId, varData.sku, varData.price_modifier, varData.stock_quantity,
          varData.image_url, varData.cost_price
        ]
      );

      const variantId = variantResult.rows[0].id;
      seededDataIds.variants[varData.key] = variantId; // Store by internal key
       console.log(`[SeedDB] Variant seeded/updated: ${varData.sku} (ID: ${variantId}) for Product ID ${productId}`);

      // Link variant to its option values in product_variant_option_values
      // Clear existing links first for idempotency on update
      await client.query('DELETE FROM product_variant_option_values WHERE product_variant_id = $1;', [variantId]);
      for (const optionValueId of optionValueIds) {
        await client.query(
          `INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id)
           VALUES ($1, $2)
           ON CONFLICT (product_variant_id, product_option_value_id) DO NOTHING;`,
          [variantId, optionValueId]
        );
      }
      console.log(`[SeedDB] Linked ${optionValueIds.length} option values to variant ID ${variantId}.`);

      // Ensure the parent product's has_variants flag is true
      await client.query('UPDATE products SET has_variants = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND has_variants = FALSE;', [productId]);

    } catch (error) {
      console.error(`[SeedDB] Error seeding variant SKU ${varData.sku}:`, error);
    }
  }
  console.log('[SeedDB] Variant seeding complete.');
}

async function seedInventoryBatches(client, seededDataIds) {
  console.log('[SeedDB] Seeding inventory batches...'); // Changed log prefix for consistency
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0) {
    console.warn("[SeedDB] Product IDs (from product keys like 'headphones') not available in seededDataIds for inventory batch seeding. Skipping.");
    return;
  }
   if (!seededDataIds.variants || Object.keys(seededDataIds.variants).length === 0) {
    // This is a softer warning as some products might not have variants
    console.warn("[SeedDB] Variant IDs (from variant keys like 'headphonesGreen') not available in seededDataIds. Some variant batches may be skipped if they rely on these.");
  }

  // Product keys (used in sampleProducts and to store IDs in seededDataIds.products)
  // These should align with the keys used in seedProducts.
  const productKeyMap = {
    headphones: 'headphones', // Map internal key to itself, assuming seedProducts used this key
    tshirt: 'tshirt',
    ledBulb: 'ledBulb',
    thrillerNovel: 'thrillerNovel',
    gatsbyBook: 'gatsbyBook',
    greenTea: 'greenTea'
  };

  // Variant keys (used in variantsToSeed and to store IDs in seededDataIds.variants)
  const variantKeyMap = {
    headphonesGreen: 'headphonesGreen',
    tshirtRedS: 'tshirtRedS',
    tshirtBlueM: 'tshirtBlueM'
  };

  // Original stock quantities and costs from product/variant definitions for reference
  // This data should ideally come from the same source as seedProducts/seedVariants for consistency.
  // For this example, we'll use the definitions provided in the original seedInventoryBatches snippet.
  const productDefinitionsForBatch = {
    [productKeyMap.headphones]: { cost_price: 89.99 }, // Base product cost, variant has its own
    [productKeyMap.tshirt]: { cost_price: 12.50 },   // Base product cost, variant has its own
    [productKeyMap.ledBulb]: { stock_quantity: 200, cost_price: 9.00 },
    [productKeyMap.thrillerNovel]: { stock_quantity: 250, cost_price: 5.50 },
    [productKeyMap.gatsbyBook]: { stock_quantity: 50, cost_price: 3.50 },
    [productKeyMap.greenTea]: { stock_quantity: 100, cost_price: 7.00 }
  };

  const variantDefinitionsForBatch = {
    [variantKeyMap.headphonesGreen]: { stock_quantity: 20, cost_price: 92.00, productKey: productKeyMap.headphones },
    [variantKeyMap.tshirtRedS]: { stock_quantity: 10, cost_price: 12.50, productKey: productKeyMap.tshirt },
    [variantKeyMap.tshirtBlueM]: { stock_quantity: 7, cost_price: 13.00, productKey: productKeyMap.tshirt }
  };

  const batchesToSeed = [];

  const addBatch = (productKey, variantKey, batchNumber, initialQty, currentQty, cost, currency = 'USD', expiry = null) => {
    const productId = seededDataIds.products[productKey];
    let variantId = null;
    if (variantKey) {
      variantId = seededDataIds.variants ? seededDataIds.variants[variantKey] : null;
    }

    if (productId && (variantKey ? variantId : true)) {
      console.log(`[SeedDB] Preparing batch for ProductKey: ${productKey}, VariantKey: ${variantKey || 'N/A'} (ProdID: ${productId}, VarID: ${variantId || 'N/A'}), BatchNo: ${batchNumber}`);
      batchesToSeed.push({
        product_id: productId,
        variant_id: variantId,
        batch_number: batchNumber,
        expiry_date: expiry,
        initial_quantity: initialQty,
        current_quantity: currentQty,
        cost_price_at_receipt: cost,
        currency_code_at_receipt: currency,
        base_currency_cost_price_at_receipt: cost,
        exchange_rate_used: 1.0,
        purchase_order_item_id: null
      });
    } else {
      console.warn(`[SeedDB] Could not find Product ID for key ${productKey} or Variant ID for key ${variantKey || ''}. Skipping batch: ${batchNumber}`);
    }
  };

  // Seed batches for products WITHOUT variants, using their defined stock and cost
  for (const key of ['ledBulb', 'thrillerNovel', 'gatsbyBook', 'greenTea']) {
    const pDef = productDefinitionsForBatch[productKeyMap[key]];
    if (pDef && pDef.stock_quantity > 0) { // Only seed batch if stock is defined and positive
        addBatch(key, null, `BATCH_${productKeyMap[key].toUpperCase()}_001`, pDef.stock_quantity, pDef.stock_quantity, pDef.cost_price);
    }
  }
  // Example with expiry for greenTea
   const gtDef = productDefinitionsForBatch[productKeyMap.greenTea];
   if (gtDef && gtDef.stock_quantity > 0) { // Check again in case it was handled above (it was)
       // This will effectively update the previously added batch for greenTea due to ON CONFLICT if batch number is same,
       // or add another if batch number is different. Let's ensure unique batch numbers or rely on ON CONFLICT.
       // For simplicity, the above loop already handles it. This is just to show specific fields:
       // addBatch('greenTea', null, 'BATCH_TEA001_202307_EXP', gtDef.stock_quantity, gtDef.stock_quantity, gtDef.cost_price, 'USD', '2025-12-31');
   }


  // Seed batches for product VARIANTS
  for (const key in variantDefinitionsForBatch) {
      const vDef = variantDefinitionsForBatch[key];
      if (vDef && vDef.stock_quantity > 0) {
          addBatch(vDef.productKey, key, `BATCH_${key.toUpperCase()}_001`, vDef.stock_quantity, vDef.stock_quantity, vDef.cost_price, 'USD', key === 'headphonesGreen' ? '2026-05-31' : null);
      }
  }


  if (batchesToSeed.length === 0) {
    console.log('[SeedDB] No inventory batches to seed based on product/variant definitions and found IDs.');
    return;
  }

  try {
    for (const batch of batchesToSeed) {
      console.log(`[SeedDB] Seeding batch: ProdID ${batch.product_id}, VarID ${batch.variant_id}, BatchNo ${batch.batch_number}, Qty ${batch.current_quantity}`);
      await client.query(
        `INSERT INTO inventory_batches
          (product_id, variant_id, batch_number, expiry_date, initial_quantity, current_quantity,
           cost_price_at_receipt, currency_code_at_receipt, base_currency_cost_price_at_receipt, exchange_rate_used, purchase_order_item_id, received_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (product_id, variant_id, batch_number) DO UPDATE SET
           expiry_date = EXCLUDED.expiry_date,
           initial_quantity = EXCLUDED.initial_quantity,
           current_quantity = EXCLUDED.current_quantity,
           cost_price_at_receipt = EXCLUDED.cost_price_at_receipt,
           currency_code_at_receipt = EXCLUDED.currency_code_at_receipt,
           base_currency_cost_price_at_receipt = EXCLUDED.base_currency_cost_price_at_receipt,
           exchange_rate_used = EXCLUDED.exchange_rate_used,
           purchase_order_item_id = EXCLUDED.purchase_order_item_id,
           updated_at = CURRENT_TIMESTAMP;`, // Ensure received_date is not updated on conflict unless intended
        [
          batch.product_id, batch.variant_id, batch.batch_number, batch.expiry_date, batch.initial_quantity, batch.current_quantity,
          batch.cost_price_at_receipt, batch.currency_code_at_receipt, batch.base_currency_cost_price_at_receipt,
          batch.exchange_rate_used, batch.purchase_order_item_id
        ]
      );
    }
    console.log(`[SeedDB] ${batchesToSeed.length} inventory batch(es) seeded or updated.`);
  } catch (error) {
    console.error('[SeedDB] Error seeding inventory batches:', error);
  }
}


// Main seeding orchestrator
async function runAllSeeds() {
  console.log('[SEED SCRIPT] Connecting to database for seeding...');
  const client = await db.pool.connect();
  console.log('[SEED SCRIPT] Database client connected.');

  const seededDataIds = { // Object to pass around and collect IDs if needed by subsequent seeders
    users: {},
    categories: {},
    suppliers: {},
    tags: {},
    taxClasses: {},
    taxRates: {},
    productOptions: {},
    productOptionValues: {},
    products: {}, // Will be populated by seedProducts, e.g., { 'PRODUCT_SKU_1': 1, 'PRODUCT_SKU_2': 2 }
    variants: {}, // Will be populated by seedVariants, e.g., { 'VARIANT_SKU_1': 101, 'VARIANT_SKU_2': 102 }
    // productAssignedOptions and productAssignedOptionSpecificValues might not need IDs stored here
    // if their creation logic directly uses IDs obtained from products/options/values.
  };

  try {
    await client.query('BEGIN');
    console.log('[SEED SCRIPT] Starting seeding transaction.');

    // Call your seeding functions in logical order
    await seedUsers(client, seededDataIds);
    await seedCategories(client, seededDataIds);
    await seedSuppliers(client, seededDataIds);
    await seedTags(client, seededDataIds);
    await seedTaxClassesAndRates(client, seededDataIds);
    await seedProductOptions(client, seededDataIds);
    await seedProductOptionValues(client, seededDataIds); // Depends on ProductOptions
    await seedProducts(client, seededDataIds);           // Depends on Categories, Suppliers, TaxClasses
    await seedProductOptionConfigurations(client, seededDataIds); // Depends on Products, ProductOptions, ProductOptionValues
    await seedVariants(client, seededDataIds);            // Depends on Products and specific ProductOptionValues

    // The actual seedInventoryBatches function (from user) will be called here later
    // For now, it's a placeholder above.
    // await seedInventoryBatches(client, seededDataIds);    // Depends on Products and Variants

    await client.query('COMMIT');
    console.log('[SEED SCRIPT] All data successfully seeded and transaction committed!');

  } catch (error) {
    console.error('[SEED SCRIPT] Error during seeding, rolling back transaction:', error);
    try {
      await client.query('ROLLBACK');
      console.log('[SEED SCRIPT] Transaction rolled back.');
    } catch (rollbackError) {
      console.error('[SEED SCRIPT] Error attempting to roll back transaction:', rollbackError);
    }
    process.exitCode = 1; // Indicate failure to the OS
  } finally {
    if (client) {
      client.release();
      console.log('[SEED SCRIPT] Database client released.');
    }
    // Close the pool when the script is done
    // This allows the Node.js process to exit gracefully
    await db.pool.end();
    console.log('[SEED SCRIPT] Database pool ended. Seeding script finished.');
  }
}

// This actually runs the seeding process when you execute `node seed.js`
if (require.main === module) {
  console.log('[SEED SCRIPT] Initializing...');
  runAllSeeds();
} else {
  // This else block is useful if you ever require('./seed.js') from another file
  // and want to export functions without automatically running the seed.
  console.log('[SEED SCRIPT] Loaded as a module, not running automatically.');
  // module.exports = { runAllSeeds, seedInventoryBatches, /* other specific seeders */ };
}
