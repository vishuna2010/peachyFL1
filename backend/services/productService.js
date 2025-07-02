const db = require('../db');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');
const config = require('../config'); // Consolidated: Main config
const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service'); // Consolidated
const { getOrCreateTagIds, getS3KeyFromUrl } = require('../utils/productHelpers'); // Consolidated
const taxService = require('../services/taxService'); // Consolidated

// Helper function to get the array of global product_option_value_ids for a variant
async function getVariantOptionValueIds(variantId, client) {
  const query = `
    SELECT product_option_value_id
    FROM product_variant_option_values
    WHERE variant_id = $1
    ORDER BY product_option_value_id ASC;
  `;
  const result = await client.query(query, [variantId]);
  return result.rows.map(r => r.product_option_value_id);
}

// --- Internal Helper Functions for getAllProducts ---

function _buildProductStockCTEString() {
  return `
    product_effective_stock AS (
      SELECT
        p_stock.id as product_id,
        CASE
          WHEN p_stock.has_variants THEN
            COALESCE(
              (SELECT SUM(ib.quantity_remaining)
               FROM inventory_batches ib
               WHERE ib.product_id = p_stock.id AND ib.variant_id IS NOT NULL AND ib.quantity_remaining > 0),
            0)
          ELSE
            COALESCE(
              (SELECT SUM(ib.quantity_remaining)
               FROM inventory_batches ib
               WHERE ib.product_id = p_stock.id AND ib.variant_id IS NULL AND ib.quantity_remaining > 0),
            0)
        END as effective_stock_quantity,
        CASE
          WHEN p_stock.has_variants THEN
            (COALESCE((SELECT SUM(ib.quantity_remaining) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NOT NULL AND ib.quantity_remaining > 0), 0) > 0 AND
             COALESCE((SELECT SUM(ib.quantity_remaining) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NOT NULL AND ib.quantity_remaining > 0), 0) < p_stock.reorder_threshold)
          ELSE
            (COALESCE((SELECT SUM(ib.quantity_remaining) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NULL AND ib.quantity_remaining > 0), 0) > 0 AND
             COALESCE((SELECT SUM(ib.quantity_remaining) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NULL AND ib.quantity_remaining > 0), 0) < p_stock.reorder_threshold)
        END as is_low_stock
      FROM products p_stock
    )
  `;
}

function _buildProductBaseQueryParts(options = {}) {
  const { optionValueId, include_total_stock } = options;

  const productColumns = `
    p.id, p.name, p.description, p.price, p.category_id, p.image_url,
    p.stock_quantity, p.sku, p.supplier_id, p.reorder_threshold,
    p.has_variants, p.average_rating, p.review_count, p.product_status,
    p.tax_class_id, p.created_at, p.updated_at
  `;

  let selectColumns = `${productColumns},
    c.name as category_name, s.name as supplier_name,
    tc.name as tax_class_name,
    COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags,
    pes.effective_stock_quantity, pes.is_low_stock`;

  if (include_total_stock) {
    selectColumns += `, pes.effective_stock_quantity as total_stock_display`;
  }

  let fromClause = `
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN product_effective_stock pes ON p.id = pes.product_id
    LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
  `;

  let selectDistinctOn = "";
  if (optionValueId) {
    selectDistinctOn = "DISTINCT ON (p.id)";
    fromClause += `
      LEFT JOIN product_variants pv_filter ON p.id = pv_filter.product_id
      LEFT JOIN product_variant_option_values pvov_filter ON pv_filter.id = pvov_filter.variant_id
    `;
  }

  // Base for count query needs to adapt if optionValueId is present
  let countFromClause = `
    FROM products p
    LEFT JOIN product_effective_stock pes ON p.id = pes.product_id
  `;
  if (optionValueId) {
    countFromClause += `
      LEFT JOIN product_variants pv_filter_count ON p.id = pv_filter_count.product_id
      LEFT JOIN product_variant_option_values pvov_filter_count ON pv_filter_count.id = pvov_filter_count.variant_id
    `;
  }


  return {
    selectColumns,     // The columns string for the main data query (without SELECT or DISTINCT ON)
    selectDistinctOn,  // "DISTINCT ON (p.id)" or ""
    fromClause,        // FROM and JOIN clauses for the main data query
    groupByClause: `GROUP BY ${productColumns}, c.name, s.name, tc.name, pes.effective_stock_quantity, pes.is_low_stock`, // GROUP BY for main data query
    countFromClause    // FROM and JOIN clauses for the count query (simpler than main fromClause usually)
  };
}

