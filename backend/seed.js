const bcrypt = require('bcrypt');
const db = require('./db'); // Corrected path

// --- Individual Seeding Functions ---

async function seedUsers(client, seededDataIds) {
  console.log('[SeedDB] Seeding users...');
  const usersToSeed = [
    { name: 'Admin User', email: 'admin@example.com', password: 'admin123', role: 'admin' },
    { name: 'Guest User', email: 'guest@example.com', password: 'password123', role: 'guest' },
  ];
  seededDataIds.users = {};
  for (const userData of usersToSeed) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    try {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [userData.name, userData.email, hashedPassword, userData.role]
      );
      if (result.rows.length > 0) {
        seededDataIds.users[userData.email] = result.rows[0].id;
        console.log(`[SeedDB] User seeded/updated: ${userData.email} (ID: ${result.rows[0].id})`);
      } else {
         const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);
         if(existingUser.rows.length > 0) {
            seededDataIds.users[userData.email] = existingUser.rows[0].id;
            console.log(`[SeedDB] User ${userData.email} already existed (ID: ${existingUser.rows[0].id}), details potentially updated.`);
         } else { console.warn(`[SeedDB] Failed to insert or find user ${userData.email} after ON CONFLICT.`); }
      }
    } catch (error) { console.error(`[SeedDB] Error seeding user ${userData.email}:`, error); }
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
  seededDataIds.categories = {};
  for (const catData of categoriesToSeed) {
    const slug = catData.name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
    try {
      const result = await client.query(
        `INSERT INTO categories (name, slug, description, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [catData.name, slug, catData.description]
      );
      if (result.rows.length > 0) {
        seededDataIds.categories[slug] = result.rows[0].id;
        console.log(`[SeedDB] Category seeded/updated: ${catData.name} (ID: ${result.rows[0].id}, Slug: ${slug})`);
      } else { /* Fallback if RETURNING id didn't work as expected with ON CONFLICT */ }
    } catch (error) { console.error(`[SeedDB] Error seeding category ${catData.name}:`, error); }
  }
  console.log('[SeedDB] Category seeding complete.');
}

async function seedSuppliers(client, seededDataIds) {
  console.log('[SeedDB] Seeding suppliers...');
  const suppliersToSeed = [
    { name: 'Global Electronics Inc.', contact_person: 'Jane Doe', email: 'contact@globalelectronics.com', phone: '555-0101', address: '123 Tech Park, Silicon Valley, CA', currency_code: 'USD' },
    { name: 'Fashion Forward Ltd.', contact_person: 'John Smith', email: 'sales@fashionforward.com', phone: '555-0202', address: '456 Fashion Ave, New York, NY', currency_code: 'USD' },
    { name: 'ReadMore Books Co.', contact_person: 'Alice Brown', email: 'info@readmorebooks.com', phone: '555-0303', address: '789 Library Ln, Boston, MA', currency_code: 'USD' }
  ];
  seededDataIds.suppliers = {};
  for (const supData of suppliersToSeed) {
    try {
      const result = await client.query(
        `INSERT INTO suppliers (name, contact_person, email, phone, address, currency_code, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, address = EXCLUDED.address, currency_code = EXCLUDED.currency_code, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [supData.name, supData.contact_person, supData.email, supData.phone, supData.address, supData.currency_code]
      );
      if (result.rows.length > 0) {
        seededDataIds.suppliers[supData.email.toLowerCase()] = result.rows[0].id; // Use email as key
        console.log(`[SeedDB] Supplier seeded/updated: ${supData.name} (ID: ${result.rows[0].id})`);
      } else { /* Fallback */ }
    } catch (error) { console.error(`[SeedDB] Error seeding supplier ${supData.name}:`, error); }
  }
  console.log('[SeedDB] Supplier seeding complete.');
}

