const db = require('../db');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError'); // Added AppError, ConflictError

// Helper function to get the array of global product_option_value_ids for a variant
async function getVariantOptionValueIds(variantId, client) {
  const query = `
    SELECT product_option_value_id
    FROM product_variant_option_values
    WHERE product_variant_id = $1
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
              (SELECT SUM(ib.current_quantity)
               FROM inventory_batches ib
               WHERE ib.product_id = p_stock.id AND ib.variant_id IS NOT NULL AND ib.current_quantity > 0),
            0)
          ELSE
            COALESCE(
              (SELECT SUM(ib.current_quantity)
               FROM inventory_batches ib
               WHERE ib.product_id = p_stock.id AND ib.variant_id IS NULL AND ib.current_quantity > 0),
            0)
        END as effective_stock_quantity,
        CASE
          WHEN p_stock.has_variants THEN
            (COALESCE((SELECT SUM(ib.current_quantity) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NOT NULL AND ib.current_quantity > 0), 0) > 0 AND
             COALESCE((SELECT SUM(ib.current_quantity) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NOT NULL AND ib.current_quantity > 0), 0) < p_stock.reorder_threshold)
          ELSE
            (COALESCE((SELECT SUM(ib.current_quantity) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NULL AND ib.current_quantity > 0), 0) > 0 AND
             COALESCE((SELECT SUM(ib.current_quantity) FROM inventory_batches ib WHERE ib.product_id = p_stock.id AND ib.variant_id IS NULL AND ib.current_quantity > 0), 0) < p_stock.reorder_threshold)
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
      LEFT JOIN product_variant_option_values pvov_filter ON pv_filter.id = pvov_filter.product_variant_id
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
      LEFT JOIN product_variant_option_values pvov_filter_count ON pv_filter_count.id = pvov_filter_count.product_variant_id
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
    status, stock_status, supplierId, is_admin_request
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
      // This condition refers to aliases pv_filter and pvov_filter
      // which must be present in the FROM clause if this filter is active.
      // _buildProductBaseQueryParts handles adding these joins if optionValueId is present.
      whereClauses.push(`pvov_filter.product_option_value_id = $${paramIndex}`);
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

  // For count query, some filters might need different aliases (e.g., pvov_filter_count)
  // This helper will produce whereClauses and queryParams. The main getAllProducts
  // will need to adapt them for the count query if aliases differ.
  // For now, assuming aliases are consistent or handled by how count query is built.
  // If pvov_filter.product_option_value_id was added, a similar one for pvov_filter_count
  // needs to be in the count query's WHERE string.

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
    // Other options will be passed directly to helpers
    ...filterAndSortOptions
  } = options;

  // 1. Build CTEs
  const stockCteString = _buildProductStockCTEString();
  const withClause = `WITH ${stockCteString}`;

  // 2. Build Base Query Parts (SELECT, FROM, GROUP BY for data; FROM for count)
  const baseQueryParts = _buildProductBaseQueryParts(filterAndSortOptions);

  // 3. Build Filter Conditions
  // startingParamIndex = 1 because queryParams are fresh for this execution.
  const filterConditions = _buildProductFilterConditions(filterAndSortOptions, 1);

  // 4. Build Sort Logic
  const orderByClause = _buildProductSortLogic(filterAndSortOptions);

  // 5. Construct Data Query
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

  // 6. Construct Count Query
  //    The count query needs its own WHERE string if aliases differ significantly,
  //    especially for optionValueId filtering.
  //    _buildProductFilterConditions provides a generic whereString.
  //    We need to ensure that if `optionValueId` is used, the `pvov_filter_count` alias is used in the WHERE.
  //    For simplicity here, we'll reuse the whereString from filterConditions,
  //    assuming that if `optionValueId` is present, the main `getAllProducts` will ensure
  //    the `countFromClause` from `_buildProductBaseQueryParts` already has the correct joins
  //    and the `whereString` from `_buildProductFilterConditions` will use the correct alias if it's specific.
  //    This might need refinement if aliases are an issue.
  //    The original code manually adjusted the count query's WHERE for optionValueId.
  //    Let's try to make _buildProductFilterConditions more flexible or add a helper for count's WHERE.

  // For now, let's assume a simplified count WHERE clause generation for this refactor step.
  // A more robust solution would pass a context to _buildProductFilterConditions (e.g., 'data' or 'count')
  // or have a separate helper for the count query's WHERE clause if aliases for joins differ.
  const countFilterConditions = _buildProductFilterConditions({ ...filterAndSortOptions, optionValueIdAlias: 'pvov_filter_count' }, 1);


  let countQueryString = `
    ${withClause}
    SELECT COUNT(DISTINCT p.id) as total_count
    ${baseQueryParts.countFromClause}
    ${countFilterConditions.whereString}
  `;
  // If optionValueId is used, the join for it is in countFromClause.
  // The whereString from countFilterConditions should use the pvov_filter_count alias.
  // This is a slight simplification; the original code had more complex logic for count query's WHERE.
  // We will need to ensure `_buildProductFilterConditions` can handle alias changes or the main method adapts.

  // For now, using the same filterConditions for count as for data, assuming aliases are compatible or handled by join structure.
  // This part might need more careful handling of aliases if count query joins differ significantly.
  // The original complex logic for count query WHERE clause construction has been simplified here.
  // A more robust solution would involve a dedicated filter builder for the count query
  // or making _buildProductFilterConditions context-aware (data vs count).

  // Re-evaluating the count query WHERE clause based on original logic:
  let countWhereString = filterConditions.whereString;
  if (filterAndSortOptions.optionValueId) {
      // The original code had specific handling for optionValueId in count.
      // Let's ensure the count query's WHERE clause correctly uses the count-specific alias if pvov_filter is used.
      // The `_buildProductBaseQueryParts` already provides a `countFromClause` with `pv_filter_count` and `pvov_filter_count`.
      // The `_buildProductFilterConditions` would need to be aware of this alias.
      // For now, let's make a simple adaptation:
      countWhereString = filterConditions.whereString.replace('pvov_filter.product_option_value_id', 'pvov_filter_count.product_option_value_id');
  }
   countQueryString = `
    ${withClause}
    SELECT COUNT(DISTINCT p.id) as total_count
    ${baseQueryParts.countFromClause}
    ${countWhereString}
  `;


  try {
    const productsResult = await db.query(dataQueryString, finalDataParams);
    const countResult = await db.query(countQueryString, countFilterConditions.queryParams); // Use params from count-specific filter build

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
  // productId is assumed to be validated as an integer by the caller (route handler)
  const client = await db.pool.connect();
  try {
    const productQuery = `
      SELECT p.*,
             c.name as category_name,
             s.name as supplier_name,
             tc.name as tax_class_name, -- Added tax_class_name
             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id -- Added join for tax_classes
      LEFT JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, c.name, s.name, tc.name; -- Added tc.name to GROUP BY
    `; // p.has_variants and p.tax_class_id are selected via p.*
    const productResult = await client.query(productQuery, [productId]);

    if (productResult.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const product = productResult.rows[0];

    // If product has no variants, its own stock_quantity should be derived from batches
    if (!product.has_variants) {
      const baseProductBatchStockQuery = await client.query(
        `SELECT COALESCE(SUM(current_quantity), 0) as total_batch_stock
         FROM inventory_batches
         WHERE product_id = $1 AND variant_id IS NULL AND current_quantity > 0`,
        [productId]
      );
      if (baseProductBatchStockQuery.rows.length > 0) {
        product.stock_quantity = parseInt(baseProductBatchStockQuery.rows[0].total_batch_stock, 10);
      } else {
        product.stock_quantity = 0; // Should not happen if COALESCE is used, but as safeguard
      }
    }

    // Fetch product gallery images
    const imagesQuery = `
      SELECT id, image_url AS url, alt_text, display_order, is_primary
      FROM product_images
      WHERE product_id = $1
      ORDER BY display_order ASC, id ASC;
    `;
    const imagesResult = await client.query(imagesQuery, [productId]);
    // product.images will hold these raw gallery images, including the is_primary flag
    // The main products.image_url should already be synced by adminProductImages.js logic
    // to the URL of the image where is_primary = true.

    // Let's find if there's a primary image from the gallery to ensure product.image_url is consistent.
    const primaryGalleryImage = imagesResult.rows.find(img => img.is_primary);
    if (primaryGalleryImage) {
      product.image_url = primaryGalleryImage.url; // Ensure product.image_url reflects the gallery's primary
    } else if (imagesResult.rows.length > 0 && !product.image_url) {
      // If no gallery image is marked primary, but there are gallery images,
      // and product.image_url is null, this is a data inconsistency.
      // For display, we could pick the first gallery image, but ideally, one should be primary.
      // For now, we rely on product.image_url being the primary source if no gallery image is_primary.
      // If adminProductImages correctly sets product.image_url to NULL when no primary exists, this is fine.
    }


    // Calculate profit margin for the main product
    // product.cost_price should be available if the DB schema is updated for products table
    product.profit_margin_details = calculateProfitMargin(product.price, product.cost_price);

    if (product.has_variants) {
      // Fetch available options and their assigned values for this product
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

      // Fetch all variants for this product
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

        // Get actual stock from inventory_batches for this variant
        const batchStockQuery = await client.query(
          `SELECT COALESCE(SUM(current_quantity), 0) as total_batch_stock
           FROM inventory_batches
           WHERE variant_id = $1 AND product_id = $2 AND current_quantity > 0`,
          [variant.id, product.id]
        );
        if (batchStockQuery.rows.length > 0) {
          variant.stock_quantity = parseInt(batchStockQuery.rows[0].total_batch_stock, 10);
        } else {
          variant.stock_quantity = 0; // Should not happen with COALESCE, but safeguard
        }

        // Calculate profit margin for the variant
        // variant.cost_price is now fetched in variantsQuery
        variant.profit_margin_details = calculateProfitMargin(variant.final_price, variant.cost_price);

        // Calculate final_wholesale_price for variant
        const baseProductWholesalePrice = product.wholesale_price !== null ? parseFloat(product.wholesale_price) : null;
        const variantWholesaleModifier = variant.wholesale_price_modifier !== null ? parseFloat(variant.wholesale_price_modifier) : 0; // Default modifier to 0 if null

        if (baseProductWholesalePrice !== null) {
          variant.final_wholesale_price = parseFloat((baseProductWholesalePrice + variantWholesaleModifier).toFixed(2));
        } else {
          variant.final_wholesale_price = null;
        }
        // Note: 'selected_options' (full details) can be constructed by frontend using available_options and option_value_ids
      }
    } else {
      // Ensure these fields are present even if product has no variants, for consistent API response structure.
      product.available_options = [];
      product.variants = [];
    }

    // Create consolidated gallery_images
    let gallery_images = [];
    let imageUrlsSet = new Set(); // To avoid duplicates if product.image_url is also in product_images

    // Process actual gallery images (product_images table) first
    // These now include the is_primary flag from the modified imagesQuery
    const rawGalleryImages = imagesResult.rows; // Results from product_images table

    rawGalleryImages.forEach(img => {
      if (img.url && !imageUrlsSet.has(img.url)) {
        imageUrlsSet.add(img.url);
        gallery_images.push({
          id: img.id, // Actual ID from product_images table
          url: img.url,
          alt_text: img.alt_text || product.name,
          display_order: img.display_order,
          is_primary: img.is_primary || false // Carry over the is_primary flag
        });
      }
    });

    // Ensure product.image_url (which should be the primary image URL) is represented
    // This also acts as a fallback if product_images table is empty but products.image_url exists
    if (product.image_url && !imageUrlsSet.has(product.image_url)) {
      imageUrlsSet.add(product.image_url);
      gallery_images.push({
        id: 'main_' + product.id, // A unique ID for this entry if it's not from product_images
        url: product.image_url,
        alt_text: product.name + " (Primary)",
        display_order: -1, // Ensure it sorts first if no other is primary
        is_primary: true   // Mark it as primary conceptually
      });
    }

    // Sort: primary first, then by display_order, then by id
    gallery_images.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      if (a.display_order !== b.display_order) {
        return (a.display_order || 0) - (b.display_order || 0);
      }
      // Ensure consistent sort for items with same display_order or if display_order is null
      const aId = typeof a.id === 'string' ? a.id : String(a.id);
      const bId = typeof b.id === 'string' ? b.id : String(b.id);
      return aId.localeCompare(bId);
    });

    // Add images from product.variants (if they should also be in the gallery display)
    // This part might be optional depending on desired gallery content.
    // For now, let's keep it as it was, but ensure no duplicates with what's already added.
    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach(variant => {
        if (variant.image_url && !imageUrlsSet.has(variant.image_url)) {
          imageUrlsSet.add(variant.image_url);
          gallery_images.push({
            id: 'variant_' + variant.id,
            url: variant.image_url,
            alt_text: variant.sku || product.name,
            display_order: 1000 // Default high display_order for variant images
          });
        }
      });
    }

    // Sort gallery_images by display_order, then by id for stable sort
    gallery_images.sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      // Ensure 'product_primary_' comes before numeric ids if display_order is same
      if (typeof a.id === 'string' && a.id.startsWith('product_primary_')) return -1;
      if (typeof b.id === 'string' && b.id.startsWith('product_primary_')) return 1;
      // Fallback to comparing ids (as strings or numbers)
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    product.gallery_images = gallery_images;
    // Optionally, delete product.images if it's now redundant
    // delete product.images; // For now, keeping it as per instructions

    return product;
  } finally {
    if (client) client.release();
  }
}

function calculateProfitMargin(sellingPrice, costPrice) {
    const sp = parseFloat(sellingPrice);
    const cp = parseFloat(costPrice);

    if (isNaN(sp)) {
        return { profit_amount: null, profit_percentage: null };
    }

    if (isNaN(cp)) { // Cost price is unknown
        return { profit_amount: null, profit_percentage: null };
    }

    const profitAmount = parseFloat((sp - cp).toFixed(2));
    let profitPercentage = null;

    if (cp > 0) {
        profitPercentage = parseFloat((profitAmount / cp * 100).toFixed(2));
    } else if (cp === 0 && sp > 0) { // Cost is zero, selling price is positive
        profitPercentage = null; // Or a string like 'Infinite %', but null is better for data consistency
                                 // Profit amount is simply the selling price.
    } else if (cp === 0 && sp === 0) {
        profitPercentage = 0; // No profit, no cost, no sale price
    }
    // If cp < 0, this formula would still work but negative cost is unusual.
    // profitAmount will be correctly calculated (e.g. sp=10, cp=-5, profit=15)
    // profitPercentage will be correctly calculated (e.g. (15/-5)*100 = -300%) which is mathematically correct if odd

    return {
        profit_amount: profitAmount,
        profit_percentage: profitPercentage
    };
}

const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service');
const { getOrCreateTagIds, getS3KeyFromUrl } = require('../utils/productHelpers'); // Assuming these helpers are still relevant

/**
 * Creates a new product, including handling optional image upload and tag association.
 * Manages database transaction.
 * @param {object} productData - Data for the new product from the validated request body.
 * @param {object} [fileData] - Optional file object from multer (req.file).
 * @returns {Promise<object>} The newly created product object, enriched with details.
 * @throws {AppError} If creation fails (e.g., DB error, S3 error).
 * @throws {ConflictError} If SKU already exists.
 */
async function createProduct(productData, fileData) {
  const {
    name, description, price, category_id, supplier_id, sku,
    stock_quantity = 0, // Default from validator might be used by route
    reorder_threshold, product_status = 'draft', // Default from validator
    tax_class_id, cost_price, wholesale_price,
    brand_manufacturer, supplier_reference, specifications,
    tags: tagNames // Expects an array of tag names
  } = productData;

  const client = await db.pool.connect();
  let s3FileKeyToStore = null;
  let imageUrlToStoreInDb = null;

  try {
    await client.query('BEGIN');

    if (fileData) {
      if (!isS3Configured()) {
        await client.query('ROLLBACK');
        throw new AppError("Image upload service is not configured.", 500, "S3_NOT_CONFIGURED");
      }
      try {
        const uniqueFileName = `product-images/product-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
        const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
        imageUrlToStoreInDb = s3Data.Location;
        s3FileKeyToStore = s3Data.Key;
      } catch (s3Error) {
        await client.query('ROLLBACK');
        console.error("S3 Upload Error during product creation in service:", s3Error);
        throw new AppError("Failed to upload image to S3.", 500, "S3_UPLOAD_FAILED", { originalError: s3Error.message });
      }
    }

    const insertQuery = `
      INSERT INTO products (
        name, description, price, category_id, supplier_id, sku, stock_quantity,
        reorder_threshold, product_status, image_url, tax_class_id, cost_price,
        wholesale_price, brand_manufacturer, supplier_reference, specifications,
        has_variants, average_rating, review_count, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        FALSE, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id;
    `;
    // RETURNING * would be better if not calling getProductById later, but id is enough for now.

    const values = [
      name, description || null, price, category_id || null, supplier_id || null, sku || null,
      stock_quantity, reorder_threshold || null, product_status, imageUrlToStoreInDb,
      tax_class_id || null, cost_price || null, wholesale_price || null,
      brand_manufacturer || null, supplier_reference || null,
      specifications ? (typeof specifications === 'string' ? specifications : JSON.stringify(specifications)) : null,
    ];

    const result = await client.query(insertQuery, values);
    const newProductId = result.rows[0].id;

    if (Array.isArray(tagNames) && tagNames.length > 0) {
      const tagIds = await getOrCreateTagIds(tagNames, client); // Pass client for transaction
      for (const tagId of tagIds) {
        await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newProductId, tagId]);
      }
    }

    await client.query('COMMIT');

    // Fetch the full product details to return (consistent with getProductById)
    // getProductById uses its own client, so this is safe after commit.
    return getProductById(newProductId);

  } catch (error) {
    await client.query('ROLLBACK');
    if (s3FileKeyToStore && isS3Configured()) { // If S3 upload happened but DB failed
      try {
        await deleteFileFromS3(s3FileKeyToStore);
        console.log(`Rolled back S3 upload for key: ${s3FileKeyToStore} due to DB error.`);
      } catch (s3RollbackError) {
        console.error(`CRITICAL: Failed to rollback S3 upload for key ${s3FileKeyToStore} after DB error:`, s3RollbackError);
      }
    }

    if (error.code === '23505' && error.constraint === 'products_sku_key') {
      throw new ConflictError(`SKU "${sku}" already exists.`);
    }
    console.error('Error in productService.createProduct:', error);
    // If it's already an AppError, rethrow it, otherwise wrap it.
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) {
        throw error;
    }
    throw new AppError('Failed to create product.', 500, 'PRODUCT_CREATION_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}


/**
 * Updates an existing product, including handling optional image upload/removal and tag association.
 * Manages database transaction.
 * @param {number} productId - The ID of the product to update.
 * @param {object} productData - Data for updating the product from the validated request body.
 * @param {object} [fileData] - Optional file object from multer (req.file) for new image.
 * @param {boolean} [removeImage=false] - Flag to indicate if existing image should be removed.
 * @returns {Promise<object>} The updated product object, enriched with details.
 * @throws {AppError} If update fails.
 * @throws {NotFoundError} If product not found.
 * @throws {ConflictError} If new SKU conflicts.
 */
async function updateProduct(productId, productData, fileData, removeImage = false) {
  const {
    name, description, price, category_id, supplier_id, sku,
    stock_quantity, reorder_threshold, product_status, tax_class_id,
    cost_price, wholesale_price, brand_manufacturer, supplier_reference,
    specifications, tags: tagNames, image_url: imageUrlFromRequest // Used to signal keeping or explicitly nullifying image_url if no fileData
  } = productData;

  const client = await db.pool.connect();
  let s3FileKeyToStore = null;       // Key of newly uploaded S3 object
  let finalImageUrlToStoreInDb = undefined; // undefined means no change, null means remove, string means new URL
  let oldS3KeyToDelete = null;

  try {
    await client.query('BEGIN');

    const currentProductResult = await client.query('SELECT image_url, sku, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (currentProductResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const currentProduct = currentProductResult.rows[0];
    finalImageUrlToStoreInDb = currentProduct.image_url; // Start with current image

    // --- Image Handling Logic ---
    if (fileData) { // New image uploaded
      if (!isS3Configured()) {
        await client.query('ROLLBACK');
        throw new AppError("Image upload service is not configured.", 500, "S3_NOT_CONFIGURED");
      }
      try {
        const uniqueFileName = `product-images/product-${productId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
        const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
        finalImageUrlToStoreInDb = s3Data.Location;
        s3FileKeyToStore = s3Data.Key;
        if (currentProduct.image_url) { // If there was an old image, mark it for deletion
          oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url);
        }
      } catch (s3Error) {
        await client.query('ROLLBACK');
        console.error("S3 Upload Error during product update in service:", s3Error);
        throw new AppError("Failed to upload new image to S3.", 500, "S3_UPLOAD_FAILED", { originalError: s3Error.message });
      }
    } else if (removeImage === true || imageUrlFromRequest === null) { // Explicitly removing image
        if (currentProduct.image_url && isS3Configured()) {
            oldS3KeyToDelete = getS3KeyFromUrl(currentProduct.image_url);
        }
        finalImageUrlToStoreInDb = null; // Set to null to remove from DB
    }
    // If imageUrlFromRequest is a string, it's assumed client wants to keep existing or it's a non-S3 URL (not typical for this app's S3 flow)
    // If undefined, no change to image unless fileData is present.

    // --- Build Update Query ---
    const setClauses = [];
    const queryUpdateValues = [];
    let currentParamIndex = 1;

    const addUpdateClause = (field, value, isJson = false) => {
      // Only add to SET if property exists in productData (meaning it was intended to be updated)
      // or if it's image_url and it has changed through file upload/removal.
      if (productData.hasOwnProperty(field) || (field === 'image_url' && finalImageUrlToStoreInDb !== currentProduct.image_url)) {
        setClauses.push(`${field} = $${currentParamIndex++}`);
        if (isJson && value !== null && typeof value !== 'string') {
          queryUpdateValues.push(JSON.stringify(value));
        } else {
          queryUpdateValues.push(value === '' && (field === 'description' || field === 'sku' || field === 'brand_manufacturer' || field === 'supplier_reference') ? null : value);
        }
      }
    };

    // Add fields from productData to update query if they exist
    addUpdateClause('name', name);
    addUpdateClause('description', description);
    addUpdateClause('price', price);
    addUpdateClause('category_id', category_id === '' ? null : category_id);
    addUpdateClause('supplier_id', supplier_id === '' ? null : supplier_id);
    addUpdateClause('sku', sku);

    if (productData.hasOwnProperty('stock_quantity') && !currentProduct.has_variants) {
        addUpdateClause('stock_quantity', stock_quantity);
    } else if (productData.hasOwnProperty('stock_quantity') && currentProduct.has_variants) {
        console.warn(`Attempt to update base stock_quantity for product ID ${productId} which has variants. Update to stock_quantity ignored by service.`);
    }

    addUpdateClause('reorder_threshold', reorder_threshold === '' ? null : reorder_threshold);
    addUpdateClause('product_status', product_status);
    // Ensure image_url is part of productData for addUpdateClause logic if it changed
    if (finalImageUrlToStoreInDb !== currentProduct.image_url) {
        productData.image_url = finalImageUrlToStoreInDb; // Make it available for addUpdateClause
    }
    addUpdateClause('image_url', productData.image_url); // Will use finalImageUrlToStoreInDb if it was changed

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

    // --- Tags Handling ---
    let tagsUpdated = false;
    if (productData.hasOwnProperty('tags')) { // Check if 'tags' was part of the update request
        tagsUpdated = true; // Mark that tag processing was intended
        await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
        if (Array.isArray(tagNames) && tagNames.length > 0) {
            const tagIds = await getOrCreateTagIds(tagNames, client);
            for (const tagId of tagIds) {
                await client.query('INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [productId, tagId]);
            }
        }
    }

    // If only tags changed, and no other product fields, ensure updated_at is still touched on products table
    if (tagsUpdated && !productUpdated && setClauses.length === 0) {
        await client.query('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [productId]);
    }


    await client.query('COMMIT');

    // If commit was successful, delete old S3 image if applicable
    if (oldS3KeyToDelete && isS3Configured()) {
      try {
        await deleteFileFromS3(oldS3KeyToDelete);
        console.log(`Successfully deleted old S3 image: ${oldS3KeyToDelete}`);
      } catch (s3DeleteError) {
        console.error(`Failed to delete old S3 image ${oldS3KeyToDelete} after product update:`, s3DeleteError);
        // Non-critical, don't fail the whole operation, but log it.
      }
    }

    return getProductById(productId); // Fetch and return the updated product details

  } catch (error) {
    await client.query('ROLLBACK');
    // If a new image was uploaded to S3 but DB transaction failed, delete the new S3 image
    if (s3FileKeyToStore && isS3Configured()) {
      try {
        await deleteFileFromS3(s3FileKeyToStore);
        console.log(`Rolled back S3 upload for key: ${s3FileKeyToStore} due to DB error on product update.`);
      } catch (s3RollbackError) {
        console.error(`CRITICAL: Failed to rollback S3 upload for key ${s3FileKeyToStore} after DB error:`, s3RollbackError);
      }
    }

    if (error.code === '23505' && error.constraint === 'products_sku_key') {
      throw new ConflictError(`SKU "${sku}" already exists.`);
    }
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) {
        throw error;
    }
    console.error(`Error in productService.updateProduct for ID ${productId}:`, error);
    throw new AppError('Failed to update product.', 500, 'PRODUCT_UPDATE_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}


/**
 * Updates the stock quantity for a specific product.
 * This method should only be used for products that do NOT have variants.
 * @param {number} productId - The ID of the product to update.
 * @param {number} newStockQuantity - The new stock quantity.
 * @returns {Promise<object>} The updated product object (full details via getProductById).
 * @throws {NotFoundError} If the product is not found.
 * @throws {BadRequestError} If attempting to update stock for a product with variants, or if stock is invalid.
 * @throws {AppError} If database operation fails.
 */
async function updateProductStock(productId, newStockQuantity) {
  if (newStockQuantity === undefined || newStockQuantity === null || isNaN(parseInt(newStockQuantity)) || parseInt(newStockQuantity) < 0) {
    throw new BadRequestError('New stock quantity must be a non-negative integer.');
  }
  const stockQty = parseInt(newStockQuantity);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const productDetailsResult = await client.query('SELECT id, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (productDetailsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const product = productDetailsResult.rows[0];

    if (product.has_variants) {
      await client.query('ROLLBACK');
      throw new BadRequestError(`Stock for product ID ${productId} (which has variants) must be managed at the variant level.`);
    }

    const updateQuery = `
      UPDATE products
      SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id;
    `;
    const updatedProductResult = await client.query(updateQuery, [stockQty, productId]);

    if (updatedProductResult.rowCount === 0) {
      // Should not happen if FOR UPDATE lock was successful and ID is correct
      await client.query('ROLLBACK');
      throw new AppError(`Product with ID ${productId} found but update failed to apply.`, 500, 'PRODUCT_STOCK_UPDATE_FAILED');
    }

    await client.query('COMMIT');

    // Return the full product details after successful update
    return getProductById(productId); // getProductById uses its own client connection

  } catch (error) {
    await client.query('ROLLBACK'); // Ensure rollback on any error not caught above
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error; // Re-throw known errors
    }
    console.error(`Error in productService.updateProductStock for ID ${productId}:`, error);
    throw new AppError(`Failed to update stock for product ID ${productId}.`, 500, 'PRODUCT_STOCK_UPDATE_UNHANDLED_ERROR');
  } finally {
    client.release();
  }
}


/**
 * Retrieves a paginated list of stock levels for all products and variants.
 * Stock quantities are derived from inventory_batches.
 * @param {object} options - Filtering and pagination options.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.search_term]
 * @param {number} [options.category_id]
 * @param {number} [options.supplier_id]
 * @param {boolean} [options.low_stock_only]
 * @param {string} [options.sort_by='product_name'] - Allowed: 'product_name', 'sku', 'stock_quantity', 'reorder_threshold'.
 * @param {string} [options.sort_order='ASC'] - Allowed: 'ASC', 'DESC'.
 * @returns {Promise<object>} An object containing the list of stock items and pagination details.
 * @throws {AppError} If database operation fails.
 */
async function getAllStockLevels(options = {}) {
  const {
    page = 1,
    limit = 20,
    search_term,
    category_id,
    supplier_id,
    low_stock_only = false, // Ensure boolean
    sort_by = 'product_name',
    sort_order = 'ASC'
  } = options;

  const offset = (page - 1) * limit;
  const queryParams = [];
  let paramIndex = 1;

  // CTE to calculate effective stock from inventory_batches for each product/variant
  const batchStockCte = `
    effective_batch_stock AS (
      SELECT
        product_id,
        variant_id,
        COALESCE(SUM(current_quantity), 0) AS actual_stock_from_batches
      FROM inventory_batches
      WHERE current_quantity > 0
      GROUP BY product_id, variant_id
    )
  `;

  // Main CTE to list all products and variants with their details and effective stock
  const stockItemsCte = `
    stock_items_base AS (
      -- Products without variants
      SELECT
        p.id AS product_id,
        NULL::INT AS variant_id,
        p.name AS item_name,
        p.sku AS item_sku,
        COALESCE(ebs_prod.actual_stock_from_batches, 0) AS stock_quantity,
        p.reorder_threshold,
        p.has_variants,
        p.category_id,
        c.name AS category_name,
        p.supplier_id,
        s.name AS supplier_name,
        'product' AS item_type,
        p.name AS sort_product_name,
        p.sku AS sort_sku
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN effective_batch_stock ebs_prod ON p.id = ebs_prod.product_id AND ebs_prod.variant_id IS NULL
      WHERE p.has_variants = FALSE
      UNION ALL
      -- Product variants
      SELECT
        p.id AS product_id,
        pv.id AS variant_id,
        p.name || ' - ' || COALESCE(pv.sku, 'Variant ' || pv.id) AS item_name,
        pv.sku AS item_sku,
        COALESCE(ebs_var.actual_stock_from_batches, 0) AS stock_quantity,
        p.reorder_threshold, -- Reorder threshold is on the base product
        TRUE AS has_variants,
        p.category_id,
        c.name AS category_name,
        p.supplier_id,
        s.name AS supplier_name,
        'variant' AS item_type,
        p.name AS sort_product_name,
        pv.sku AS sort_sku
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN effective_batch_stock ebs_var ON p.id = ebs_var.product_id AND pv.id = ebs_var.variant_id
    )
  `;

  const finalCtes = `WITH ${batchStockCte}, ${stockItemsCte}`;

  let conditions = [];
  if (search_term) {
    conditions.push(`(item_name ILIKE $${paramIndex} OR item_sku ILIKE $${paramIndex})`);
    queryParams.push(`%${search_term}%`);
    paramIndex++;
  }
  if (category_id) {
    conditions.push(`category_id = $${paramIndex}`);
    queryParams.push(category_id);
    paramIndex++;
  }
  if (supplier_id) {
    conditions.push(`supplier_id = $${paramIndex}`);
    queryParams.push(supplier_id);
    paramIndex++;
  }
  if (low_stock_only === true) {
    conditions.push(`(stock_quantity <= reorder_threshold AND reorder_threshold IS NOT NULL AND reorder_threshold > 0)`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countQueryString = `${finalCtes} SELECT COUNT(*) as total_count FROM stock_items_base ${whereClause}`;
    const countResult = await db.query(countQueryString, queryParams);
    const totalItems = parseInt(countResult.rows[0].total_count);

    let sortColumn = 'sort_product_name'; // Default sort
    if (sort_by === 'sku') sortColumn = 'item_sku';
    else if (sort_by === 'stock_quantity') sortColumn = 'stock_quantity';
    else if (sort_by === 'reorder_threshold') sortColumn = 'reorder_threshold';

    const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderByClause = `ORDER BY ${sortColumn} ${safeSortOrder} NULLS LAST, product_id ${safeSortOrder}, variant_id ${safeSortOrder} NULLS LAST`;

    const dataQueryString = `
      ${finalCtes}
      SELECT * FROM stock_items_base
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataFinalParams = [...queryParams, limit, offset];

    const itemsResult = await db.query(dataQueryString, dataFinalParams);

    return {
      data: itemsResult.rows,
      pagination: {
        total: totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
        sort_by, // Return current sort options
        sort_order: safeSortOrder
      }
    };
  } catch (error) {
    console.error('Error in productService.getAllStockLevels:', error);
    throw new AppError('Failed to retrieve stock levels.', 500, 'STOCK_LEVELS_FETCH_FAILED');
  }
}


/**
 * Retrieves a paginated list of inventory batches for a specific product, optionally filtered by variant.
 * @param {number} productId - The ID of the product.
 * @param {object} options - Filtering and pagination options.
 * @param {number} [options.variant_id] - Optional variant ID to filter batches.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {string} [options.sort_by='received_date_desc'] - Sorting criteria.
 * @returns {Promise<object>} An object containing { data: batches, pagination: {...} }.
 * @throws {NotFoundError} If the product is not found.
 * @throws {AppError} If database operation fails.
 */
async function getProductInventoryBatches(productId, options = {}) {
  const {
    variant_id,
    page = 1,
    limit = 10,
    sort_by = 'received_date_desc' // Default sort
  } = options;

  const offset = (page - 1) * limit;
  const queryParams = [productId];
  let paramIndex = 1; // Starts at 1 for productId

  // First, check if product exists
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) {
    throw new NotFoundError(`Product with ID ${productId} not found.`);
  }

  let whereClauses = ['ib.product_id = $1'];
  if (variant_id) {
    paramIndex++;
    queryParams.push(variant_id);
    whereClauses.push(`ib.variant_id = $${paramIndex}`);
  } else {
    // If no variant_id is specified, ensure we are only getting batches for the base product (variant_id IS NULL)
    // This might need adjustment based on whether base products can have batches directly
    // or if batches are *always* variant-specific (even for non-variant products, where variant_id might be null).
    // Assuming for now: if variant_id is not given, we list all for the product, or only base-product batches.
    // The original route implies it lists all for the product if variant_id is omitted.
    // Let's stick to that: if variant_id is not passed, all batches for product_id are listed.
    // If a product has_variants=false, its batches would have variant_id=NULL.
    // If a product has_variants=true, its batches could have variant_id=X or variant_id=Y.
    // The current filter `ib.product_id = $1` handles product association.
    // Adding `ib.variant_id = $X` correctly filters for a specific variant.
    // If no variant_id, it gets all for product_id.
  }

  const whereString = whereClauses.join(' AND ');

  let orderByClause = 'ORDER BY ib.received_date DESC, ib.id DESC'; // Default from route
  switch (sort_by) {
    case 'received_date_asc':
      orderByClause = 'ORDER BY ib.received_date ASC, ib.id ASC';
      break;
    case 'expiry_date_asc':
      orderByClause = 'ORDER BY ib.expiry_date ASC NULLS LAST, ib.id ASC';
      break;
    case 'expiry_date_desc':
      orderByClause = 'ORDER BY ib.expiry_date DESC NULLS FIRST, ib.id DESC';
      break;
    case 'current_quantity_asc':
      orderByClause = 'ORDER BY ib.current_quantity ASC, ib.id ASC';
      break;
    case 'current_quantity_desc':
      orderByClause = 'ORDER BY ib.current_quantity DESC, ib.id DESC';
      break;
    // 'received_date_desc' is the default
  }

  const dataQuery = `
    SELECT
      ib.*,
      p.name as product_name,
      pv.sku as variant_sku,
      po.id as purchase_order_id,
      s.name as supplier_name
    FROM inventory_batches ib
    JOIN products p ON ib.product_id = p.id
    LEFT JOIN product_variants pv ON ib.variant_id = pv.id
    LEFT JOIN purchase_order_items poi ON ib.purchase_order_item_id = poi.id
    LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE ${whereString}
    ${orderByClause}
    LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2};
  `;
  const dataParams = [...queryParams, limit, offset];

  const countQuery = `
    SELECT COUNT(*) as total_count
    FROM inventory_batches ib
    WHERE ${whereString};
  `;
  // Count query uses only filter params (productId, variant_id if present)
  const countParams = queryParams.slice(0, paramIndex);


  try {
    const dataResult = await db.query(dataQuery, dataParams);
    const countResult = await db.query(countQuery, countParams);

    const totalRecords = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: dataResult.rows,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages,
        sort_by // Return current sort options
      }
    };
  } catch (error) {
    console.error(`Error in productService.getProductInventoryBatches for product ID ${productId}:`, error);
    throw new AppError('Failed to retrieve inventory batches.', 500, 'PRODUCT_INV_BATCHES_FETCH_FAILED');
  }
}


/**
 * Retrieves a paginated list of cost history for a specific product.
 * @param {number} productId - The ID of the product.
 * @param {object} options - Filtering and pagination options.
 * @param {number} [options.variant_id] - Optional variant ID.
 * @param {number} [options.supplier_id] - Optional supplier ID.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<object>} An object containing { data: costHistory, pagination: {...} }.
 * @throws {NotFoundError} If the product is not found.
 * @throws {AppError} If database operation fails.
 */
async function getProductCostHistory(productId, options = {}) {
  const {
    variant_id,
    supplier_id,
    page = 1,
    limit = 10
  } = options;

  const offset = (page - 1) * limit;
  const queryParams = [productId];
  let paramIndex = 1; // Starts at 1 for productId

  // First, check if product exists
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) {
    throw new NotFoundError(`Product with ID ${productId} not found.`);
  }

  let whereClauses = ['pch.product_id = $1'];
  if (variant_id) {
    paramIndex++;
    queryParams.push(variant_id);
    whereClauses.push(`pch.variant_id = $${paramIndex}`);
  }
  if (supplier_id) {
    paramIndex++;
    queryParams.push(supplier_id);
    whereClauses.push(`pch.supplier_id = $${paramIndex}`);
  }
  const whereString = whereClauses.join(' AND ');

  const dataQuery = `
    SELECT pch.id, pch.product_id, p.name as product_name,
           pch.variant_id, pv.sku as variant_sku,
           pch.supplier_id, s.name as supplier_name,
           pch.currency_code, pch.cost_price, pch.quantity_received,
           pch.purchase_order_item_id, poi.quantity_ordered as po_item_quantity_ordered,
           po.id as purchase_order_id,
           pch.effective_date, pch.created_at
    FROM product_cost_history pch
    JOIN products p ON pch.product_id = p.id
    LEFT JOIN product_variants pv ON pch.variant_id = pv.id
    LEFT JOIN suppliers s ON pch.supplier_id = s.id
    LEFT JOIN purchase_order_items poi ON pch.purchase_order_item_id = poi.id
    LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
    WHERE ${whereString}
    ORDER BY pch.effective_date DESC, pch.id DESC
    LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2};
  `;
  const dataParams = [...queryParams, limit, offset];

  const countQuery = `
    SELECT COUNT(*) as total_count
    FROM product_cost_history pch
    WHERE ${whereString};
  `;
  // Count query uses only filter params (productId, variant_id, supplier_id if present)
  const countParams = queryParams.slice(0, paramIndex);

  try {
    const dataResult = await db.query(dataQuery, dataParams);
    const countResult = await db.query(countQuery, countParams);

    const totalRecords = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: dataResult.rows,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages,
        // sort_by is fixed in this query to 'effective_date DESC, id DESC'
      }
    };
  } catch (error) {
    console.error(`Error in productService.getProductCostHistory for product ID ${productId}:`, error);
    throw new AppError('Failed to retrieve product cost history.', 500, 'PRODUCT_COST_HISTORY_FETCH_FAILED');
  }
}