function _buildProductFilterConditions(options = {}, startingParamIndex = 1) {
  const {
    searchTerm, categoryId, minPrice, maxPrice, optionValueId,
    status, stock_status, supplierId, is_admin_request,
    optionValueFilterAlias = 'pvov_filter' // New: Allow specifying alias for option value join
  } = options;

  const whereClauses = [];
  const queryParams = [];
  let paramIndex = startingParamIndex;

  if (!is_admin_request) {
    whereClauses.push(`p.product_status = 'active'`);
  }

  if (searchTerm) {
    const searchTermPattern = `%${searchTerm}%`;
    queryParams.push(searchTermPattern); // Add once for all ILIKEs using the same param index
    let searchCondition = `(
      p.name ILIKE $${paramIndex} OR
      p.description ILIKE $${paramIndex} OR
      p.sku ILIKE $${paramIndex} OR
      (p.has_variants AND EXISTS (
        SELECT 1 FROM product_variants pv_search
        WHERE pv_search.product_id = p.id AND pv_search.sku ILIKE $${paramIndex}
      ))
    )`;
    whereClauses.push(searchCondition);
    paramIndex++;
  }

  if (categoryId) {
    whereClauses.push(`p.category_id = $${paramIndex}`);
    queryParams.push(categoryId);
    paramIndex++;
  }

  const validatedSupplierId = supplierId ? parseInt(supplierId, 10) : undefined;
  if (validatedSupplierId && validatedSupplierId > 0) {
    whereClauses.push(`p.supplier_id = $${paramIndex}`);
    queryParams.push(validatedSupplierId);
    paramIndex++;
  }

  if (minPrice !== undefined) {
    whereClauses.push(`p.price >= $${paramIndex}`);
    queryParams.push(minPrice);
    paramIndex++;
  }
  if (maxPrice !== undefined) {
    whereClauses.push(`p.price <= $${paramIndex}`);
    queryParams.push(maxPrice);
    paramIndex++;
  }

  if (optionValueId) {
    const intOptionValueId = parseInt(optionValueId, 10);
    if (!isNaN(intOptionValueId)) {
      // Use the provided alias for the join condition
      whereClauses.push(`${optionValueFilterAlias}.product_option_value_id = $${paramIndex}`);
      queryParams.push(intOptionValueId);
      paramIndex++;
    } else {
      console.warn(`Invalid optionValueId encountered in _buildProductFilterConditions: ${optionValueId}. Skipping filter.`);
    }
  }

  if (status && status !== 'all') {
    whereClauses.push(`p.product_status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  if (stock_status && stock_status !== 'all') {
    if (stock_status === 'in_stock') {
      whereClauses.push(`pes.effective_stock_quantity > 0`);
    } else if (stock_status === 'out_of_stock') {
      whereClauses.push(`(pes.effective_stock_quantity <= 0 OR pes.effective_stock_quantity IS NULL)`);
    } else if (stock_status === 'low_stock') {
      whereClauses.push(`pes.is_low_stock = TRUE`);
    }
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return { whereString, queryParams, finalParamIndex: paramIndex };
}

function _buildProductSortLogic(options = {}) {
  const { sortBy, sort_order = 'ASC', optionValueId } = options;
  const sortOrderSql = (sort_order && sort_order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

  const allowedSorts = {
    'price': `p.price ${sortOrderSql} NULLS LAST`,
    'name': `p.name ${sortOrderSql}`,
    'created_at': `p.created_at ${sortOrderSql}`,
    'stock': `pes.effective_stock_quantity ${sortOrderSql} NULLS LAST`,
    'product_status': `p.product_status ${sortOrderSql}`,
    'sku': `p.sku ${sortOrderSql}`
  };

  let orderByClause = "";
  if (optionValueId) { // When DISTINCT ON (p.id) is used for optionValueId filter
    orderByClause = `ORDER BY p.id ${sortOrderSql}`; // p.id must be first
    if (sortBy && allowedSorts[sortBy] && sortBy !== 'id') { // Do not duplicate p.id sort
        orderByClause += `, ${allowedSorts[sortBy]}`;
    } else if (!sortBy || sortBy === 'id') {
        // Default secondary sort if sortBy is not valid, not provided, or is 'id'
        orderByClause += `, p.created_at ${sortOrderSql}`;
    }
  } else if (sortBy && allowedSorts[sortBy]) {
    orderByClause = `ORDER BY ${allowedSorts[sortBy]}`;
  } else {
    orderByClause = `ORDER BY p.created_at ${sortOrderSql}`; // Default sort
  }
  return orderByClause;
}


// --- Public Service Methods ---

async function getAllProducts(options = {}) {
  const {
    page = 1,
    limit = 10,
    ...filterAndSortOptions
  } = options;

  const stockCteString = _buildProductStockCTEString();
  const withClause = `WITH ${stockCteString}`;
  const baseQueryParts = _buildProductBaseQueryParts(filterAndSortOptions);
  const filterConditions = _buildProductFilterConditions(filterAndSortOptions, 1);
  const orderByClause = _buildProductSortLogic(filterAndSortOptions);
  const selectPrefix = filterAndSortOptions.optionValueId ? `SELECT ${baseQueryParts.selectDistinctOn}` : "SELECT";

  let dataQueryString = `
    ${withClause}
    ${selectPrefix} ${baseQueryParts.selectColumns}
    ${baseQueryParts.fromClause}
    ${filterConditions.whereString}
    ${baseQueryParts.groupByClause}
    ${orderByClause}
  `;

  const numPage = Number(page) || 1;
  const numLimit = Number(limit) || 10;
  const offset = (numPage - 1) * numLimit;

  dataQueryString += ` LIMIT $${filterConditions.finalParamIndex} OFFSET $${filterConditions.finalParamIndex + 1}`;
  const finalDataParams = [...filterConditions.queryParams, numLimit, offset];

  const countFilterConditions = _buildProductFilterConditions({ ...filterAndSortOptions, optionValueFilterAlias: 'pvov_filter_count' }, 1);
  let countWhereString = countFilterConditions.whereString;
  if (filterAndSortOptions.optionValueId) {
      countWhereString = countFilterConditions.whereString.replace('pvov_filter.product_option_value_id', 'pvov_filter_count.product_option_value_id');
  }

  let countQueryString = `
    ${withClause}
    SELECT COUNT(DISTINCT p.id) as total_count
    ${baseQueryParts.countFromClause}
    ${countWhereString}
  `;

  try {
    const productsResult = await db.query(dataQueryString, finalDataParams);
    const countResult = await db.query(countQueryString, countFilterConditions.queryParams);
    const totalProducts = parseInt(countResult.rows[0].total_count);

    return {
      products: productsResult.rows,
      totalProducts: totalProducts,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(totalProducts / numLimit)
    };
  } catch (error) {
    console.error("Error in getAllProducts service:", error);
    throw new AppError("Failed to retrieve products.", 500, "PRODUCT_FETCH_ALL_FAILED", { originalError: error.message });
  }
}

async function getProductById(productId) {
  const client = await db.pool.connect();
  try {
    const productQuery = `
      SELECT p.*,
             c.name as category_name,
             s.name as supplier_name,
             tc.name as tax_class_name,
             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id
      LEFT JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, c.name, s.name, tc.name;
    `;
    const productResult = await client.query(productQuery, [productId]);

    if (productResult.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const product = productResult.rows[0];

    if (!product.has_variants) {
      const baseProductBatchStockQuery = await client.query(
        `SELECT COALESCE(SUM(ib.quantity_remaining), 0) as total_batch_stock
         FROM inventory_batches ib
         WHERE ib.product_id = $1 AND ib.variant_id IS NULL`,
        [productId]
      );
      product.stock_quantity = parseInt(baseProductBatchStockQuery.rows[0]?.total_batch_stock || 0, 10);
    } else {
      const baseProductOwnStockQuery = await client.query(
        `SELECT COALESCE(SUM(ib.quantity_remaining), 0) as total_batch_stock
         FROM inventory_batches ib
         WHERE ib.product_id = $1 AND ib.variant_id IS NULL`,
        [productId]
      );
      product.stock_quantity = parseInt(baseProductOwnStockQuery.rows[0]?.total_batch_stock || 0, 10);
    }

    const imagesQuery = `
      SELECT id, image_url AS url, alt_text, display_order, is_primary
      FROM product_images
      WHERE product_id = $1
      ORDER BY display_order ASC, id ASC;
    `;
    const imagesResult = await client.query(imagesQuery, [productId]);
    const primaryGalleryImage = imagesResult.rows.find(img => img.is_primary);
    if (primaryGalleryImage) {
      product.image_url = primaryGalleryImage.url;
    }

    product.profit_margin_details = calculateProfitMargin(product.price, product.cost_price);

    if (product.has_variants) {
      const availableOptionsQuery = `
        SELECT
            po.id as option_id,
            po.name as option_name,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('value_id', pov.id, 'value_name', pov.value, 'assigned_option_specific_value_table_id', paosv.id))
              FILTER (WHERE pov.id IS NOT NULL),
              '[]'::json
            ) as "values"
        FROM product_assigned_options pao
        JOIN product_options po ON pao.option_id = po.id
        JOIN product_assigned_option_specific_values paosv ON pao.id = paosv.product_assigned_option_id
        JOIN product_option_values pov ON paosv.product_option_value_id = pov.id
        WHERE pao.product_id = $1
        GROUP BY po.id, po.name
        ORDER BY po.name;
      `;
      const availableOptionsResult = await client.query(availableOptionsQuery, [productId]);
      product.available_options = availableOptionsResult.rows;

      const variantsQuery = `
        SELECT id, sku, price_modifier, stock_quantity, image_url, cost_price, wholesale_price_modifier
        FROM product_variants
        WHERE product_id = $1
        ORDER BY id ASC;
      `;
      const variantsResult = await client.query(variantsQuery, [productId]);
      product.variants = variantsResult.rows;

      for (const variant of product.variants) {
        variant.option_value_ids = await getVariantOptionValueIds(variant.id, client);
        variant.final_price = (parseFloat(product.price) + parseFloat(variant.price_modifier)).toFixed(2);
        const batchStockQuery = await client.query(
          `SELECT COALESCE(SUM(quantity_remaining), 0) as total_batch_stock
           FROM inventory_batches
           WHERE variant_id = $1 AND product_id = $2 AND quantity_remaining > 0`,
          [variant.id, product.id]
        );
        variant.stock_quantity = parseInt(batchStockQuery.rows[0]?.total_batch_stock || 0, 10);
        variant.profit_margin_details = calculateProfitMargin(variant.final_price, variant.cost_price);
        const baseProductWholesalePrice = product.wholesale_price !== null ? parseFloat(product.wholesale_price) : null;
        const variantWholesaleModifier = variant.wholesale_price_modifier !== null ? parseFloat(variant.wholesale_price_modifier) : 0;
        if (baseProductWholesalePrice !== null) {
          variant.final_wholesale_price = parseFloat((baseProductWholesalePrice + variantWholesaleModifier).toFixed(2));
        } else {
          variant.final_wholesale_price = null;
        }
      }
    } else {
      product.available_options = [];
      product.variants = [];
    }

    product.gallery_images = imagesResult.rows.map(img => ({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text || product.name,
      display_order: img.display_order,
      is_primary: img.is_primary
    })).sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      if ((a.display_order || 0) !== (b.display_order || 0)) {
        return (a.display_order || 0) - (b.display_order || 0);
      }
      return a.id - b.id;
    });

    const currentPrimaryFromGallery = product.gallery_images.find(img => img.is_primary);
    if (currentPrimaryFromGallery) {
      product.image_url = currentPrimaryFromGallery.url;
    } else if (product.gallery_images.length > 0 && !product.image_url) {
       product.image_url = product.gallery_images[0].url;
    } else if (product.gallery_images.length === 0 && product.image_url) {
      product.gallery_images.push({
        id: 'main_product_' + product.id,
        url: product.image_url,
        alt_text: product.name + " (Primary)",
        display_order: 0,
        is_primary: true
      });
    }
    return product;
  } finally {
    if (client) client.release();
  }
}

function calculateProfitMargin(sellingPrice, costPrice) {
    const sp = parseFloat(sellingPrice);
    const cp = parseFloat(costPrice);
    if (isNaN(sp) || isNaN(cp)) return { profit_amount: null, profit_percentage: null };
    const profitAmount = parseFloat((sp - cp).toFixed(2));
    let profitPercentage = null;
    if (cp > 0) profitPercentage = parseFloat((profitAmount / cp * 100).toFixed(2));
    else if (cp === 0 && sp === 0) profitPercentage = 0;
    return { profit_amount: profitAmount, profit_percentage: profitPercentage };
}

async function createProduct(productData, fileData) {
  const {
    name, description, price, category_id, supplier_id, sku,
    reorder_threshold, product_status = 'draft',
    tax_class_id, cost_price, wholesale_price,
    brand_manufacturer, supplier_reference, specifications,
    tags: tagNames
  } = productData;

  const client = await db.pool.connect();
  let s3FileKeyToStore = null;
  let imageUrlToStoreInDb = null;

  try {
    await client.query('BEGIN');

    if (fileData) {
      if (!isS3Configured()) throw new AppError("Image upload service is not configured.", 500, "S3_NOT_CONFIGURED");
      const uniqueFileName = `product-images/product-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
      const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
      imageUrlToStoreInDb = s3Data.Location;
      s3FileKeyToStore = s3Data.Key;
    }

    const insertQuery = `
      INSERT INTO products (
        name, description, price, category_id, supplier_id, sku,
        reorder_threshold, product_status, image_url, tax_class_id, cost_price,
        wholesale_price, brand_manufacturer, supplier_reference, specifications,
        has_variants, average_rating, review_count, stock_quantity,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, FALSE, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id;`;
    const values = [
      name, description || null, price, category_id || null, supplier_id || null, sku || null,
      reorder_threshold || null, product_status, imageUrlToStoreInDb,
      tax_class_id || null, cost_price || null, wholesale_price || null,
      brand_manufacturer || null, supplier_reference || null,
      specifications ? (typeof specifications === 'string' ? specifications : JSON.stringify(specifications)) : null,
    ];
    const result = await client.query(insertQuery, values);
    const newProductId = result.rows[0].id;

    const initialStockQuantity = parseInt(productData.stock_quantity, 10);
    if (!isNaN(initialStockQuantity) && initialStockQuantity > 0) {
      const batchNumber = `INITIAL-${sku || `PROD${newProductId}`}-${Date.now()}`;
      const costAtReceipt = cost_price !== null ? cost_price : 0;
      const currencyCodeAtReceipt = (config.company && config.company.currencyCode) || 'USD'; // Corrected
      await client.query(
        `INSERT INTO inventory_batches
          (product_id, variant_id, batch_number, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, received_date)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id;`,
        [newProductId, batchNumber, initialStockQuantity, initialStockQuantity, costAtReceipt, currencyCodeAtReceipt]
      );
      const requestingUserId = productData.requestingUserId || null;
      await client.query(
        `INSERT INTO stock_movement_logs
            (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, NULL, $2, 'initial_stock_setup', $3, $4, $5, $6)`,
        [newProductId, requestingUserId, initialStockQuantity, initialStockQuantity, 'Initial stock for new product', `product_id:${newProductId}`]
      );
    }

    if (Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client);
      for (const tagId of tagIds) {
        await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newProductId, tagId]);
      }
    }
    await client.query('COMMIT');
    return getProductById(newProductId);
  } catch (error) {
    if (client) try { await client.query('ROLLBACK'); } catch (rbErr) { console.error("Error during ROLLBACK:", rbErr); }
    if (s3FileKeyToStore && isS3Configured()) {
      try { await deleteFileFromS3(s3FileKeyToStore); }
      catch (s3RollbackError) { console.error(`CRITICAL: Failed to rollback S3 upload for key ${s3FileKeyToStore}:`, s3RollbackError); }
    }
    if (error.code === '23505' && error.constraint === 'products_sku_key') throw new ConflictError(`SKU "${sku}" already exists.`);
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) throw error;
    console.error('Error in productService.createProduct:', error);
    throw new AppError('Failed to create product.', 500, 'PRODUCT_CREATION_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}

async function updateProduct(productId, productData, fileData, removeImage = false) {
  const {
    name, description, price, category_id, supplier_id, sku,
    stock_quantity, reorder_threshold, product_status, tax_class_id,
    cost_price, wholesale_price, brand_manufacturer, supplier_reference,
    specifications, tags: tagNames, image_url: imageUrlFromRequest
  } = productData;

  const client = await db.pool.connect();
  let s3FileKeyToStore = null;
  let finalImageUrlToStoreInDb = undefined;
  let oldS3KeyToDelete = null;

  try {
    await client.query('BEGIN');
    const currentProductResult = await client.query('SELECT image_url, sku, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (currentProductResult.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
    const currentProduct = currentProductResult.rows[0];
    finalImageUrlToStoreInDb = currentProduct.image_url;

    if (fileData) {
      if (!isS3Configured()) throw new AppError("Image upload service is not configured.", 500, "S3_NOT_CONFIGURED");
      const uniqueFileName = `product-images/product-${productId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
      const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
      finalImageUrlToStoreInDb = s3Data.Location;
      s3FileKeyToStore = s3Data.Key;
      if (currentProduct.image_url) oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url);
    } else if (removeImage === true || imageUrlFromRequest === null) {
        if (currentProduct.image_url && isS3Configured()) oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url);
        finalImageUrlToStoreInDb = null;
    }

    const setClauses = [];
    const queryUpdateValues = [];
    let currentParamIndex = 1;
    const addUpdateClause = (field, value, isJson = false) => {
      if (productData.hasOwnProperty(field) || (field === 'image_url' && finalImageUrlToStoreInDb !== currentProduct.image_url)) {
        setClauses.push(`${field} = $${currentParamIndex++}`);
        queryUpdateValues.push(isJson && value !== null && typeof value !== 'string' ? JSON.stringify(value) : (value === '' && ['description', 'sku', 'brand_manufacturer', 'supplier_reference'].includes(field) ? null : value));
      }
    };

    addUpdateClause('name', name);
    addUpdateClause('description', description);
    addUpdateClause('price', price);
    addUpdateClause('category_id', category_id === '' ? null : category_id);
    addUpdateClause('supplier_id', supplier_id === '' ? null : supplier_id);
    addUpdateClause('sku', sku);
    if (productData.hasOwnProperty('stock_quantity') && !currentProduct.has_variants) addUpdateClause('stock_quantity', stock_quantity);
    else if (productData.hasOwnProperty('stock_quantity') && currentProduct.has_variants) console.warn(`Attempt to update base stock_quantity for product ID ${productId} which has variants. Ignored.`);
    addUpdateClause('reorder_threshold', reorder_threshold === '' ? null : reorder_threshold);
    addUpdateClause('product_status', product_status);
    if (finalImageUrlToStoreInDb !== currentProduct.image_url) productData.image_url = finalImageUrlToStoreInDb;
    addUpdateClause('image_url', productData.image_url);
    addUpdateClause('tax_class_id', tax_class_id === '' ? null : tax_class_id);
    addUpdateClause('cost_price', cost_price === '' ? null : cost_price);
    addUpdateClause('wholesale_price', wholesale_price === '' ? null : wholesale_price);
    addUpdateClause('brand_manufacturer', brand_manufacturer);
    addUpdateClause('supplier_reference', supplier_reference);
    addUpdateClause('specifications', specifications, true);

    let productUpdated = false;
    if (setClauses.length > 0) {
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      const updateQueryString = `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${currentParamIndex} RETURNING id`;
      queryUpdateValues.push(productId);
      const updateResult = await client.query(updateQueryString, queryUpdateValues);
      if (updateResult.rowCount > 0) productUpdated = true;
    }

    let tagsUpdated = false;
    if (productData.hasOwnProperty('tags')) {
        tagsUpdated = true;
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
        if (Array.isArray(tagNames) && tagNames.length > 0) {
            const tagIds = await getOrCreateTagIds(tagNames, client);
            for (const tagId of tagIds) {
                await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [productId, tagId]);
            }
        }
    }
    if (tagsUpdated && !productUpdated && setClauses.length === 0) {
        await client.query('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [productId]);
    }

    await client.query('COMMIT');
    if (oldS3KeyToDelete && isS3Configured()) {
      try { await deleteFileFromS3(oldS3KeyToDelete); }
      catch (s3DeleteError) { console.error(`Failed to delete old S3 image ${oldS3KeyToDelete}:`, s3DeleteError); }
    }
    return getProductById(productId);
  } catch (error) {
    if (client) try { await client.query('ROLLBACK'); } catch (rbErr) { console.error("Error during ROLLBACK:", rbErr); }
    if (s3FileKeyToStore && isS3Configured()) {
      try { await deleteFileFromS3(s3FileKeyToStore); }
      catch (s3RollbackError) { console.error(`CRITICAL: Failed to rollback S3 upload for key ${s3FileKeyToStore}:`, s3RollbackError); }
    }
    if (error.code === '23505' && error.constraint === 'products_sku_key') throw new ConflictError(`SKU "${sku}" already exists.`);
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) throw error;
    console.error(`Error in productService.updateProduct for ID ${productId}:`, error);
    throw new AppError('Failed to update product.', 500, 'PRODUCT_UPDATE_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}

async function updateProductStock(productId, newStockQuantity, reason = 'Manual stock adjustment', requestingUserId = null) {
  if (newStockQuantity === undefined || newStockQuantity === null || isNaN(parseInt(newStockQuantity)) || parseInt(newStockQuantity) < 0) {
    throw new BadRequestError('New stock quantity must be a non-negative integer.');
  }
  const targetStockQty = parseInt(newStockQuantity);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const productDetailsResult = await client.query('SELECT id, sku, cost_price, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (productDetailsResult.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
    const product = productDetailsResult.rows[0];
    if (product.has_variants) throw new BadRequestError(`Stock for product ID ${productId} (with variants) must be managed at variant level.`);

    const currentStockResult = await client.query(
      `SELECT COALESCE(SUM(quantity_remaining), 0) AS total_batch_stock FROM inventory_batches WHERE product_id = $1 AND variant_id IS NULL`, [productId]);
    const currentTotalBatchStock = parseInt(currentStockResult.rows[0].total_batch_stock, 10);
    const stockChange = targetStockQty - currentTotalBatchStock;

    if (stockChange !== 0) {
      if (stockChange > 0) {
        const manualBatchNumber = `MANUAL-${product.sku || `PROD${productId}`}-${Date.now()}`;
        const costAtReceipt = product.cost_price !== null ? product.cost_price : 0;
        const currencyCodeAtReceipt = (config.company && config.company.currencyCode) || 'USD'; // Corrected
        await client.query(
          `INSERT INTO inventory_batches (product_id, variant_id, batch_number, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, received_date)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [productId, manualBatchNumber, stockChange, stockChange, costAtReceipt, currencyCodeAtReceipt]
        );
      } else {
        console.warn(`[ProductService.updateProductStock] Stock decrease of ${-stockChange} for non-variant product ${productId}. Batch depletion logic not fully implemented here.`);
      }
      await client.query(
        `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)`,
        [productId, requestingUserId, (stockChange > 0 ? 'manual_adjustment_increase' : 'manual_adjustment_decrease'), stockChange, targetStockQty, reason, `product_id:${productId}`]
      );
    }
    await client.query('UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [targetStockQty, productId]);
    await client.query('COMMIT');
    return getProductById(productId);
  } catch (error) {
    if (client) try { await client.query('ROLLBACK'); } catch (rbErr) { console.error("Error during ROLLBACK:", rbErr); }
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) throw error;
    console.error(`Error in productService.updateProductStock for ID ${productId}:`, error);
    throw new AppError(`Failed to update stock for product ID ${productId}.`, 500, 'PRODUCT_STOCK_UPDATE_UNHANDLED_ERROR');
  } finally {
    client.release();
  }
}