async function seedTags(client, seededDataIds) {
  console.log('[SeedDB] Seeding tags...');
  const tagsToSeed = ['new', 'featured', 'sale', 'electronics', 'apparel', 'books', 'eco-friendly', 'handmade', 'vintage', 'staff pick', 'popular', 'gadget', 'audio', 'wireless'];
  seededDataIds.tags = {};
  for (const tagName of tagsToSeed) {
    const lowerTagName = tagName.toLowerCase();
    try {
      const result = await client.query(
        `INSERT INTO tags (name, created_at, updated_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP RETURNING id;`,
        [lowerTagName]
      );
      if (result.rows.length > 0) {
        seededDataIds.tags[lowerTagName] = result.rows[0].id;
        console.log(`[SeedDB] Tag seeded/updated: ${lowerTagName} (ID: ${result.rows[0].id})`);
      } else { /* Fallback */ }
    } catch (error) { console.error(`[SeedDB] Error seeding tag ${tagName}:`, error); }
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
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [tcData.name, tcData.description]
      );
      const taxClassId = result.rows[0].id;
      seededDataIds.taxClasses[tcData.name] = taxClassId;
      console.log(`[SeedDB] Tax Class seeded/updated: ${tcData.name} (ID: ${taxClassId})`);
      if (tcData.name === 'Standard Goods') {
        const rateResult = await client.query( `INSERT INTO tax_rates (tax_class_id, rate, name, country, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (tax_class_id, name, COALESCE(country, ''), COALESCE(state, ''), COALESCE(postal_code, '')) DO UPDATE SET rate = EXCLUDED.rate, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP RETURNING id;`, [taxClassId, 20.00, 'Standard VAT (20%)', null, true]);
        seededDataIds.taxRates['Standard VAT'] = rateResult.rows[0].id;
        console.log(`[SeedDB] Tax Rate seeded for Standard Goods: 20% (ID: ${rateResult.rows[0].id})`);
      } else if (tcData.name === 'Reduced Rate Goods') {
        const rateResult = await client.query( `INSERT INTO tax_rates (tax_class_id, rate, name, country, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (tax_class_id, name, COALESCE(country, ''), COALESCE(state, ''), COALESCE(postal_code, '')) DO UPDATE SET rate = EXCLUDED.rate, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP RETURNING id;`, [taxClassId, 5.00, 'Reduced VAT (5%)', null, true] );
        seededDataIds.taxRates['Reduced VAT'] = rateResult.rows[0].id;
        console.log(`[SeedDB] Tax Rate seeded for Reduced Rate Goods: 5% (ID: ${rateResult.rows[0].id})`);
      }
    } catch (error) { console.error(`[SeedDB] Error seeding tax class ${tcData.name} or its rates:`, error); }
  }
  console.log('[SeedDB] Tax class and rate seeding complete.');
}