const config = require('../config'); // Import config for URLs and currency
const taxService = require('../services/taxService'); // Assumed path, adjust if necessary

/**
 * Retrieves and formats data suitable for generating product labels.
 * Can return data for a single product/variant or all variants of a product.
 * @param {number} productId - The ID of the product.
 * @param {number} [requestedVariantId=null] - Optional specific variant ID for a single label.
 * @param {boolean} [forAllVariants=false] - If true, returns label data for all variants (or base product if no variants).
 * @returns {Promise<object|Array<object>>} A single labelData object or an array of them.
 * @throws {NotFoundError} If the product or specified variant is not found.
 * @throws {AppError} If any other error occurs.
 */
async function getFormattedLabelData(productId, requestedVariantId = null, forAllVariants = false) {
  const product = await this.getProductById(productId); // `this` refers to productService instance if methods are part of class, else direct call. Assuming direct call for now.
                                                        // Corrected: getProductById is a standalone function in this module.

  const

STORE_CURRENCY_CODE = config.company.currencyCode || config.currency.defaultStoreCurrency || 'USD'; // Example: Get from config
  const

STORE_CURRENCY_SYMBOL = config.company.currencySymbol || config.currency.defaultStoreSymbol || '$'; // Example: Get from config
  const PRODUCT_PAGE_BASE_URL = config.frontendUrlBase || 'http://localhost:3001';


  const labelsData = [];

  const processItemForLabel = async (item, isVariant) => {
    const baseSellingPrice = parseFloat(isVariant ? item.final_price : product.price);
    let taxDetails = { taxAmount: 0, priceWithTax: baseSellingPrice, appliedRates: [] };

    if (product.tax_class_id) {
      try {
        taxDetails = await taxService.calculatePriceWithAppliedTaxes(baseSellingPrice, product.tax_class_id);
      } catch (taxError) {
        console.error(`Error calculating tax for item (Product: ${product.id}, Variant: ${isVariant ? item.id : 'N/A'}):`, taxError.message);
        // Proceed with 0 tax if calculation fails, or rethrow/handle as critical
      }
    }

    let full_display_name = product.name;
    let itemSku = product.sku;
    let itemSpecificIdPart = product.id; // For QR code URLs if no variant
    let variantIdForQr = null;

    if (isVariant) {
      let suffixParts = [];
      if (product.available_options && item.option_value_ids) {
        for (const valId of item.option_value_ids) {
          for (const opt of product.available_options) {
            const foundValue = opt.values.find(v => v.value_id === valId);
            if (foundValue) {
              suffixParts.push(`${opt.option_name}: ${foundValue.value_name}`);
              break;
            }
          }
        }
      }
      const constructed_suffix = suffixParts.length > 0 ? ` - ${suffixParts.join(', ')}` : (item.sku ? ` - ${item.sku}` : ` - Variant ${item.id}`);
      full_display_name += constructed_suffix;
      itemSku = item.sku || product.sku;
      itemSpecificIdPart = item.id;
      variantIdForQr = item.id;
    }

    const barcodeValue = itemSku || product.id.toString() + (isVariant ? `-${item.id}` : '');

    return {
      product_id: product.id,
      variant_id: isVariant ? item.id : null,
      product_name: product.name, // Base product name
      variant_name_suffix: isVariant ? full_display_name.substring(product.name.length) : null,
      full_display_name: full_display_name,
      sku: itemSku,
      barcode_value: barcodeValue,
      selling_price: baseSellingPrice.toFixed(2), // Pre-tax price
      price_incl_tax: parseFloat(taxDetails.priceWithTax).toFixed(2), // Price with tax
      tax_amount: parseFloat(taxDetails.taxAmount).toFixed(2),
      applied_tax_rates: taxDetails.appliedRates,
      currency_code: STORE_CURRENCY_CODE,
      currency_symbol: STORE_CURRENCY_SYMBOL,
      qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}${variantIdForQr ? `?variantId=${variantIdForQr}` : ''}`,
      qr_code_data_reorder_url: `${PRODUCT_PAGE_BASE_URL}/cart?action=add&productId=${product.id}${variantIdForQr ? `&variantId=${variantIdForQr}` : ''}&quantity=1`,
      qr_code_data_promotion_url: `${PRODUCT_PAGE_BASE_URL}/promotions?ref_product=${product.id}${variantIdForQr ? `&ref_variant=${variantIdForQr}` : ''}`
    };
  };

  if (forAllVariants) {
    if (product.has_variants && product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        labelsData.push(await processItemForLabel(variant, true));
      }
    } else { // Product without variants, or variants array empty
      labelsData.push(await processItemForLabel(product, false));
    }
    return labelsData;
  } else if (requestedVariantId && product.has_variants) {
    const variant = product.variants.find(v => v.id === requestedVariantId);
    if (!variant) {
      throw new NotFoundError(`Variant with ID ${requestedVariantId} not found for product ${productId}.`);
    }
    return processItemForLabel(variant, true);
  } else { // Single label for base product (either no variants, or no specific variant requested for a variant product)
    return processItemForLabel(product, false);
  }
}


/**
 * Retrieves all options assigned to a specific product, along with their specifically selected values.
 * @param {number} productId - The ID of the product.
 * @returns {Promise<Array<object>>} An array of assigned option objects, each with a 'selected_values' array.
 * @throws {NotFoundError} If the product with the given ID is not found.
 * @throws {AppError} If any other database error occurs.
 */
async function getProductAssignedOptions(productId) {
  // Check if product exists first
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) {
    throw new NotFoundError(`Product with ID ${productId} not found.`);
  }

  const query = `
    SELECT
      pao.id AS assigned_option_id,
      pao.option_id AS global_option_id,
      po.name AS global_option_name,
      pao.created_at,
      pao.updated_at,
      COALESCE(
        (
          SELECT json_agg(json_build_object('id', pov.id, 'value', pov.value) ORDER BY pov.value ASC)
          FROM product_assigned_option_specific_values paosv
          JOIN product_option_values pov ON paosv.product_option_value_id = pov.id
          WHERE paosv.product_assigned_option_id = pao.id
        ),
        '[]'::json
      ) AS selected_values
    FROM product_assigned_options pao
    JOIN product_options po ON pao.option_id = po.id
    WHERE pao.product_id = $1
    ORDER BY po.name;
  `;

  try {
    const result = await db.query(query, [productId]);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching assigned options for product ID ${productId} in service:`, error);
    throw new AppError(`Failed to retrieve assigned options for product ID ${productId}.`, 500, 'PRODUCT_ASSIGNED_OPTIONS_FETCH_FAILED');
  }
}


module.exports = {
  getAllProducts,
  getProductById,
  calculateProfitMargin,
  createProduct,
  updateProduct,
  updateProductStock,
  getAllStockLevels,
  getProductInventoryBatches,
  getProductCostHistory,
  getFormattedLabelData,
  getProductAssignedOptions,
};
