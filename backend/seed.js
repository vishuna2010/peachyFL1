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
    throw error;
  }
}

async function seedProducts(client, seededProductIds) {
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
      tags: ['Clothing', 'Men', 'Summer'],
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
      name: 'Modern Thriller Novel',
      description: 'A gripping thriller that will keep you on the edge of your seat.',
      price: 12.99,
      stock_quantity: 250,
      category_name: 'Books',
      supplier_name: null,
      image_url: 'https://via.placeholder.com/300x300.png?text=Thriller+Book',
      sku: 'BOOK-THRILLER-001', // SKU for reviews
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
        const supplierResult = await client.query('SELECT id FROM suppliers WHERE name = $1', [product.supplier_name]);
        if (supplierResult.rows.length > 0) {
          supplierId = supplierResult.rows[0].id;
        } else {
          console.warn(`Supplier "${product.supplier_name}" not found for product "${product.name}". Product will have no supplier.`);
        }
      }

      const productInsertResult = await client.query(
        `INSERT INTO products (name, description, price, stock_quantity, category_id, supplier_id, image_url, sku, reorder_threshold)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name RETURNING id;`,
        [
          product.name, product.description, product.price, product.stock_quantity,
          categoryId, supplierId, product.image_url, product.sku, product.reorder_threshold || 0
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
            baseProductSku: 'TSHRT-MEN-COT-005',
            variantSku: 'TSHRT-RD-S',
            price_modifier: 0.00,
            stock_quantity: 10,
            optionValueMapping: [ { option: 'color', valueKey: 'redId' }, { option: 'size', valueKey: 'smallId' } ]
        },
        {
            baseProductSku: 'TSHRT-MEN-COT-005',
            variantSku: 'TSHRT-BL-M',
            price_modifier: 1.50,
            stock_quantity: 7,
            optionValueMapping: [ { option: 'color', valueKey: 'blueId' }, { option: 'size', valueKey: 'mediumId' } ]
        },
        {
            baseProductSku: 'TSHRT-MEN-COT-005',
            variantSku: 'TSHRT-RD-M',
            price_modifier: 0.50,
            stock_quantity: 12,
            optionValueMapping: [ { option: 'color', valueKey: 'redId' }, { option: 'size', valueKey: 'mediumId' } ]
        },
        {
            baseProductSku: 'HDPHN-WL-BT-001',
            variantSku: 'HDPHN-GRN',
            price_modifier: 0.00,
            stock_quantity: 20,
            optionValueMapping: [ { option: 'color', valueKey: 'greenId' } ]
        },
        {
            baseProductSku: 'HDPHN-WL-BT-001',
            variantSku: 'HDPHN-BLU',
            price_modifier: 0.00,
            stock_quantity: 15,
            optionValueMapping: [ { option: 'color', valueKey: 'blueId' } ]
        },
    ];

    try {
        for (const variantData of variantsToSeed) {
            const baseProductId = seededDataIds.products[variantData.baseProductSku];
            if (!baseProductId) {
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

            console.log(`Processing variant ${variantData.variantSku} for product ID ${baseProductId}`);

            const variantResult = await client.query(
                `INSERT INTO product_variants (base_product_id, sku, price_modifier, stock_quantity)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (sku) DO UPDATE SET price_modifier = EXCLUDED.price_modifier RETURNING id;`,
                [baseProductId, variantData.variantSku, variantData.price_modifier, variantData.stock_quantity]
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
  const client = await pool.connect();
  const seededDataIds = { users: {}, options: {}, optionValues: {}, products: {} };

  try {
    await client.query('BEGIN');

    await seedAdminUser(client, seededDataIds.users);
    await seedRegularUsers(client, seededDataIds.users);
    await seedCategories(client);
    await seedSuppliers(client);
    await seedSpecificGlobalOptionsAndValues(client, seededDataIds);
    await seedProducts(client, seededDataIds.products);

    const productSkusToConfigure = ['TSHRT-MEN-COT-005', 'HDPHN-WL-BT-001'];
    if (Object.keys(seededDataIds.products).length > 0 &&
        seededDataIds.options.colorOptionId && seededDataIds.options.sizeOptionId) {
      await seedProductOptionConfigurations(client, seededDataIds, productSkusToConfigure);
      await seedProductVariants(client, seededDataIds);
    } else {
      console.warn("Skipping product option configurations and variant seeding due to missing product IDs or global option/value IDs.");
    }

    await seedProductReviews(client, seededDataIds);

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

[end of backend/seed.js]
