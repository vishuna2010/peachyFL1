// [ensure all previous content of seed.js remains, only this function is replaced]

async function seedInventoryBatches(client, seededDataIds) {
  console.log('Seeding inventory batches...');
  if (!seededDataIds.products || Object.keys(seededDataIds.products).length === 0) {
    console.warn("Product IDs not available for inventory batch seeding. Skipping.");
    return;
  }

  // Product SKUs from sampleProducts - these are the keys in seededDataIds.products
  const productSkuMap = {
    headphones: 'HDPHN-WL-BT-001',
    tshirt: 'TSHRT-MEN-COT-005',
    ledBulb: 'SMBLB-LED-WIFI-012',
    thrillerNovel: 'BOOK-THRILLER-001',
    gatsbyBook: 'BOOK-GATSBY-PB',
    greenTea: 'TEA-GRN-ORG-100'
  };

  // Variant SKUs from variantsToSeed - these are the keys in seededDataIds.variants
  const variantSkuMap = {
    headphonesGreen: 'HDPHN-GRN', // Belongs to HDPHN-WL-BT-001
    tshirtRedS: 'TSHRT-RD-S',       // Belongs to TSHRT-MEN-COT-005
    tshirtBlueM: 'TSHRT-BL-M'      // Belongs to TSHRT-MEN-COT-005
  };

  // Original stock quantities and costs from product/variant definitions for reference
  // This helps ensure batch quantities align with what was defined during product/variant seeding.
  const productDefinitions = {
    [productSkuMap.headphones]: { cost_price: 89.99 }, // Base product cost, variant has its own
    [productSkuMap.tshirt]: { cost_price: 12.50 },   // Base product cost, variant has its own
    [productSkuMap.ledBulb]: { stock_quantity: 200, cost_price: 9.00 },
    [productSkuMap.thrillerNovel]: { stock_quantity: 250, cost_price: 5.50 },
    [productSkuMap.gatsbyBook]: { stock_quantity: 50, cost_price: 3.50 },
    [productSkuMap.greenTea]: { stock_quantity: 100, cost_price: 7.00 }
  };

  const variantDefinitions = {
    [variantSkuMap.headphonesGreen]: { stock_quantity: 20, cost_price: 92.00, base_product_sku: productSkuMap.headphones },
    [variantSkuMap.tshirtRedS]: { stock_quantity: 10, cost_price: 12.50, base_product_sku: productSkuMap.tshirt },
    [variantSkuMap.tshirtBlueM]: { stock_quantity: 7, cost_price: 13.00, base_product_sku: productSkuMap.tshirt }
  };

  const batchesToSeed = [];

  // Helper to add batch if product/variant exists
  const addBatch = (baseProdSkuKey, varSkuKey, batchNumber, initialQty, currentQty, cost, currency = 'USD', expiry = null) => {
    const productId = seededDataIds.products[productSkuMap[baseProdSkuKey]];
    let variantId = null;
    if (varSkuKey) {
      variantId = seededDataIds.variants ? seededDataIds.variants[variantSkuMap[varSkuKey]] : null;
    }

    if (productId && (varSkuKey ? variantId : true)) { // If varSkuKey is provided, variantId must also be found
      console.log(`[SeedDB] Preparing batch for SKU: ${varSkuKey ? variantSkuMap[varSkuKey] : productSkuMap[baseProdSkuKey]} (ProdID: ${productId}, VarID: ${variantId || 'N/A'})`);
      batchesToSeed.push({
        product_id: productId,
        variant_id: variantId,
        batch_number: batchNumber,
        expiry_date: expiry,
        initial_quantity: initialQty,
        current_quantity: currentQty,
        cost_price_at_receipt: cost,
        currency_code_at_receipt: currency,
        base_currency_cost_price_at_receipt: cost, // Assuming USD is base for simplicity here
        exchange_rate_used: 1.0,
        purchase_order_item_id: null
      });
    } else {
      console.warn(`[SeedDB] Could not find Product ID for ${productSkuMap[baseProdSkuKey]} or Variant ID for ${varSkuKey ? variantSkuMap[varSkuKey] : ''}. Skipping batch: ${batchNumber}`);
    }
  };

  // Seed batches for products WITHOUT variants
  addBatch('ledBulb', null, 'BATCH_LEDBULB001_202308', productDefinitions[productSkuMap.ledBulb].stock_quantity, productDefinitions[productSkuMap.ledBulb].stock_quantity, productDefinitions[productSkuMap.ledBulb].cost_price);
  addBatch('greenTea', null, 'BATCH_TEA001_202307', productDefinitions[productSkuMap.greenTea].stock_quantity, productDefinitions[productSkuMap.greenTea].stock_quantity, productDefinitions[productSkuMap.greenTea].cost_price, 'USD', '2025-12-31');
  addBatch('thrillerNovel', null, 'BATCH_BOOK001_202301', productDefinitions[productSkuMap.thrillerNovel].stock_quantity, productDefinitions[productSkuMap.thrillerNovel].stock_quantity, productDefinitions[productSkuMap.thrillerNovel].cost_price);
  addBatch('gatsbyBook', null, 'BATCH_GATSBY001_202302', productDefinitions[productSkuMap.gatsbyBook].stock_quantity, productDefinitions[productSkuMap.gatsbyBook].stock_quantity, productDefinitions[productSkuMap.gatsbyBook].cost_price);

  // Seed batches for product VARIANTS
  if (variantDefinitions[variantSkuMap.headphonesGreen]) {
    addBatch('headphones', 'headphonesGreen', 'BATCH_HDPHN_GRN_001', variantDefinitions[variantSkuMap.headphonesGreen].stock_quantity, variantDefinitions[variantSkuMap.headphonesGreen].stock_quantity, variantDefinitions[variantSkuMap.headphonesGreen].cost_price, 'USD', '2026-05-31');
  }
  if (variantDefinitions[variantSkuMap.tshirtRedS]) {
    addBatch('tshirt', 'tshirtRedS', 'BATCH_TSHRT_RD_S_001', variantDefinitions[variantSkuMap.tshirtRedS].stock_quantity, variantDefinitions[variantSkuMap.tshirtRedS].stock_quantity, variantDefinitions[variantSkuMap.tshirtRedS].cost_price);
  }
  if (variantDefinitions[variantSkuMap.tshirtBlueM]) {
    addBatch('tshirt', 'tshirtBlueM', 'BATCH_TSHRT_BL_M_001', variantDefinitions[variantSkuMap.tshirtBlueM].stock_quantity, variantDefinitions[variantSkuMap.tshirtBlueM].stock_quantity, variantDefinitions[variantSkuMap.tshirtBlueM].cost_price);
  }

  if (batchesToSeed.length === 0) {
    console.log('No inventory batches to seed based on found products/variants.');
    return;
  }

  try {
    for (const batch of batchesToSeed) {
      console.log(`[SeedDB] Seeding batch: ProdID ${batch.product_id}, VarID ${batch.variant_id}, BatchNo ${batch.batch_number}, Qty ${batch.current_quantity}`);
      await client.query(
        `INSERT INTO inventory_batches
          (product_id, variant_id, batch_number, expiry_date, initial_quantity, current_quantity,
           cost_price_at_receipt, currency_code_at_receipt, base_currency_cost_price_at_receipt, exchange_rate_used, purchase_order_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (product_id, variant_id, batch_number) DO UPDATE SET
           expiry_date = EXCLUDED.expiry_date,
           initial_quantity = EXCLUDED.initial_quantity,
           current_quantity = EXCLUDED.current_quantity,
           cost_price_at_receipt = EXCLUDED.cost_price_at_receipt,
           currency_code_at_receipt = EXCLUDED.currency_code_at_receipt,
           base_currency_cost_price_at_receipt = EXCLUDED.base_currency_cost_price_at_receipt,
           exchange_rate_used = EXCLUDED.exchange_rate_used,
           purchase_order_item_id = EXCLUDED.purchase_order_item_id,
           updated_at = CURRENT_TIMESTAMP;`,
        [
          batch.product_id, batch.variant_id, batch.batch_number, batch.expiry_date, batch.initial_quantity, batch.current_quantity,
          batch.cost_price_at_receipt, batch.currency_code_at_receipt, batch.base_currency_cost_price_at_receipt,
          batch.exchange_rate_used, batch.purchase_order_item_id
        ]
      );
    }
    console.log(`${batchesToSeed.length} inventory batch(es) seeded or updated.`);
  } catch (error) {
    console.error('Error seeding inventory batches:', error);
    // Do not re-throw if minor, or re-throw if critical
  }
}

// [ensure all following content of seed.js remains]