async function seedProductOptions(client, seededDataIds) {
  console.log('[SeedDB] Seeding product option types...');
  const optionTypesToSeed = [
    { name: 'Color', display_order: 1, type: 'select' }, { name: 'Size', display_order: 2, type: 'select' },
    { name: 'Material', display_order: 3, type: 'select' }, { name: 'Style', display_order: 4, type: 'select' }
  ];
  seededDataIds.productOptions = {};
  for (const optData of optionTypesToSeed) {
    try {
      const result = await client.query(
        `INSERT INTO product_options (name, display_order, type, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, type = EXCLUDED.type, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [optData.name, optData.display_order, optData.type]
      );
      if (result.rows.length > 0) {
        seededDataIds.productOptions[optData.name] = result.rows[0].id;
        console.log(`[SeedDB] Product Option Type seeded/updated: ${optData.name} (ID: ${result.rows[0].id})`);
      } else { /* Fallback */ }
    } catch (error) { console.error(`[SeedDB] Error seeding product option type ${optData.name}:`, error); }
  }
  console.log('[SeedDB] Product option type seeding complete.');
}

async function seedProductOptionValues(client, seededDataIds) {
  console.log('[SeedDB] Seeding product option values...');
  const optionValuesToSeed = [
    { optionTypeName: 'Color', value: 'Red', display_order: 1 }, { optionTypeName: 'Color', value: 'Blue', display_order: 2 },
    { optionTypeName: 'Color', value: 'Green', display_order: 3 }, { optionTypeName: 'Color', value: 'Black', display_order: 4 },
    { optionTypeName: 'Color', value: 'White', display_order: 5 }, { optionTypeName: 'Color', value: 'Yellow', display_order: 6 },
    { optionTypeName: 'Color', value: 'Pink', display_order: 7 }, { optionTypeName: 'Color', value: 'Purple', display_order: 8 },
    { optionTypeName: 'Color', value: 'Orange', display_order: 9 }, { optionTypeName: 'Color', value: 'Aqua', display_order: 10 },
    { optionTypeName: 'Size', value: 'XS', display_order: 1 }, { optionTypeName: 'Size', value: 'Small', display_order: 2 },
    { optionTypeName: 'Size', value: 'Medium', display_order: 3 }, { optionTypeName: 'Size', value: 'Large', display_order: 4 },
    { optionTypeName: 'Size', value: 'XL', display_order: 5 }, { optionTypeName: 'Size', value: 'XXL', display_order: 6 },
    { optionTypeName: 'Material', value: 'Cotton', display_order: 1 }, { optionTypeName: 'Material', value: 'Polyester', display_order: 2 },
    { optionTypeName: 'Material', value: 'Silk', display_order: 3 }, { optionTypeName: 'Material', value: 'Wool', display_order: 4 },
    { optionTypeName: 'Style', value: 'Casual', display_order: 1 }, { optionTypeName: 'Style', value: 'Formal', display_order: 2 },
    { optionTypeName: 'Style', value: 'Sport', display_order: 3 },
  ];
  seededDataIds.productOptionValues = {};
  for (const valData of optionValuesToSeed) {
    const productOptionId = seededDataIds.productOptions[valData.optionTypeName];
    if (!productOptionId) {
      console.warn(`[SeedDB] Product Option Type "${valData.optionTypeName}" not found. Skipping value "${valData.value}".`);
      continue;
    }
    try {
      const result = await client.query(
        `INSERT INTO product_option_values (product_option_id, value, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (product_option_id, value) DO UPDATE SET display_order = EXCLUDED.display_order, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [productOptionId, valData.value, valData.display_order]
      );
      if (result.rows.length > 0) {
        const key = `${valData.optionTypeName}-${valData.value}`;
        seededDataIds.productOptionValues[key] = result.rows[0].id;
        console.log(`[SeedDB] Product Option Value seeded/updated: ${valData.optionTypeName} - ${valData.value} (ID: ${result.rows[0].id})`);
      } else { /* Fallback */ }
    } catch (error) { console.error(`[SeedDB] Error seeding product option value ${valData.value} for ${valData.optionTypeName}:`, error); }
  }
  console.log('[SeedDB] Product option value seeding complete.');
}

async function seedProducts(client, seededDataIds) {
  console.log('[SeedDB] Seeding products...');
  const productKeyMap = { // Using internal keys that match sampleProducts array
    headphones: 'headphones', tshirt: 'tshirt', ledBulb: 'ledBulb',
    thrillerNovel: 'thrillerNovel', gatsbyBook: 'gatsbyBook', greenTea: 'greenTea'
  };
  const sampleProducts = [
    { key: 'headphones', name: 'Wireless Bluetooth Headphones', description: 'High-fidelity wireless headphones...', price: 149.99, stock_quantity: 0, sku: 'HDPHN-WL-BT-001', categoryName: 'Electronics', supplierKey: 'contact@globalelectronics.com', taxClassName: 'Standard Goods', cost_price: 89.99, has_variants: true, image_url: 'https://shippinsoft.s3.amazonaws.com/product-gallery/1/image-1750900844277-Peachy_Headphone_pink.png', tags: ['audio', 'gadget', 'wireless', 'featured'] },
    { key: 'tshirt', name: 'Men\'s Cotton T-Shirt', description: 'Comfortable 100% cotton t-shirt...', price: 25.00, stock_quantity: 0, sku: 'TSHRT-MEN-COT-005', categoryName: 'Apparel', supplierKey: 'sales@fashionforward.com', taxClassName: 'Standard Goods', cost_price: 12.50, has_variants: true, image_url: null, tags: ['apparel', 'men', 'cotton', 'sale'] },
    { key: 'ledBulb', name: 'Smart LED WiFi Bulb', description: 'Energy-efficient smart LED bulb...', price: 19.99, stock_quantity: 200, sku: 'SMBLB-LED-WIFI-012', categoryName: 'Home & Garden', supplierKey: 'contact@globalelectronics.com', taxClassName: 'Standard Goods', cost_price: 9.00, has_variants: false, image_url: null, tags: ['smart home', 'lighting', 'led'] },
    { key: 'thrillerNovel', name: 'The Midnight Hour - A Thriller Novel', description: 'A gripping psychological thriller...', price: 14.95, stock_quantity: 250, sku: 'BOOK-THRILLER-001', categoryName: 'Books', supplierKey: 'info@readmorebooks.com', taxClassName: 'Reduced Rate Goods', cost_price: 5.50, has_variants: false, image_url: null, tags: ['books', 'thriller', 'fiction', 'new'] },
    { key: 'gatsbyBook', name: 'The Great Gatsby - Paperback', description: 'Classic novel by F. Scott Fitzgerald.', price: 8.99, stock_quantity: 50, sku: 'BOOK-GATSBY-PB', categoryName: 'Books', supplierKey: 'info@readmorebooks.com', taxClassName: 'Reduced Rate Goods', cost_price: 3.50, has_variants: false, tags: ['books', 'classic', 'literature'] },
    { key: 'greenTea', name: 'Organic Green Tea Bags (100 ct)', description: 'Premium organic green tea, 100 tea bags.', price: 15.00, stock_quantity: 100, sku: 'TEA-GRN-ORG-100', categoryName: 'Home & Garden', supplierKey: null, taxClassName: 'Tax Exempt', cost_price: 7.00, has_variants: false, tags: ['tea', 'organic', 'beverage', 'healthy'] }
  ];
  seededDataIds.products = {};
  for (const prodData of sampleProducts) {
    const categorySlug = prodData.categoryName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
    const categoryId = seededDataIds.categories[categorySlug] || null;
    const supplierId = prodData.supplierKey ? seededDataIds.suppliers[prodData.supplierKey] : null;
    const taxClassId = prodData.taxClassName ? seededDataIds.taxClasses[prodData.taxClassName] : null;
    try {
      const result = await client.query(
        `INSERT INTO products (name, description, price, stock_quantity, sku, category_id, supplier_id, tax_class_id, cost_price, has_variants, image_url, product_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, stock_quantity = EXCLUDED.stock_quantity, category_id = EXCLUDED.category_id, supplier_id = EXCLUDED.supplier_id, tax_class_id = EXCLUDED.tax_class_id, cost_price = EXCLUDED.cost_price, has_variants = EXCLUDED.has_variants, image_url = EXCLUDED.image_url, product_status = EXCLUDED.product_status, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [prodData.name, prodData.description, prodData.price, prodData.stock_quantity, prodData.sku, categoryId, supplierId, taxClassId, prodData.cost_price, prodData.has_variants, prodData.image_url, 'active']
      );
      const productId = result.rows[0].id;
      seededDataIds.products[prodData.key] = productId; // Use the internal 'key'
      console.log(`[SeedDB] Product seeded/updated: ${prodData.name} (ID: ${productId}, SKU: ${prodData.sku})`);
      if (prodData.tags && prodData.tags.length > 0) {
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
        for (const tagName of prodData.tags) {
          const tagId = seededDataIds.tags[tagName.toLowerCase()];
          if (tagId) {
            await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;', [productId, tagId]);
          } else { console.warn(`[SeedDB] Tag "${tagName}" not found for product ${prodData.name}.`); }
        }
      }
    } catch (error) { console.error(`[SeedDB] Error seeding product ${prodData.name}:`, error); }
  }
  console.log('[SeedDB] Product seeding complete.');
}

async function seedProductOptionConfigurations(client, seededDataIds) {
  console.log('[SeedDB] Seeding product option configurations...');
  const configurations = [
    { productKey: 'headphones', optionConfigurations: [ { optionTypeName: 'Color', allowedValues: ['Red', 'Blue', 'Green', 'Black', 'White', 'Aqua', 'Pink', 'Yellow', 'Purple', 'Orange'] }, { optionTypeName: 'Size', allowedValues: ['Small', 'Medium', 'Large', 'XL', 'XXL', 'XS'] } ] },
    { productKey: 'tshirt', optionConfigurations: [ { optionTypeName: 'Color', allowedValues: ['Red', 'Blue', 'Black'] }, { optionTypeName: 'Size', allowedValues: ['Small', 'Medium', 'Large'] } ] }
  ];
  for (const config of configurations) {
    const productId = seededDataIds.products[config.productKey];
    if (!productId) { console.warn(`[SeedDB] Product key "${config.productKey}" not found. Skipping option configurations.`); continue; }
    console.log(`[SeedDB] Configuring options for Product ID: ${productId} (${config.productKey})`);
    for (const optConfig of config.optionConfigurations) {
      const productOptionId = seededDataIds.productOptions[optConfig.optionTypeName];
      if (!productOptionId) { console.warn(`[SeedDB] Option Type "${optConfig.optionTypeName}" not found for ${config.productKey}.`); continue; }
      let assignedOptionId;
      try {
        const assignResult = await client.query( `INSERT INTO product_assigned_options (product_id, option_id, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (product_id, option_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP RETURNING id;`, [productId, productOptionId]);
        assignedOptionId = assignResult.rows[0]?.id; // Use optional chaining
        if (!assignedOptionId) { // Fallback if RETURNING id didn't work (e.g. no actual update happened)
            const existingAssign = await client.query('SELECT id FROM product_assigned_options WHERE product_id = $1 AND option_id = $2', [productId, productOptionId]);
            assignedOptionId = existingAssign.rows[0]?.id;
        }
        if (assignedOptionId) console.log(`[SeedDB] Assigned option type "${optConfig.optionTypeName}" to product ID ${productId}. AssignedOptionID: ${assignedOptionId}`);
        else throw new Error('Failed to get assigned_option_id');
      } catch (assignError) { console.error(`[SeedDB] Error assigning option type "${optConfig.optionTypeName}" to product ${config.productKey}:`, assignError); continue; }
      if (optConfig.allowedValues && optConfig.allowedValues.length > 0) {
        await client.query('DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id = $1', [assignedOptionId]);
        for (const valueName of optConfig.allowedValues) {
          const valueKey = `${optConfig.optionTypeName}-${valueName}`;
          const productOptionValueId = seededDataIds.productOptionValues[valueKey];
          if (!productOptionValueId) { console.warn(`[SeedDB] Option Value "${valueName}" for "${optConfig.optionTypeName}" not found. Skipping for ${config.productKey}.`); continue; }
          try {
            await client.query( `INSERT INTO product_assigned_option_specific_values (product_assigned_option_id, product_option_value_id, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (product_assigned_option_id, product_option_value_id) DO NOTHING;`, [assignedOptionId, productOptionValueId]);
          } catch (specificValueError) { console.error(`[SeedDB] Error assigning value "${valueName}" to "${optConfig.optionTypeName}" for ${config.productKey}:`, specificValueError); }
        }
        console.log(`[SeedDB] Assigned ${optConfig.allowedValues.length} specific values for "${optConfig.optionTypeName}" on product ${config.productKey}.`);
      }
    }
  }
  console.log('[SeedDB] Product option configurations seeding complete.');
}

async function seedVariants(client, seededDataIds) {
  console.log('[SeedDB] Seeding product variants...');
  const variantKeyMap = { headphonesGreen: 'headphonesGreen', tshirtRedS: 'tshirtRedS', tshirtBlueM: 'tshirtBlueM' };
  const variantsToSeed = [
    { key: 'headphonesGreen', productKey: 'headphones', sku: 'HDPHN-GRN', price_modifier: 5.00, stock_quantity: 20, cost_price: 92.00, image_url: 'https://shippinsoft.s3.amazonaws.com/product-gallery/1/image-1750900844277-Peachy_Headphone_pink.png', optionValueKeys: ['Color-Aqua', 'Size-Medium'] },
    { key: 'tshirtRedS', productKey: 'tshirt', sku: 'TSHRT-RD-S', price_modifier: 0.00, stock_quantity: 10, cost_price: 12.50, image_url: null, optionValueKeys: ['Color-Red', 'Size-Small'] },
    { key: 'tshirtBlueM', productKey: 'tshirt', sku: 'TSHRT-BL-M', price_modifier: 1.50, stock_quantity: 7, cost_price: 13.00, image_url: null, optionValueKeys: ['Color-Blue', 'Size-Medium'] }
  ];
  seededDataIds.variants = {};
  for (const varData of variantsToSeed) {
    const productId = seededDataIds.products[varData.productKey];
    if (!productId) { console.warn(`[SeedDB] Product key "${varData.productKey}" not found for variant SKU "${varData.sku}". Skipping.`); continue; }
    const optionValueIds = varData.optionValueKeys.map(key => seededDataIds.productOptionValues[key]).filter(id => id !== undefined);
    if (optionValueIds.length !== varData.optionValueKeys.length) { console.warn(`[SeedDB] Not all option values found for variant SKU "${varData.sku}". Skipping.`); continue; }
    try {
      const variantResult = await client.query(
        `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (sku) DO UPDATE SET product_id = EXCLUDED.product_id, price_modifier = EXCLUDED.price_modifier, stock_quantity = EXCLUDED.stock_quantity, image_url = EXCLUDED.image_url, cost_price = EXCLUDED.cost_price, updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [productId, varData.sku, varData.price_modifier, varData.stock_quantity, varData.image_url, varData.cost_price]
      );
      const variantId = variantResult.rows[0].id;
      seededDataIds.variants[varData.key] = variantId;
      console.log(`[SeedDB] Variant seeded/updated: ${varData.sku} (ID: ${variantId}) for Product ID ${productId}`);
      await client.query('DELETE FROM product_variant_option_values WHERE product_variant_id = $1;', [variantId]);
      for (const optionValueId of optionValueIds) {
        await client.query( `INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2) ON CONFLICT (product_variant_id, product_option_value_id) DO NOTHING;`, [variantId, optionValueId]);
      }
      console.log(`[SeedDB] Linked ${optionValueIds.length} option values to variant ID ${variantId}.`);
      await client.query('UPDATE products SET has_variants = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND has_variants = FALSE;', [productId]);
    } catch (error) { console.error(`[SeedDB] Error seeding variant SKU ${varData.sku}:`, error); }
  }
  console.log('[SeedDB] Variant seeding complete.');
}

async function seedInventoryBatches(client, seededDataIds) {
  console.log('[SeedDB] Seeding inventory batches...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0) {
    console.warn("[SeedDB] Product IDs (from product keys like 'headphones') not available in seededDataIds for inventory batch seeding. Skipping.");
    return;
  }
   if (!seededDataIds.variants || Object.keys(seededDataIds.variants).length === 0) {
    console.warn("[SeedDB] Variant IDs (from variant keys like 'headphonesGreen') not available in seededDataIds. Some variant batches may be skipped if they rely on these.");
  }

  const productKeyMap = { // Renamed from productSkuMap to avoid confusion, these are internal keys
    headphones: 'headphones', tshirt: 'tshirt', ledBulb: 'ledBulb',
    thrillerNovel: 'thrillerNovel', gatsbyBook: 'gatsbyBook', greenTea: 'greenTea'
  };
  const variantKeyMap = { // Renamed from variantSkuMap
    headphonesGreen: 'headphonesGreen', tshirtRedS: 'tshirtRedS', tshirtBlueM: 'tshirtBlueM'
  };

  // Definitions should use the same keys as in seedProducts and seedVariants for consistency
  const productDefinitionsForBatch = {
    [productKeyMap.headphones]: { cost_price: 89.99 },
    [productKeyMap.tshirt]: { cost_price: 12.50 },
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
    const productId = seededDataIds.products[productKey]; // Use the productKey directly
    let variantId = null;
    if (variantKey) { variantId = seededDataIds.variants ? seededDataIds.variants[variantKey] : null; }

    if (productId && (variantKey ? variantId : true)) {
      console.log(`[SeedDB] Preparing batch for ProductKey: ${productKey}, VariantKey: ${variantKey || 'N/A'} (ProdID: ${productId}, VarID: ${variantId || 'N/A'}), BatchNo: ${batchNumber}`);
      batchesToSeed.push({ product_id: productId, variant_id: variantId, batch_number: batchNumber, expiry_date: expiry, initial_quantity: initialQty, current_quantity: currentQty, cost_price_at_receipt: cost, currency_code_at_receipt: currency, base_currency_cost_price_at_receipt: cost, exchange_rate_used: 1.0, purchase_order_item_id: null });
    } else { console.warn(`[SeedDB] Could not find Product ID for key ${productKey} or Variant ID for key ${variantKey || ''}. Skipping batch: ${batchNumber}`); }
  };

  // Seed batches for products WITHOUT variants
  for (const key of ['ledBulb', 'thrillerNovel', 'gatsbyBook', 'greenTea']) {
    const pDef = productDefinitionsForBatch[key]; // Use key directly
    if (pDef && pDef.stock_quantity > 0) { addBatch(key, null, `BATCH_${key.toUpperCase()}_001`, pDef.stock_quantity, pDef.stock_quantity, pDef.cost_price); }
  }
   const gtDef = productDefinitionsForBatch[productKeyMap.greenTea]; // This was okay, but ensure key consistency
   // The loop above already handles greenTea if productKeyMap.greenTea resolves to 'greenTea'

  // Seed batches for product VARIANTS
  for (const key in variantDefinitionsForBatch) { // key here is like 'headphonesGreen'
      const vDef = variantDefinitionsForBatch[key];
      if (vDef && vDef.stock_quantity > 0) {
          addBatch(vDef.productKey, key, `BATCH_${key.toUpperCase()}_001`, vDef.stock_quantity, vDef.stock_quantity, vDef.cost_price, 'USD', key === 'headphonesGreen' ? '2026-05-31' : null);
      }
  }

  if (batchesToSeed.length === 0) { console.log('[SeedDB] No inventory batches to seed based on product/variant definitions and found IDs.'); return; }
  try {
    for (const batch of batchesToSeed) {
      console.log(`[SeedDB] Seeding batch: ProdID ${batch.product_id}, VarID ${batch.variant_id}, BatchNo ${batch.batch_number}, Qty ${batch.current_quantity}`);
      await client.query(
        `INSERT INTO inventory_batches
          (product_id, variant_id, batch_number, expiry_date, initial_quantity, current_quantity,
           cost_price_at_receipt, currency_code_at_receipt, base_currency_cost_price_at_receipt, exchange_rate_used, purchase_order_item_id, received_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (product_id, variant_id, batch_number) DO UPDATE SET
           expiry_date = EXCLUDED.expiry_date, initial_quantity = EXCLUDED.initial_quantity, current_quantity = EXCLUDED.current_quantity,
           cost_price_at_receipt = EXCLUDED.cost_price_at_receipt, currency_code_at_receipt = EXCLUDED.currency_code_at_receipt,
           base_currency_cost_price_at_receipt = EXCLUDED.base_currency_cost_price_at_receipt, exchange_rate_used = EXCLUDED.exchange_rate_used,
           purchase_order_item_id = EXCLUDED.purchase_order_item_id, updated_at = CURRENT_TIMESTAMP;`,
        [ batch.product_id, batch.variant_id, batch.batch_number, batch.expiry_date, batch.initial_quantity, batch.current_quantity, batch.cost_price_at_receipt, batch.currency_code_at_receipt, batch.base_currency_cost_price_at_receipt, batch.exchange_rate_used, batch.purchase_order_item_id ]
      );
    }
    console.log(`[SeedDB] ${batchesToSeed.length} inventory batch(es) seeded or updated.`);
  } catch (error) { console.error('[SeedDB] Error seeding inventory batches:', error); }
}


// Main seeding orchestrator