async function getAllStockLevels(options = {}) {
  const { page = 1, limit = 20, search_term, category_id, supplier_id, low_stock_only = false, sort_by = 'product_name', sort_order = 'ASC' } = options;
  const offset = (page - 1) * limit;
  const queryParams = [];
  let paramIndex = 1;

  const batchStockCte = `effective_batch_stock AS (SELECT product_id, variant_id, COALESCE(SUM(quantity_remaining), 0) AS actual_stock_from_batches FROM inventory_batches WHERE quantity_remaining > 0 GROUP BY product_id, variant_id)`;
  const stockItemsCte = `stock_items_base AS (
      SELECT p.id AS product_id, NULL::INT AS variant_id, p.name AS item_name, p.sku AS item_sku, COALESCE(ebs_prod.actual_stock_from_batches, 0) AS stock_quantity, p.reorder_threshold, p.has_variants, p.category_id, c.name AS category_name, p.supplier_id, s.name AS supplier_name, 'product' AS item_type, p.name AS sort_product_name, p.sku AS sort_sku
      FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN suppliers s ON p.supplier_id = s.id LEFT JOIN effective_batch_stock ebs_prod ON p.id = ebs_prod.product_id AND ebs_prod.variant_id IS NULL WHERE p.has_variants = FALSE
      UNION ALL
      SELECT p.id AS product_id, pv.id AS variant_id, p.name || ' - ' || COALESCE(pv.sku, 'Variant ' || pv.id) AS item_name, pv.sku AS item_sku, COALESCE(ebs_var.actual_stock_from_batches, 0) AS stock_quantity, p.reorder_threshold, TRUE AS has_variants, p.category_id, c.name AS category_name, p.supplier_id, s.name AS supplier_name, 'variant' AS item_type, p.name AS sort_product_name, pv.sku AS sort_sku
      FROM product_variants pv JOIN products p ON pv.product_id = p.id LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN suppliers s ON p.supplier_id = s.id LEFT JOIN effective_batch_stock ebs_var ON p.id = ebs_var.product_id AND pv.id = ebs_var.variant_id
    )`;
  const finalCtes = `WITH ${batchStockCte}, ${stockItemsCte}`;
  let conditions = [];
  if (search_term) { conditions.push(`(item_name ILIKE $${paramIndex} OR item_sku ILIKE $${paramIndex})`); queryParams.push(`%${search_term}%`); paramIndex++; }
  if (category_id) { conditions.push(`category_id = $${paramIndex}`); queryParams.push(category_id); paramIndex++; }
  if (supplier_id) { conditions.push(`supplier_id = $${paramIndex}`); queryParams.push(supplier_id); paramIndex++; }
  if (low_stock_only === true) conditions.push(`(stock_quantity <= reorder_threshold AND reorder_threshold IS NOT NULL AND reorder_threshold > 0)`);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countQueryString = `${finalCtes} SELECT COUNT(*) as total_count FROM stock_items_base ${whereClause}`;
    const countResult = await db.query(countQueryString, queryParams);
    const totalItems = parseInt(countResult.rows[0].total_count);
    let sortColumn = 'sort_product_name';
    if (sort_by === 'sku') sortColumn = 'item_sku'; else if (sort_by === 'stock_quantity') sortColumn = 'stock_quantity'; else if (sort_by === 'reorder_threshold') sortColumn = 'reorder_threshold';
    const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderByClause = `ORDER BY ${sortColumn} ${safeSortOrder} NULLS LAST, product_id ${safeSortOrder}, variant_id ${safeSortOrder} NULLS LAST`;
    const dataQueryString = `${finalCtes} SELECT * FROM stock_items_base ${whereClause} ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataFinalParams = [...queryParams, limit, offset];
    const itemsResult = await db.query(dataQueryString, dataFinalParams);
    return { data: itemsResult.rows, pagination: { total: totalItems, page, limit, totalPages: Math.ceil(totalItems / limit), sort_by, sort_order: safeSortOrder } };
  } catch (error) {
    console.error('Error in productService.getAllStockLevels:', error);
    throw new AppError('Failed to retrieve stock levels.', 500, 'STOCK_LEVELS_FETCH_FAILED');
  }
}

async function getProductInventoryBatches(productId, options = {}) {
  const { variant_id, page = 1, limit = 10, sort_by = 'received_date_desc' } = options;
  const offset = (page - 1) * limit;
  const queryParams = [productId];
  let paramIndex = 1;
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
  let whereClauses = ['ib.product_id = $1'];
  if (variant_id) { paramIndex++; queryParams.push(variant_id); whereClauses.push(`ib.variant_id = $${paramIndex}`); }
  const whereString = whereClauses.join(' AND ');
  let orderByClause = 'ORDER BY ib.received_date DESC, ib.id DESC';
  switch (sort_by) {
    case 'received_date_asc': orderByClause = 'ORDER BY ib.received_date ASC, ib.id ASC'; break;
    case 'expiry_date_asc': orderByClause = 'ORDER BY ib.expiry_date ASC NULLS LAST, ib.id ASC'; break;
    case 'expiry_date_desc': orderByClause = 'ORDER BY ib.expiry_date DESC NULLS FIRST, ib.id DESC'; break;
    case 'quantity_remaining_asc': orderByClause = 'ORDER BY ib.quantity_remaining ASC, ib.id ASC'; break;
    case 'quantity_remaining_desc': orderByClause = 'ORDER BY ib.quantity_remaining DESC, ib.id DESC'; break;
  }
  const dataQuery = `
    SELECT ib.*, p.name as product_name, pv.sku as variant_sku, po.id as purchase_order_id, s.name as supplier_name
    FROM inventory_batches ib JOIN products p ON ib.product_id = p.id LEFT JOIN product_variants pv ON ib.variant_id = pv.id
    LEFT JOIN purchase_order_items poi ON ib.purchase_order_item_id = poi.id LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE ${whereString} ${orderByClause} LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2};`;
  const dataParams = [...queryParams, limit, offset];
  const countQuery = `SELECT COUNT(*) as total_count FROM inventory_batches ib WHERE ${whereString};`;
  const countParams = queryParams.slice(0, paramIndex);
  try {
    const dataResult = await db.query(dataQuery, dataParams);
    const countResult = await db.query(countQuery, countParams);
    const totalRecords = parseInt(countResult.rows[0].total_count);
    return { data: dataResult.rows, pagination: { total: totalRecords, page, limit, totalPages: Math.ceil(totalRecords / limit), sort_by } };
  } catch (error) {
    console.error(`Error in productService.getProductInventoryBatches for product ID ${productId}:`, error);
    throw new AppError('Failed to retrieve inventory batches.', 500, 'PRODUCT_INV_BATCHES_FETCH_FAILED');
  }
}

async function getProductCostHistory(productId, options = {}) {
  const { variant_id, supplier_id, page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;
  const queryParams = [productId];
  let paramIndex = 1;
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
  let whereClauses = ['pch.product_id = $1'];
  if (variant_id) { paramIndex++; queryParams.push(variant_id); whereClauses.push(`pch.variant_id = $${paramIndex}`); }
  if (supplier_id) { paramIndex++; queryParams.push(supplier_id); whereClauses.push(`pch.supplier_id = $${paramIndex}`); }
  const whereString = whereClauses.join(' AND ');
  const dataQuery = `
    SELECT pch.id, pch.product_id, p.name as product_name, pch.variant_id, pv.sku as variant_sku, pch.supplier_id, s.name as supplier_name,
           pch.currency_code, pch.cost_price, pch.quantity_received, pch.purchase_order_item_id, poi.quantity_ordered as po_item_quantity_ordered,
           po.id as purchase_order_id, pch.effective_date, pch.created_at
    FROM product_cost_history pch JOIN products p ON pch.product_id = p.id LEFT JOIN product_variants pv ON pch.variant_id = pv.id
    LEFT JOIN suppliers s ON pch.supplier_id = s.id LEFT JOIN purchase_order_items poi ON pch.purchase_order_item_id = poi.id
    LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE ${whereString} ORDER BY pch.effective_date DESC, pch.id DESC
    LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2};`;
  const dataParams = [...queryParams, limit, offset];
  const countQuery = `SELECT COUNT(*) as total_count FROM product_cost_history pch WHERE ${whereString};`;
  const countParams = queryParams.slice(0, paramIndex);
  try {
    const dataResult = await db.query(dataQuery, dataParams);
    const countResult = await db.query(countQuery, countParams);
    const totalRecords = parseInt(countResult.rows[0].total_count);
    return { data: dataResult.rows, pagination: { total: totalRecords, page, limit, totalPages: Math.ceil(totalRecords / limit) } };
  } catch (error) {
    console.error(`Error in productService.getProductCostHistory for product ID ${productId}:`, error);
    throw new AppError('Failed to retrieve product cost history.', 500, 'PRODUCT_COST_HISTORY_FETCH_FAILED');
  }
}

async function getFormattedLabelData(productId, requestedVariantId = null, forAllVariants = false) {
  const product = await getProductById(productId);
  const STORE_CURRENCY_CODE = (config.company && config.company.currencyCode) || 'USD'; // Corrected
  const STORE_CURRENCY_SYMBOL = (config.company && config.company.currencySymbol) || '$'; // Corrected
  const PRODUCT_PAGE_BASE_URL = config.frontendUrlBase || 'http://localhost:3001';
  const labelsData = [];

  const processItemForLabel = async (item, isVariant) => {
    const baseSellingPrice = parseFloat(isVariant ? item.final_price : product.price);
    let taxDetails = { taxAmount: 0, priceWithTax: baseSellingPrice, appliedRates: [] };
    if (product.tax_class_id) {
      try { taxDetails = await taxService.calculatePriceWithAppliedTaxes(baseSellingPrice, product.tax_class_id); }
      catch (taxError) { console.error(`Error calculating tax for item (Product: ${product.id}, Variant: ${isVariant ? item.id : 'N/A'}):`, taxError.message); }
    }
    let full_display_name = product.name;
    let itemSku = product.sku;
    let variantIdForQr = null;
    if (isVariant) {
      let suffixParts = [];
      if (product.available_options && item.option_value_ids) {
        for (const valId of item.option_value_ids) {
          for (const opt of product.available_options) {
            const foundValue = opt.values.find(v => v.value_id === valId);
            if (foundValue) { suffixParts.push(`${opt.option_name}: ${foundValue.value_name}`); break; }
          }
        }
      }
      full_display_name += suffixParts.length > 0 ? ` - ${suffixParts.join(', ')}` : (item.sku ? ` - ${item.sku}` : ` - Variant ${item.id}`);
      itemSku = item.sku || product.sku;
      variantIdForQr = item.id;
    }
    const barcodeValue = itemSku || product.id.toString() + (isVariant ? `-${item.id}` : '');
    return {
      product_id: product.id, variant_id: isVariant ? item.id : null, product_name: product.name,
      variant_name_suffix: isVariant ? full_display_name.substring(product.name.length) : null,
      full_display_name, sku: itemSku, barcode_value: barcodeValue, selling_price: baseSellingPrice.toFixed(2),
      price_incl_tax: parseFloat(taxDetails.priceWithTax).toFixed(2), tax_amount: parseFloat(taxDetails.taxAmount).toFixed(2),
      applied_tax_rates: taxDetails.appliedRates, currency_code: STORE_CURRENCY_CODE, currency_symbol: STORE_CURRENCY_SYMBOL,
      qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}${variantIdForQr ? `?variantId=${variantIdForQr}` : ''}`,
      qr_code_data_reorder_url: `${PRODUCT_PAGE_BASE_URL}/cart?action=add&productId=${product.id}${variantIdForQr ? `&variantId=${variantIdForQr}` : ''}&quantity=1`,
      qr_code_data_promotion_url: `${PRODUCT_PAGE_BASE_URL}/promotions?ref_product=${product.id}${variantIdForQr ? `&ref_variant=${variantIdForQr}` : ''}`
    };
  };

  if (forAllVariants) {
    if (product.has_variants && product.variants && product.variants.length > 0) {
      for (const variant of product.variants) labelsData.push(await processItemForLabel(variant, true));
    } else labelsData.push(await processItemForLabel(product, false));
    return labelsData;
  } else if (requestedVariantId && product.has_variants) {
    const variant = product.variants.find(v => v.id === requestedVariantId);
    if (!variant) throw new NotFoundError(`Variant with ID ${requestedVariantId} not found for product ${productId}.`);
    return processItemForLabel(variant, true);
  } else return processItemForLabel(product, false);
}

async function getProductAssignedOptions(productId) {
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
  const query = `
    SELECT pao.id AS assigned_option_id, pao.option_id AS global_option_id, po.name AS global_option_name, pao.created_at, pao.updated_at,
           COALESCE((SELECT json_agg(json_build_object('id', pov.id, 'value', pov.value) ORDER BY pov.value ASC)
                     FROM product_assigned_option_specific_values paosv JOIN product_option_values pov ON paosv.product_option_value_id = pov.id
                     WHERE paosv.product_assigned_option_id = pao.id), '[]'::json) AS selected_values
    FROM product_assigned_options pao JOIN product_options po ON pao.option_id = po.id
    WHERE pao.product_id = $1 ORDER BY po.name;`;
  try {
    const result = await db.query(query, [productId]);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching assigned options for product ID ${productId} in service:`, error);
    throw new AppError(`Failed to retrieve assigned options for product ID ${productId}.`, 500, 'PRODUCT_ASSIGNED_OPTIONS_FETCH_FAILED');
  }
}

async function _getVariantOptionDetails(variantId, client) {
  const detailsQuery = `
    SELECT pov.id as option_value_id, pov.value as option_value_name, po.id as option_id, po.name as option_name
    FROM product_variant_option_values pvov JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
    JOIN product_options po ON pov.product_option_id = po.id WHERE pvov.variant_id = $1 ORDER BY po.name, pov.value;`;
  const dbExecutor = client || db;
  const { rows } = await dbExecutor.query(detailsQuery, [variantId]);
  return rows;
}

async function getProductVariants(productId) {
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
  const variantsResult = await db.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id', [productId]);
  const variants = [];
  for (const variant of variantsResult.rows) {
    const details = await _getVariantOptionDetails(variant.id);
    variants.push({ ...variant, selected_options: details });
  }
  return variants;
}

async function getVariantById(variantId) {
  const variantResult = await db.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
  if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
  const variant = variantResult.rows[0];
  const details = await _getVariantOptionDetails(variant.id);
  return { ...variant, selected_options: details };
}

async function createProductVariant(productId, variantData, fileData, requestingUserId = null) {
  const { sku, price_modifier, stock_quantity, image_url: directImageUrl, option_value_ids, cost_price, wholesale_price_modifier } = variantData;
  const finalSku = sku && sku.trim() !== '' ? sku.trim() : null;
  const numPriceModifier = parseFloat(price_modifier);
  const numStockQuantity = parseInt(stock_quantity, 10);
  const numCostPrice = (cost_price !== undefined && cost_price !== null && cost_price !== '') ? parseFloat(cost_price) : null;
  const numWholesalePriceModifier = (wholesale_price_modifier !== undefined && wholesale_price_modifier !== null && wholesale_price_modifier !== '') ? parseFloat(wholesale_price_modifier) : null;

  if (isNaN(numPriceModifier)) throw new BadRequestError('Price modifier must be a valid number.');
  if (isNaN(numStockQuantity) || numStockQuantity < 0) throw new BadRequestError('Stock quantity must be a non-negative integer.');
  if (numCostPrice !== null && (isNaN(numCostPrice) || numCostPrice < 0)) throw new BadRequestError('Cost price must be non-negative.');
  if (numWholesalePriceModifier !== null && isNaN(numWholesalePriceModifier)) throw new BadRequestError('Wholesale price modifier must be a number or null.');
  if (!Array.isArray(option_value_ids) || option_value_ids.length === 0) throw new BadRequestError('At least one option value ID is required.');
  const uniqueOptionValueIds = [...new Set(option_value_ids.map(id => parseInt(id)))];
  if (uniqueOptionValueIds.some(isNaN)) throw new BadRequestError('All option value IDs must be integers.');
  if (uniqueOptionValueIds.length !== option_value_ids.length) throw new BadRequestError('Duplicate option value IDs provided.');

  const client = await db.pool.connect();
  let s3VariantFileKey = null;
  let variantImageUrl = directImageUrl || null;

  try {
    await client.query('BEGIN');
    const productResult = await client.query('SELECT id, name, sku as parent_sku FROM products WHERE id = $1 FOR UPDATE', [productId]); // Added parent_sku
    if (productResult.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
    const parentProductSku = productResult.rows[0].parent_sku;

    const selectedGlobalOptionTypes = new Set();
    for (const globalValueId of uniqueOptionValueIds) {
      const valueCheck = await client.query(`SELECT pov.product_option_id, po.name AS option_name FROM product_option_values pov JOIN product_options po ON pov.product_option_id = po.id WHERE pov.id = $1`, [globalValueId]);
      if (valueCheck.rows.length === 0) throw new NotFoundError(`Global option value ID ${globalValueId} not found.`);
      const globalOptionId = valueCheck.rows[0].product_option_id;
      if (selectedGlobalOptionTypes.has(globalOptionId)) throw new BadRequestError(`Multiple values selected for option type "${valueCheck.rows[0].option_name}".`);
      selectedGlobalOptionTypes.add(globalOptionId);
      const assignmentCheck = await client.query( `SELECT paosv.id FROM product_assigned_option_specific_values paosv JOIN product_assigned_options pao ON paosv.product_assigned_option_id = pao.id WHERE pao.product_id = $1 AND pao.option_id = $2 AND paosv.product_option_value_id = $3`, [productId, globalOptionId, globalValueId]);
      if (assignmentCheck.rows.length === 0) throw new BadRequestError(`Option value ID ${globalValueId} (for option ${valueCheck.rows[0].option_name}) is not assigned to product ID ${productId}.`);
    }

    const sortedIds = [...uniqueOptionValueIds].sort((a, b) => a - b);
    const existingVariantsCheckQuery = `
      SELECT pv.id FROM product_variants pv WHERE pv.product_id = $1 AND
      (SELECT array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id) FROM product_variant_option_values pvov WHERE pvov.variant_id = pv.id) = $2::int[];`;
    const duplicateCheckResult = await client.query(existingVariantsCheckQuery, [productId, sortedIds]);
    if (duplicateCheckResult.rows.length > 0) throw new ConflictError('A variant with this combination of option values already exists.');

    const skuForBatch = finalSku || parentProductSku || `VAR_NEW_BATCH_${productId}`; // Determine SKU for batch
    if (!skuForBatch) { // Should not happen with the fallback, but as a safeguard
        throw new AppError('Cannot determine SKU for inventory batch creation.', 500, 'BATCH_SKU_DETERMINATION_FAILED');
    }


    if (finalSku) {
      const skuCheck = await client.query(`SELECT id FROM product_variants WHERE sku = $1 UNION SELECT id FROM products WHERE sku = $1`, [finalSku]);
      if (skuCheck.rows.length > 0) throw new ConflictError(`SKU "${finalSku}" already exists.`);
    }

    if (fileData) {
        if (!isS3Configured()) throw new AppError("Variant image S3 service not configured.", 500, "S3_NOT_CONFIGURED");
        const uniqueFileName = `product-variants/variant-${productId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
        const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
        variantImageUrl = s3Data.Location;
        s3VariantFileKey = s3Data.Key;
    }

    const variantInsertResult = await client.query(
      `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, wholesale_price_modifier)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [productId, finalSku, numPriceModifier, numStockQuantity, variantImageUrl, numCostPrice, numWholesalePriceModifier]
    );
    const newVariant = variantInsertResult.rows[0];

    for (const ovId of uniqueOptionValueIds) {
      await client.query('INSERT INTO product_variant_option_values (variant_id, product_option_value_id) VALUES ($1, $2)',[newVariant.id, ovId]);
    }
    await client.query('UPDATE products SET has_variants = TRUE, updated_at = NOW() WHERE id = $1 AND has_variants = FALSE', [productId]);

    if (newVariant.stock_quantity > 0) {
      const batchNumber = `INITIAL-${newVariant.sku || `VAR${newVariant.id}`}-${Date.now()}`;
      const costAtReceipt = newVariant.cost_price !== null ? newVariant.cost_price : 0;
      const currencyCodeAtReceipt = (config.company && config.company.currencyCode) || 'USD';
      await client.query(
        `INSERT INTO inventory_batches (product_id, variant_id, batch_number, sku, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, received_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) RETURNING id;`,
        [newVariant.product_id, newVariant.id, batchNumber, skuForBatch, newVariant.stock_quantity, newVariant.stock_quantity, costAtReceipt, currencyCodeAtReceipt]
      );
      await client.query(
        `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newVariant.product_id, newVariant.id, requestingUserId, 'initial_stock_setup', newVariant.stock_quantity, newVariant.stock_quantity, 'Initial stock for new variant', `variant_id:${newVariant.id}`]
      );
    }
    await client.query('COMMIT');
    const finalVariantDetails = await _getVariantOptionDetails(newVariant.id, client);
    return { ...newVariant, selected_options: finalVariantDetails };
  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (s3VariantFileKey && isS3Configured()) {
        try { await deleteFileFromS3(s3VariantFileKey); }
        catch (s3e) { console.error(`CRITICAL: Failed to rollback S3 upload for variant image ${s3VariantFileKey}:`, s3e); }
    }
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) throw error;
    console.error('Error in productService.createProductVariant:', error);
    throw new AppError('Failed to create product variant.', 500, 'VARIANT_CREATION_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}

async function updateProductVariant(variantId, variantData, fileData, removeImageByFlag = false, requestingUserId = null) {
  const { sku, price_modifier, stock_quantity, image_url: directImageUrl, option_value_ids, reason, cost_price, wholesale_price_modifier } = variantData;
  const client = await db.pool.connect();
  let s3NewFileKey = null;
  let s3OldFileKey = null;
  let finalImageUrl = undefined;

  try {
    await client.query('BEGIN');
    const currentVariantResult = await client.query('SELECT * FROM product_variants WHERE id = $1 FOR UPDATE', [variantId]);
    if (currentVariantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
    const currentVariant = currentVariantResult.rows[0];
    finalImageUrl = currentVariant.image_url;

    if (fileData) {
      if (!isS3Configured()) throw new AppError("S3 service not configured.", 500, "S3_NOT_CONFIGURED");
      if (currentVariant.image_url) s3OldFileKey = getS3KeyFromUrl(currentVariant.image_url);
      const uniqueFileName = `product-variants/variant-${currentVariant.product_id}-${variantId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
      const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
      finalImageUrl = s3Data.Location;
      s3NewFileKey = s3Data.Key;
    } else if (removeImageByFlag || (variantData.hasOwnProperty('image_url') && directImageUrl === null)) {
      if (currentVariant.image_url && isS3Configured()) s3OldFileKey = getS3KeyFromUrl(currentVariant.image_url);
      finalImageUrl = null;
    } else if (variantData.hasOwnProperty('image_url') && typeof directImageUrl === 'string') {
        if (currentVariant.image_url && currentVariant.image_url !== directImageUrl && isS3Configured()) s3OldFileKey = getS3KeyFromUrl(currentVariant.image_url);
        finalImageUrl = directImageUrl;
    }

    let newAggregateStockForVariantTable = currentVariant.stock_quantity;
    if (stock_quantity !== undefined && stock_quantity !== null) {
      const targetStock = parseInt(stock_quantity, 10);
      if (isNaN(targetStock) || targetStock < 0) throw new BadRequestError('Stock quantity must be non-negative.');
      newAggregateStockForVariantTable = targetStock;
      const existingBatchStockResult = await client.query( `SELECT COALESCE(SUM(quantity_remaining), 0) AS total_batch_stock FROM inventory_batches WHERE variant_id = $1 AND product_id = $2`, [variantId, currentVariant.product_id]);
      const currentTotalBatchStock = parseInt(existingBatchStockResult.rows[0].total_batch_stock, 10);
      const stockChange = targetStock - currentTotalBatchStock;

      if (stockChange !== 0) {
        const changeReason = reason || 'Manual stock adjustment via variant edit';
        if (stockChange > 0) {
          const manualBatchNumber = `MANUAL-${currentVariant.sku || `VAR${variantId}`}-${Date.now()}`;
          const costAtReceipt = variantData.cost_price !== undefined ? parseFloat(variantData.cost_price) : (currentVariant.cost_price !== null ? currentVariant.cost_price : 0);
          const currencyCodeAtReceipt = (config.company && config.company.currencyCode) || 'USD';

          let batchSku = currentVariant.sku;
          if (!batchSku) {
            const productSkuResult = await client.query('SELECT sku FROM products WHERE id = $1', [currentVariant.product_id]);
            if (productSkuResult.rows.length > 0 && productSkuResult.rows[0].sku) {
              batchSku = productSkuResult.rows[0].sku;
              console.log(`Variant ${variantId} has no SKU, using parent product SKU '${batchSku}' for inventory batch.`);
            } else {
              batchSku = `VAR_BATCH_${variantId}`;
              console.warn(`Variant ${variantId} and its parent product ${currentVariant.product_id} have no SKU. Using placeholder '${batchSku}' for inventory batch.`);
            }
          }

          await client.query(
            `INSERT INTO inventory_batches (product_id, variant_id, batch_number, sku, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, received_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
            [currentVariant.product_id, variantId, manualBatchNumber, batchSku, stockChange, stockChange, costAtReceipt, currencyCodeAtReceipt]
          );
        } else {
             console.warn(`[ProductService] Stock decrease of ${-stockChange} for variant ${variantId}. Batch depletion logic not fully implemented here.`);
        }
        await client.query(
          `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [currentVariant.product_id, variantId, requestingUserId, 'manual_adjustment', stockChange, targetStock, changeReason, `variant_id:${variantId}`]
        );
      }
    }

    if (option_value_ids) {
      const uniqueNewOptionValueIds = [...new Set(option_value_ids.map(id => parseInt(id)))].sort((a, b) => a - b);
      if (uniqueNewOptionValueIds.some(isNaN)) throw new BadRequestError('All option value IDs must be integers.');
      if (uniqueNewOptionValueIds.length !== option_value_ids.length && option_value_ids.length > 0) throw new BadRequestError('Duplicate option value IDs.');
      if (uniqueNewOptionValueIds.length === 0) throw new BadRequestError('At least one option value ID required if updating options.');
      const newSelectedGlobalOptionTypes = new Set();
      for (const globalValueId of uniqueNewOptionValueIds) {
        const valueCheck = await client.query(`SELECT pov.product_option_id, po.name AS option_name FROM product_option_values pov JOIN product_options po ON pov.product_option_id = po.id WHERE pov.id = $1`, [globalValueId]);
        if (valueCheck.rows.length === 0) throw new NotFoundError(`Global option value ID ${globalValueId} not found.`);
        const globalOptionId = valueCheck.rows[0].product_option_id;
        if (newSelectedGlobalOptionTypes.has(globalOptionId)) throw new BadRequestError(`Multiple values for option type "${valueCheck.rows[0].option_name}".`);
        newSelectedGlobalOptionTypes.add(globalOptionId);
        const assignmentCheck = await client.query( `SELECT paosv.id FROM product_assigned_option_specific_values paosv JOIN product_assigned_options pao ON paosv.product_assigned_option_id = pao.id WHERE pao.product_id = $1 AND pao.option_id = $2 AND paosv.product_option_value_id = $3`, [currentVariant.product_id, globalOptionId, globalValueId]);
        if (assignmentCheck.rows.length === 0) throw new BadRequestError(`Option value ID ${globalValueId} (option ${valueCheck.rows[0].option_name}) not assigned to product ID ${currentVariant.product_id}.`);
      }
      const duplicateCheck = await client.query( `SELECT pv.id FROM product_variants pv WHERE pv.product_id = $1 AND pv.id != $2 AND (SELECT array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id) FROM product_variant_option_values pvov WHERE pvov.variant_id = pv.id) = $3::int[]`, [currentVariant.product_id, variantId, uniqueNewOptionValueIds]);
      if (duplicateCheck.rows.length > 0) throw new ConflictError('Another variant with this option combination exists.');
      await client.query('DELETE FROM product_variant_option_values WHERE variant_id = $1', [variantId]);
      for (const ovId of uniqueNewOptionValueIds) await client.query('INSERT INTO product_variant_option_values (variant_id, product_option_value_id) VALUES ($1, $2)', [variantId, ovId]);
    }

    const finalSku = (variantData.hasOwnProperty('sku') && sku && sku.trim() !== '') ? sku.trim() : ( (variantData.hasOwnProperty('sku') && (sku === null || sku === '')) ? null : currentVariant.sku);
    if (finalSku && finalSku !== currentVariant.sku) {
        const skuCheck = await client.query( `SELECT id FROM product_variants WHERE sku = $1 AND id != $2 UNION SELECT id FROM products WHERE sku = $1`, [finalSku, variantId]);
        if (skuCheck.rows.length > 0) throw new ConflictError(`SKU "${finalSku}" already exists.`);
    }

    const setClauses = [];
    const queryValues = [];
    let paramIndex = 1;
    const addUpdateField = (fieldName, value, currentValue) => {
      if (variantData.hasOwnProperty(fieldName) || (fieldName === 'image_url' && finalImageUrl !== currentValue) ) {
        setClauses.push(`${fieldName} = $${paramIndex++}`);
        queryValues.push(value);
      }
    };
    addUpdateField('sku', finalSku, currentVariant.sku);
    if(variantData.hasOwnProperty('price_modifier')) addUpdateField('price_modifier', parseFloat(price_modifier), parseFloat(currentVariant.price_modifier));
    if(variantData.hasOwnProperty('stock_quantity')) addUpdateField('stock_quantity', newAggregateStockForVariantTable, currentVariant.stock_quantity);
    if(finalImageUrl !== currentVariant.image_url) {
        if (!setClauses.some(c => c.startsWith('image_url'))) { setClauses.push(`image_url = $${paramIndex++}`); queryValues.push(finalImageUrl); }
    } else if (variantData.hasOwnProperty('image_url') && finalImageUrl !== currentVariant.image_url) {
        if (!setClauses.some(c => c.startsWith('image_url'))) { setClauses.push(`image_url = $${paramIndex++}`); queryValues.push(finalImageUrl); }
    }
    if(variantData.hasOwnProperty('cost_price')) addUpdateField('cost_price', (cost_price !== undefined && cost_price !== null && cost_price !== '') ? parseFloat(cost_price) : null, currentVariant.cost_price);
    if(variantData.hasOwnProperty('wholesale_price_modifier')) addUpdateField('wholesale_price_modifier', (wholesale_price_modifier !== undefined && wholesale_price_modifier !== null && wholesale_price_modifier !== '') ? parseFloat(wholesale_price_modifier) : null, currentVariant.wholesale_price_modifier);

    let updatedVariant = currentVariant;
    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      const updateQueryString = `UPDATE product_variants SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      queryValues.push(variantId);
      const updatedResult = await client.query(updateQueryString, queryValues);
      updatedVariant = updatedResult.rows[0];
    }
    await client.query('COMMIT');
    if (s3OldFileKey && s3OldFileKey !== s3NewFileKey) {
        try { await deleteFileFromS3(s3OldFileKey); }
        catch (s3e) { console.error(`Failed to delete old S3 variant image ${s3OldFileKey}:`, s3e); }
    }
    const optionDetails = await _getVariantOptionDetails(updatedVariant.id, client);
    return { ...updatedVariant, selected_options: optionDetails };
  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (s3NewFileKey && isS3Configured()) {
        try { await deleteFileFromS3(s3NewFileKey); }
        catch (s3e) { console.error(`CRITICAL: Failed to rollback S3 upload for new variant image ${s3NewFileKey}:`, s3e); }
    }
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) throw error;
    console.error(`Error in productService.updateProductVariant for ID ${variantId}:`, error);
    throw new AppError('Failed to update product variant.', 500, 'VARIANT_UPDATE_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}

async function deleteProductVariant(variantId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const variantResult = await client.query('SELECT * FROM product_variants WHERE id = $1 FOR UPDATE', [variantId]);
    if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${variantId} not found.`);
    const deletedVariantData = variantResult.rows[0];
    const { product_id: baseProductId, image_url: variantImageUrl } = deletedVariantData;
    const batchDeletionResult = await client.query('DELETE FROM inventory_batches WHERE variant_id = $1 RETURNING quantity_remaining, batch_number', [variantId]);
    if (batchDeletionResult.rows.length > 0) console.log(`Deleted ${batchDeletionResult.rowCount} inventory batches for variant ID ${variantId}.`);
    await client.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
    const remainingVariantsResult = await client.query('SELECT COUNT(*) AS count FROM product_variants WHERE product_id = $1', [baseProductId]);
    if (parseInt(remainingVariantsResult.rows[0].count, 10) === 0) await client.query('UPDATE products SET has_variants = FALSE, updated_at = NOW() WHERE id = $1', [baseProductId]);
    await client.query('COMMIT');
    if (variantImageUrl && isS3Configured()) {
        const s3Key = getS3KeyFromUrl(variantImageUrl);
        if (s3Key) try { await deleteFileFromS3(s3Key); } catch (s3Error) { console.error(`Failed to delete S3 image ${s3Key} for variant ${variantId}:`, s3Error); }
    }
    return deletedVariantData;
  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (error instanceof NotFoundError) throw error;
    console.error(`Error in productService.deleteProductVariant for ID ${variantId}:`, error);
    throw new AppError(`Failed to delete product variant ID ${variantId}.`, 500, 'VARIANT_DELETE_FAILED');
  } finally {
    client.release();
  }
}

async function deleteProduct(productId) {
  const client = await db.pool.connect();
  const s3KeysToDelete = new Set();
  try {
    await client.query('BEGIN');
    const productResult = await client.query('SELECT id, image_url, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (productResult.rows.length === 0) throw new NotFoundError(`Product with ID ${productId} not found.`);
    const product = productResult.rows[0];
    if (product.image_url) { const key = getS3KeyFromUrl(product.image_url); if (key) s3KeysToDelete.add(key); }

    const orderItemCheck = await client.query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [productId]);
    if (orderItemCheck.rows.length > 0) throw new BadRequestError(`Product ID ${productId} is part of existing orders.`);
    const poItemCheck = await client.query('SELECT 1 FROM purchase_order_items WHERE product_id = $1 LIMIT 1', [productId]);
    if (poItemCheck.rows.length > 0) throw new BadRequestError(`Product ID ${productId} is part of existing purchase orders.`);

    const galleryImagesResult = await client.query('SELECT image_url FROM product_images WHERE product_id = $1', [productId]);
    galleryImagesResult.rows.forEach(img => { if (img.image_url) { const key = getS3KeyFromUrl(img.image_url); if (key) s3KeysToDelete.add(key); }});

    if (product.has_variants) {
      const variantsResult = await client.query('SELECT id, image_url FROM product_variants WHERE product_id = $1', [productId]);
      for (const variant of variantsResult.rows) {
        if (variant.image_url) { const key = getS3KeyFromUrl(variant.image_url); if (key) s3KeysToDelete.add(key); }
        await client.query('DELETE FROM inventory_batches WHERE variant_id = $1', [variant.id]);
      }
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
    } else {
      await client.query('DELETE FROM inventory_batches WHERE product_id = $1 AND variant_id IS NULL', [productId]);
    }

    await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
    await client.query(`DELETE FROM product_assigned_option_specific_values WHERE product_assigned_option_id IN (SELECT id FROM product_assigned_options WHERE product_id = $1)`, [productId]);
    await client.query('DELETE FROM product_assigned_options WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM product_cost_history WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM product_reviews WHERE product_id = $1', [productId]);

    const deletedProductResult = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
    if (deletedProductResult.rowCount === 0) throw new AppError(`Product ID ${productId} not found during final delete.`, 500, 'PRODUCT_DELETE_RACE_CONDITION');
    const deletedProductData = deletedProductResult.rows[0];
    await client.query('COMMIT');

    if (s3KeysToDelete.size > 0 && isS3Configured()) {
      for (const key of s3KeysToDelete) {
        try { await deleteFileFromS3(key); }
        catch (s3Error) { console.error(`Failed to delete S3 object ${key} for product ${productId}:`, s3Error.message); }
      }
    }
    return deletedProductData;
  } catch (error) {
    if (client && client.activeQuery === null && !client._ending && client._connected ) try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('Rollback error:', rbErr); }
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) throw error;
    console.error(`Error in productService.deleteProduct for ID ${productId}:`, error);
    throw new AppError(`Failed to delete product ID ${productId}.`, 500, 'PRODUCT_DELETE_FAILED', { originalError: error.message });
  } finally {
    if (client) client.release();
  }
}

async function getPublicProductFilterOptions() {
  const query = `
    WITH RelevantOptionValues AS (
        SELECT DISTINCT po.id AS option_id, po.name AS option_name, pov.id AS value_id, pov.value AS value_name
        FROM product_options po JOIN product_option_values pov ON po.id = pov.product_option_id
        JOIN product_variant_option_values pvov ON pov.id = pvov.product_option_value_id
        JOIN product_variants pv ON pvov.variant_id = pv.id JOIN products p ON pv.product_id = p.id
        WHERE p.product_status = 'active' AND p.has_variants = TRUE
    )
    SELECT rov.option_id, rov.option_name, json_agg(jsonb_build_object('value_id', rov.value_id, 'value_name', rov.value_name) ORDER BY rov.value_name ASC) AS "values"
    FROM RelevantOptionValues rov GROUP BY rov.option_id, rov.option_name ORDER BY rov.option_name;`;
  try {
    const { rows } = await db.query(query);
    return rows.map(option => ({ ...option, values: option.values || [] }));
  } catch (error) {
    console.error('[productService.getPublicProductFilterOptions] Error:', error);
    throw new AppError('Failed to retrieve public product filter options.', 500, 'PUBLIC_FILTER_OPTIONS_FETCH_FAILED');
  }
}

module.exports = {
  getAllProducts, getProductById, calculateProfitMargin, createProduct, updateProduct, updateProductStock,
  getAllStockLevels, getProductInventoryBatches, getProductCostHistory, getFormattedLabelData,
  getProductAssignedOptions, getProductVariants, getVariantById, createProductVariant, updateProductVariant,
  deleteProductVariant, deleteProduct, getPublicProductFilterOptions,
};

[end of backend/services/productService.js]
