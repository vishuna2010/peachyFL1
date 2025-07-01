const db = require('../db');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError'); // Added AppError, ConflictError

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
    // If product has no variants, its own stock_quantity should be derived from batches.
    // The products.stock_quantity column is treated as a potential cache or legacy field;
    // actual stock is always from inventory_batches.
    if (!product.has_variants) {
      const baseProductBatchStockQuery = await client.query(
        `SELECT COALESCE(SUM(ib.quantity_remaining), 0) as total_batch_stock
         FROM inventory_batches ib
         WHERE ib.product_id = $1 AND ib.variant_id IS NULL`, // Removed AND ib.quantity_remaining > 0 to get sum even if it's 0
        [productId]
      );
      // Update the product object's stock_quantity with the true sum from batches.
      product.stock_quantity = parseInt(baseProductBatchStockQuery.rows[0]?.total_batch_stock || 0, 10);
    } else {
      // For products with variants, the base product.stock_quantity is not directly used for total stock count.
      // Instead, the sum of its variants' stock (derived from their batches) represents the total.
      // The product_effective_stock CTE in getAllProducts handles this for lists.
      // Here, we ensure product.stock_quantity on the main product object reflects its *own* non-variant stock if any (usually 0 if it has variants).
      // For consistency, let's also update it from any NULL variant_id batches, though typically these shouldn't exist if has_variants is true.
      const baseProductOwnStockQuery = await client.query(
        `SELECT COALESCE(SUM(ib.quantity_remaining), 0) as total_batch_stock
         FROM inventory_batches ib
         WHERE ib.product_id = $1 AND ib.variant_id IS NULL`,
        [productId]
      );
      product.stock_quantity = parseInt(baseProductOwnStockQuery.rows[0]?.total_batch_stock || 0, 10);
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
          `SELECT COALESCE(SUM(quantity_remaining), 0) as total_batch_stock
           FROM inventory_batches
           WHERE variant_id = $1 AND product_id = $2 AND quantity_remaining > 0`,
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
    // The product_images table is the source of truth for the gallery.
    // product.image_url is the main display image, which should correspond to one of the product_images marked as primary.
    // Variant images are separate and usually displayed contextually with the variant.

    product.gallery_images = imagesResult.rows.map(img => ({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text || product.name, // Fallback alt text
      display_order: img.display_order,
      is_primary: img.is_primary
    })).sort((a, b) => { // Sort by is_primary (true first), then display_order, then id
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      if ((a.display_order || 0) !== (b.display_order || 0)) {
        return (a.display_order || 0) - (b.display_order || 0);
      }
      return a.id - b.id; // Fallback sort by id for stability
    });

    // Ensure product.image_url is consistent with the primary image from the gallery
    const primaryImageFromGallery = product.gallery_images.find(img => img.is_primary);
    if (primaryImageFromGallery) {
      product.image_url = primaryImageFromGallery.url;
    } else if (product.gallery_images.length > 0 && !product.image_url) {
      // If no primary is marked in gallery, but gallery has images, and product.image_url is not set,
      // consider setting product.image_url to the first gallery image.
      // However, it's better if data integrity ensures a primary image or product.image_url is explicitly managed.
      // For now, if product.image_url is already set and no gallery image is primary, we keep product.image_url.
      // If product.image_url is NULL and gallery has images but none primary, this is a data issue.
      // Let's ensure product.image_url is set if gallery is not empty and product.image_url is currently null.
       product.image_url = product.gallery_images[0].url;
    } else if (product.gallery_images.length === 0 && product.image_url) {
      // If gallery is empty but product.image_url exists, add it to gallery_images as the primary.
      // This handles cases where only a main product image exists without explicit gallery entries.
      product.gallery_images.push({
        id: 'main_product_' + product.id, // Synthetic ID
        url: product.image_url,
        alt_text: product.name + " (Primary)",
        display_order: 0,
        is_primary: true
      });
    }
    // Note: The logic for including variant images directly in the main product gallery has been removed
    // as variant images are typically handled contextually when a variant is selected on the frontend.
    // The product.variants array already contains image_url for each variant.

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
        name, description, price, category_id, supplier_id, sku,
        reorder_threshold, product_status, image_url, tax_class_id, cost_price,
        wholesale_price, brand_manufacturer, supplier_reference, specifications,
        has_variants, average_rating, review_count, stock_quantity, -- stock_quantity kept for now but will be managed by batches
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        FALSE, 0, 0, 0, -- Initial products.stock_quantity to 0, actual stock via batches
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id;
    `;
    // Note: products.stock_quantity is set to 0 initially. Actual stock will be managed by inventory_batches.
    // The column products.stock_quantity might be deprecated or used as a read-only cache in the future.

    const values = [
      name, description || null, price, category_id || null, supplier_id || null, sku || null,
      reorder_threshold || null, product_status, imageUrlToStoreInDb,
      tax_class_id || null, cost_price || null, wholesale_price || null,
      brand_manufacturer || null, supplier_reference || null,
      specifications ? (typeof specifications === 'string' ? specifications : JSON.stringify(specifications)) : null,
    ];

    const result = await client.query(insertQuery, values);
    const newProductId = result.rows[0].id;

    // If initial stock_quantity is provided for this new product (which is non-variant at this point)
    // create an initial inventory batch and log it.
    const initialStockQuantity = parseInt(productData.stock_quantity, 10); // Use productData directly
    if (!isNaN(initialStockQuantity) && initialStockQuantity > 0) {
      const batchNumber = `INITIAL-${sku || `PROD${newProductId}`}-${Date.now()}`;
      const costAtReceipt = cost_price !== null ? cost_price : 0;
      const currencyCodeAtReceipt = config.currency.defaultStoreCurrency || 'USD'; // Assuming config is available

      await client.query(
        `INSERT INTO inventory_batches
          (product_id, variant_id, batch_number, initial_quantity, current_quantity,
           cost_price_at_receipt, currency_code_at_receipt, received_date)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id;`,
        [newProductId, batchNumber, initialStockQuantity, initialStockQuantity, costAtReceipt, currencyCodeAtReceipt]
      );

      // Assuming requestingUserId is passed or available in a wider scope if needed for audit
      // For now, using null for user_id in seed-like operation if not available.
      // This part of createProduct is usually called from an admin route, so req.user.userId would be available.
      // Let's assume createProduct is augmented to accept requestingUserId or it's handled by the caller.
      // For now, passing null to avoid breaking if not provided.
      const requestingUserId = productData.requestingUserId || null;
      await client.query(
        `INSERT INTO stock_movement_logs
            (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, NULL, $2, 'initial_stock_setup', $3, $4, $5, $6)`,
        [newProductId, requestingUserId, 'initial_stock_setup', initialStockQuantity, initialStockQuantity, 'Initial stock for new product', `product_id:${newProductId}`]
      );
    }


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
    // Ensure client is not undefined before trying to query
    if (client) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) { console.error("Error during ROLLBACK:", rollbackError); }
    }
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

    // This function now manages stock via inventory_batches for non-variant products.
    // The products.stock_quantity column is no longer directly updated here.

    const currentStockResult = await client.query(
      `SELECT COALESCE(SUM(current_quantity), 0) AS total_batch_stock
       FROM inventory_batches
       WHERE product_id = $1 AND variant_id IS NULL`,
      [productId]
    );
    const currentTotalBatchStock = parseInt(currentStockResult.rows[0].total_batch_stock, 10);
    const stockChange = stockQty - currentTotalBatchStock;

    if (stockChange !== 0) {
      const changeReason = productData.reason || 'Manual stock adjustment via product edit'; // Assuming productData might contain a reason
      const requestingUserId = productData.requestingUserId || null; // Assuming productData might contain userId

      if (stockChange > 0) { // Increase stock
        const manualBatchNumber = `MANUAL-${product.sku || `PROD${productId}`}-${Date.now()}`;
        // For simplicity, new stock increases create a new batch.
        // A more complex system might try to add to an existing "manual adjustment" batch.
        const costAtReceipt = product.cost_price !== null ? product.cost_price : 0;
        const currencyCodeAtReceipt = config.currency.defaultStoreCurrency || 'USD';
        await client.query(
          `INSERT INTO inventory_batches (product_id, variant_id, batch_number, initial_quantity, current_quantity, cost_price_at_receipt, currency_code_at_receipt, received_date)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [productId, manualBatchNumber, stockChange, stockChange, costAtReceipt, currencyCodeAtReceipt]
        );
      } else { // Decrease stock (stockChange < 0)
        // This is complex for FIFO/FEFO. For a simple manual adjustment on a non-variant product,
        // we can attempt to decrease from any available batch(es) or log if it's not straightforward.
        // For now, we'll log a warning similar to variant stock updates, as specific batch depletion is not implemented.
        // The overall stock will be reflected by the sum of batches.
        // A simple implementation would be to create a negative adjustment batch, but that can be problematic.
        // For now, we are aiming to make inventory_batches the source of truth.
        // The actual reduction from specific batches needs a more sophisticated inventory management function.
        // This function's primary role in this refactor is to stop direct updates to products.stock_quantity.
        // We will log the intended change. The actual stock will be the sum of batches.
        // If the `stockQty` (target total) is less than `currentTotalBatchStock`, it implies a reduction.
        // We need a mechanism to reduce batch quantities.
        console.warn(`[ProductService.updateProductStock] Stock decrease of ${-stockChange} requested for non-variant product ${productId}. Specific batch depletion logic is not fully implemented here. Ensure manual batch adjustments if needed.`);
        // For this refactor, we won't create negative batches. The expectation is that sales/other processes handle batch depletion.
        // This manual adjustment should ideally specify *which* batch to adjust or be a write-off.
        // To make this function actionable for decreases, we'd need to pick batches to reduce.
        // For now, we'll throw an error if a decrease is attempted this way, guiding to more specific tools.
        if (stockChange < 0) {
            // To prevent direct decrease without specifying batch, we can disallow it here or make it a specific type of movement.
            // For now, to make it functional for increases and log decreases:
             await client.query( // Still log the intended movement
              `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
               VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)`,
              [productId, requestingUserId, 'manual_adjustment_decrease_request', stockChange, stockQty, changeReason, `product_id:${productId}`]
            );
            // IMPORTANT: This does NOT actually decrease batch quantities. It only logs the *intent*.
            // A proper system would require selecting which batches to decrement.
            // For the scope of this refactor (making batches the source of truth), we stop direct product.stock_quantity updates.
            // Further inventory adjustment features would build on this.
        }
      }

      if (stockChange > 0) { // Only log positive adjustments made by this simplified function for now
        await client.query(
          `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)`,
          [productId, requestingUserId, 'manual_adjustment_increase', stockChange, stockQty, changeReason, `product_id:${productId}`]
        );
      }
    }
    // The products.stock_quantity column is NOT updated here.
    // It will be out of sync if not handled by a trigger or by ensuring all reads use batch sums.

    await client.query('COMMIT');
    return getProductById(productId);

  } catch (error) {
    if (client) { // Ensure client is defined before trying to query
        try { await client.query('ROLLBACK'); }
        catch (rollbackError) { console.error("Error during ROLLBACK:", rollbackError); }
    }
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


// --- Internal Helper for Variant Option Details ---
async function _getVariantOptionDetails(variantId, client) {
  const detailsQuery = `
    SELECT
        pov.id as option_value_id,
        pov.value as option_value_name,
        po.id as option_id,
        po.name as option_name
    FROM product_variant_option_values pvov
    JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
    JOIN product_options po ON pov.product_option_id = po.id
    WHERE pvov.variant_id = $1
    ORDER BY po.name, pov.value;
  `;
  // Use the provided client if available (for transactions), otherwise use the pool.
  const dbExecutor = client || db;
  const { rows } = await dbExecutor.query(detailsQuery, [variantId]);
  return rows;
}

/**
 * Retrieves all variants for a given product, including their selected option details.
 * @param {number} productId - The ID of the product.
 * @returns {Promise<Array<object>>} An array of variant objects, each with a 'selected_options' array.
 * @throws {NotFoundError} If the product is not found.
 */
async function getProductVariants(productId) {
  const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (productCheck.rows.length === 0) {
    throw new NotFoundError(`Product with ID ${productId} not found.`);
  }

  const variantsResult = await db.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id', [productId]);
  const variants = [];
  for (const variant of variantsResult.rows) {
    const details = await _getVariantOptionDetails(variant.id); // Uses pool connection
    variants.push({ ...variant, selected_options: details });
  }
  return variants;
}

/**
 * Retrieves a specific variant by its ID, including its selected option details.
 * @param {number} variantId - The ID of the variant.
 * @returns {Promise<object>} The variant object with a 'selected_options' array.
 * @throws {NotFoundError} If the variant is not found.
 */
async function getVariantById(variantId) {
  const variantResult = await db.query('SELECT * FROM product_variants WHERE id = $1', [variantId]);
  if (variantResult.rows.length === 0) {
    throw new NotFoundError(`Variant with ID ${variantId} not found.`);
  }
  const variant = variantResult.rows[0];
  const details = await _getVariantOptionDetails(variant.id); // Uses pool connection
  return { ...variant, selected_options: details };
}

// Error classes are already imported at the top of the file.

/**
 * Creates a new product variant.
 * @param {number} productId - The ID of the parent product.
 * @param {object} variantData - Data for the new variant.
 * @param {string} [variantData.sku]
 * @param {number|string} variantData.price_modifier
 * @param {number|string} variantData.stock_quantity
 * @param {string} [variantData.image_url] - Direct URL, S3 upload handled by fileData
 * @param {Array<number>} variantData.option_value_ids - Array of global product_option_value IDs.
 * @param {number|string} [variantData.cost_price]
 * @param {number|string} [variantData.wholesale_price_modifier]
 * @param {object} [fileData] - Optional file object from multer for image upload.
 * @param {number} [requestingUserId] - Optional ID of the user making the request (for logging).
 * @returns {Promise<object>} The newly created variant object with selected_options.
 */
async function createProductVariant(productId, variantData, fileData, requestingUserId = null) {
  const {
    sku, price_modifier, stock_quantity, image_url: directImageUrl, // image_url from body if not using fileData
    option_value_ids, cost_price, wholesale_price_modifier
  } = variantData;

  const finalSku = sku && sku.trim() !== '' ? sku.trim() : null;
  const numPriceModifier = parseFloat(price_modifier);
  const numStockQuantity = parseInt(stock_quantity, 10);
  const numCostPrice = (cost_price !== undefined && cost_price !== null && cost_price !== '') ? parseFloat(cost_price) : null;
  const numWholesalePriceModifier = (wholesale_price_modifier !== undefined && wholesale_price_modifier !== null && wholesale_price_modifier !== '') ? parseFloat(wholesale_price_modifier) : null;


  if (isNaN(numPriceModifier)) throw new BadRequestError('Price modifier must be a valid number.');
  if (isNaN(numStockQuantity) || numStockQuantity < 0) throw new BadRequestError('Stock quantity must be a non-negative integer.');
  if (numCostPrice !== null && (isNaN(numCostPrice) || numCostPrice < 0)) throw new BadRequestError('Cost price must be a non-negative number or null.');
  if (numWholesalePriceModifier !== null && isNaN(numWholesalePriceModifier)) throw new BadRequestError('Wholesale price modifier must be a number or null.');


  if (!Array.isArray(option_value_ids) || option_value_ids.length === 0) {
    throw new BadRequestError('At least one option value ID is required.');
  }
  const uniqueOptionValueIds = [...new Set(option_value_ids.map(id => parseInt(id)))];
  if (uniqueOptionValueIds.some(isNaN)) throw new BadRequestError('All option value IDs must be integers.');
  if (uniqueOptionValueIds.length !== option_value_ids.length) throw new BadRequestError('Duplicate option value IDs provided.');


  const client = await db.pool.connect();
  let s3VariantFileKey = null;
  let variantImageUrl = directImageUrl || null; // Prioritize direct URL if provided

  try {
    await client.query('BEGIN');

    const productResult = await client.query('SELECT id, name FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (productResult.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }

    // Validate option_value_ids (existence, one per option type, assigned to product)
    const selectedGlobalOptionTypes = new Set();
    for (const globalValueId of uniqueOptionValueIds) {
      const valueCheck = await client.query(
        `SELECT pov.product_option_id, po.name AS option_name
         FROM product_option_values pov
         JOIN product_options po ON pov.product_option_id = po.id
         WHERE pov.id = $1`, [globalValueId]
      );
      if (valueCheck.rows.length === 0) throw new NotFoundError(`Global option value ID ${globalValueId} not found.`);
      const globalOptionId = valueCheck.rows[0].product_option_id;
      if (selectedGlobalOptionTypes.has(globalOptionId)) {
        throw new BadRequestError(`Multiple values selected for the same global option type "${valueCheck.rows[0].option_name}".`);
      }
      selectedGlobalOptionTypes.add(globalOptionId);

      const assignmentCheck = await client.query(
        `SELECT paosv.id FROM product_assigned_option_specific_values paosv
         JOIN product_assigned_options pao ON paosv.product_assigned_option_id = pao.id
         WHERE pao.product_id = $1 AND pao.option_id = $2 AND paosv.product_option_value_id = $3`,
        [productId, globalOptionId, globalValueId]
      );
      if (assignmentCheck.rows.length === 0) {
        throw new BadRequestError(`Option value ID ${globalValueId} (for option ${valueCheck.rows[0].option_name}) is not assigned/allowed for product ID ${productId}.`);
      }
    }

    // Check for duplicate variant combination
    const sortedIds = [...uniqueOptionValueIds].sort((a, b) => a - b);
    const existingVariantsCheckQuery = `
      SELECT pv.id FROM product_variants pv
      WHERE pv.product_id = $1 AND (
          SELECT array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id)
          FROM product_variant_option_values pvov
          WHERE pvov.product_variant_id = pv.id
      ) = $2::int[];
    `;
    const duplicateCheckResult = await client.query(existingVariantsCheckQuery, [productId, sortedIds]);
    if (duplicateCheckResult.rows.length > 0) {
      throw new ConflictError('A variant with this exact combination of option values already exists.');
    }

    // SKU Uniqueness Check (across products and other variants)
    if (finalSku) {
      const skuCheck = await client.query(
        `SELECT id FROM product_variants WHERE sku = $1
         UNION
         SELECT id FROM products WHERE sku = $1`,
        [finalSku]
      );
      if (skuCheck.rows.length > 0) {
        throw new ConflictError(`SKU "${finalSku}" already exists.`);
      }
    }

    // Handle S3 image upload if fileData is provided
    if (fileData) {
        if (!isS3Configured()) {
            throw new AppError("Variant image upload failed: S3 service not configured.", 500, "S3_NOT_CONFIGURED");
        }
        try {
            const uniqueFileName = `product-variants/variant-${productId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
            const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
            variantImageUrl = s3Data.Location;
            s3VariantFileKey = s3Data.Key;
        } catch (s3Error) {
            console.error("S3 Upload Error for variant image:", s3Error);
            throw new AppError("Failed to upload variant image to S3.", 500, "S3_UPLOAD_FAILED", { originalError: s3Error.message });
        }
    }


    const variantInsertResult = await client.query(
      `INSERT INTO product_variants (product_id, sku, price_modifier, stock_quantity, image_url, cost_price, wholesale_price_modifier)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [productId, finalSku, numPriceModifier, numStockQuantity, variantImageUrl, numCostPrice, numWholesalePriceModifier]
    );
    const newVariant = variantInsertResult.rows[0];

    for (const ovId of uniqueOptionValueIds) {
      await client.query(
        'INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2)',
        [newVariant.id, ovId]
      );
    }

    await client.query('UPDATE products SET has_variants = TRUE, updated_at = NOW() WHERE id = $1 AND has_variants = FALSE', [productId]);

    if (newVariant.stock_quantity > 0) {
      const batchNumber = `INITIAL-${newVariant.sku || `VAR${newVariant.id}`}-${Date.now()}`;
      const costAtReceipt = newVariant.cost_price !== null ? newVariant.cost_price : 0;
      // TODO: Get currency code from product/supplier or config default
      const currencyCodeAtReceipt = config.currency.defaultStoreCurrency || 'USD';

      await client.query(
        `INSERT INTO inventory_batches
          (product_id, variant_id, batch_number, initial_quantity, current_quantity,
           cost_price_at_receipt, currency_code_at_receipt, received_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id;`,
        [newVariant.product_id, newVariant.id, batchNumber, newVariant.stock_quantity, newVariant.stock_quantity, costAtReceipt, currencyCodeAtReceipt]
      );

      await client.query(
        `INSERT INTO stock_movement_logs
            (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newVariant.product_id, newVariant.id, requestingUserId, 'initial_stock_setup', newVariant.stock_quantity, newVariant.stock_quantity, 'Initial stock for new variant', `variant_id:${newVariant.id}`]
      );
    }

    await client.query('COMMIT');

    const finalVariantDetails = await _getVariantOptionDetails(newVariant.id, client); // Use client to ensure read after write consistency if needed, or null for pool
    return { ...newVariant, selected_options: finalVariantDetails };

  } catch (error) {
    await client.query('ROLLBACK');
    if (s3VariantFileKey && isS3Configured()) {
        try { await deleteFileFromS3(s3VariantFileKey); }
        catch (s3e) { console.error(`CRITICAL: Failed to rollback S3 upload for variant image ${s3VariantFileKey}:`, s3e); }
    }
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) {
      throw error;
    }
    console.error('Error in productService.createProductVariant:', error);
    throw new AppError('Failed to create product variant.', 500, 'VARIANT_CREATION_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}


/**
 * Updates an existing product variant.
 * @param {number} variantId - The ID of the variant to update.
 * @param {object} variantData - Data for updating the variant.
 * @param {string} [variantData.sku]
 * @param {number|string} [variantData.price_modifier]
 * @param {number|string} [variantData.stock_quantity] - New target aggregate stock.
 * @param {string} [variantData.image_url] - Explicit new URL or null to remove if no fileData.
 * @param {Array<number>} [variantData.option_value_ids] - If provided, replaces existing option values.
 * @param {string} [variantData.reason] - Reason for stock adjustment if stock_quantity is changed.
 * @param {number|string} [variantData.cost_price]
 * @param {number|string} [variantData.wholesale_price_modifier]
 * @param {object} [fileData] - Optional file object from multer for new image.
 * @param {boolean} [removeImageByFlag=false] - Explicit flag to remove image if image_url not in variantData.
 * @param {number} [requestingUserId] - Optional ID of the user making the request (for logging).
 * @returns {Promise<object>} The updated variant object with selected_options.
 */
async function updateProductVariant(variantId, variantData, fileData, removeImageByFlag = false, requestingUserId = null) {
  const {
    sku, price_modifier, stock_quantity, image_url: directImageUrl,
    option_value_ids, reason, cost_price, wholesale_price_modifier
  } = variantData;

  const client = await db.pool.connect();
  let s3NewFileKey = null;
  let s3OldFileKey = null;
  let finalImageUrl = undefined; // undefined means no change unless file/remove flag says otherwise

  try {
    await client.query('BEGIN');

    const currentVariantResult = await client.query('SELECT * FROM product_variants WHERE id = $1 FOR UPDATE', [variantId]);
    if (currentVariantResult.rows.length === 0) {
      throw new NotFoundError(`Variant with ID ${variantId} not found.`);
    }
    const currentVariant = currentVariantResult.rows[0];
    finalImageUrl = currentVariant.image_url; // Default to current

    // --- Image Handling ---
    if (fileData) { // New image uploaded
      if (!isS3Configured()) throw new AppError("S3 service not configured.", 500, "S3_NOT_CONFIGURED");
      if (currentVariant.image_url) s3OldFileKey = getS3KeyFromUrl(currentVariant.image_url);

      const uniqueFileName = `product-variants/variant-${currentVariant.product_id}-${variantId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
      const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
      finalImageUrl = s3Data.Location;
      s3NewFileKey = s3Data.Key;
    } else if (removeImageByFlag || (variantData.hasOwnProperty('image_url') && directImageUrl === null)) { // Explicit removal
      if (currentVariant.image_url && isS3Configured()) s3OldFileKey = getS3KeyFromUrl(currentVariant.image_url);
      finalImageUrl = null;
    } else if (variantData.hasOwnProperty('image_url') && typeof directImageUrl === 'string') { // Setting to a new direct URL
        if (currentVariant.image_url && currentVariant.image_url !== directImageUrl && isS3Configured()) {
             s3OldFileKey = getS3KeyFromUrl(currentVariant.image_url); // Delete old S3 if new URL is different
        }
        finalImageUrl = directImageUrl;
    }
    // If image_url is not in variantData and no fileData and no removeImageByFlag, finalImageUrl remains currentVariant.image_url

    // --- Stock Quantity Update via Batches (if stock_quantity is provided) ---
    let newAggregateStockForVariantTable = currentVariant.stock_quantity;
    if (stock_quantity !== undefined && stock_quantity !== null) {
      const targetStock = parseInt(stock_quantity, 10);
      if (isNaN(targetStock) || targetStock < 0) {
        throw new BadRequestError('Stock quantity must be a non-negative integer.');
      }
      newAggregateStockForVariantTable = targetStock; // This will be set on product_variants table

      const existingBatchStockResult = await client.query(
        `SELECT COALESCE(SUM(quantity_remaining), 0) AS total_batch_stock FROM inventory_batches WHERE variant_id = $1 AND product_id = $2`, // Corrected: current_quantity to quantity_remaining
        [variantId, currentVariant.product_id]
      );
      const currentTotalBatchStock = parseInt(existingBatchStockResult.rows[0].total_batch_stock, 10);
      const stockChange = targetStock - currentTotalBatchStock;

      if (stockChange !== 0) {
        const changeReason = reason || 'Manual stock adjustment via variant edit';
        if (stockChange > 0) { // Increase stock - add to a new or existing manual batch
          const manualBatchNumber = `MANUAL-${currentVariant.sku || `VAR${variantId}`}`;
          const existingManualBatch = await client.query(
            `SELECT id FROM inventory_batches WHERE variant_id = $1 AND product_id = $2 AND batch_number = $3 FOR UPDATE`,
            [variantId, currentVariant.product_id, manualBatchNumber]
          );
          if (existingManualBatch.rows.length > 0) {
            await client.query(
              `UPDATE inventory_batches SET quantity_remaining = quantity_remaining + $1, quantity_received = quantity_received + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`, // Corrected: current_quantity to quantity_remaining, initial_quantity to quantity_received
              [stockChange, stockChange, existingManualBatch.rows[0].id]
            );
          } else {
            const costAtReceipt = variantData.cost_price !== undefined ? parseFloat(variantData.cost_price) : (currentVariant.cost_price !== null ? currentVariant.cost_price : 0);
            const currencyCodeAtReceipt = config.currency.defaultStoreCurrency || 'USD';
            await client.query(
              `INSERT INTO inventory_batches (product_id, variant_id, batch_number, quantity_received, quantity_remaining, cost_price_at_receipt, currency_code_at_receipt, received_date) // Corrected: initial_quantity to quantity_received, current_quantity to quantity_remaining
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
              [currentVariant.product_id, variantId, manualBatchNumber, stockChange, stockChange, costAtReceipt, currencyCodeAtReceipt]
            );
          }
        } else { // Decrease stock (stockChange < 0) - this is complex. For now, log and rely on aggregate update.
             console.warn(`[ProductService] Stock decrease of ${-stockChange} requested for variant ${variantId}. This currently only updates the aggregate and logs. Ensure specific batch decrements if using FEFO/FIFO for sales.`);
        }
        // Log movement
        await client.query(
          `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [currentVariant.product_id, variantId, requestingUserId, 'manual_adjustment', stockChange, targetStock, changeReason, `variant_id:${variantId}`]
        );
      }
    }

    // --- Option Value IDs Update (if provided) ---
    if (option_value_ids) {
      const uniqueNewOptionValueIds = [...new Set(option_value_ids.map(id => parseInt(id)))].sort((a, b) => a - b);
      if (uniqueNewOptionValueIds.some(isNaN)) throw new BadRequestError('All option value IDs must be integers.');
      if (uniqueNewOptionValueIds.length !== option_value_ids.length && option_value_ids.length > 0) throw new BadRequestError('Duplicate option value IDs provided.');
      if (uniqueNewOptionValueIds.length === 0) throw new BadRequestError('At least one option value ID is required if options are being updated.');

      // Validation for new option_value_ids (similar to POST)
      const newSelectedGlobalOptionTypes = new Set();
      for (const globalValueId of uniqueNewOptionValueIds) {
        const valueCheck = await client.query(`SELECT pov.product_option_id, po.name AS option_name FROM product_option_values pov JOIN product_options po ON pov.product_option_id = po.id WHERE pov.id = $1`, [globalValueId]);
        if (valueCheck.rows.length === 0) throw new NotFoundError(`Global option value ID ${globalValueId} not found.`);
        const globalOptionId = valueCheck.rows[0].product_option_id;
        if (newSelectedGlobalOptionTypes.has(globalOptionId)) throw new BadRequestError(`Multiple values selected for the same global option type "${valueCheck.rows[0].option_name}".`);
        newSelectedGlobalOptionTypes.add(globalOptionId);
        const assignmentCheck = await client.query(
            `SELECT paosv.id FROM product_assigned_option_specific_values paosv
             JOIN product_assigned_options pao ON paosv.product_assigned_option_id = pao.id
             WHERE pao.product_id = $1 AND pao.option_id = $2 AND paosv.product_option_value_id = $3`,
            [currentVariant.product_id, globalOptionId, globalValueId]
        );
        if (assignmentCheck.rows.length === 0) throw new BadRequestError(`Option value ID ${globalValueId} (for option ${valueCheck.rows[0].option_name}) is not assigned/allowed for product ID ${currentVariant.product_id}.`);
      }
      // Check for duplicate variant with the new combination
      const duplicateCheck = await client.query(
          `SELECT pv.id FROM product_variants pv WHERE pv.product_id = $1 AND pv.id != $2 AND
           (SELECT array_agg(pvov.product_option_value_id ORDER BY pvov.product_option_value_id) FROM product_variant_option_values pvov WHERE pvov.product_variant_id = pv.id) = $3::int[]`,
          [currentVariant.product_id, variantId, uniqueNewOptionValueIds]
      );
      if (duplicateCheck.rows.length > 0) throw new ConflictError('Another variant with this exact combination of option values already exists.');

      await client.query('DELETE FROM product_variant_option_values WHERE product_variant_id = $1', [variantId]);
      for (const ovId of uniqueNewOptionValueIds) {
        await client.query('INSERT INTO product_variant_option_values (product_variant_id, product_option_value_id) VALUES ($1, $2)', [variantId, ovId]);
      }
    }

    // --- SKU Uniqueness Check (if SKU is being changed) ---
    const finalSku = (variantData.hasOwnProperty('sku') && sku && sku.trim() !== '') ? sku.trim() : ( (variantData.hasOwnProperty('sku') && (sku === null || sku === '')) ? null : currentVariant.sku);
    if (finalSku && finalSku !== currentVariant.sku) {
        const skuCheck = await client.query(
            `SELECT id FROM product_variants WHERE sku = $1 AND id != $2
             UNION
             SELECT id FROM products WHERE sku = $1`, // Also check base products
            [finalSku, variantId]
        );
        if (skuCheck.rows.length > 0) {
            throw new ConflictError(`SKU "${finalSku}" already exists.`);
        }
    }


    // --- Update product_variants table ---
    const setClauses = [];
    const queryValues = [];
    let paramIndex = 1;

    const addUpdateField = (fieldName, value, currentValue) => {
      if (variantData.hasOwnProperty(fieldName) && value !== currentValue) {
        setClauses.push(`${fieldName} = $${paramIndex++}`);
        queryValues.push(value);
      }
    };

    addUpdateField('sku', finalSku, currentVariant.sku);
    if(variantData.hasOwnProperty('price_modifier')) addUpdateField('price_modifier', parseFloat(price_modifier), parseFloat(currentVariant.price_modifier));
    // stock_quantity on product_variants table is updated with the target aggregate stock
    if(variantData.hasOwnProperty('stock_quantity')) addUpdateField('stock_quantity', newAggregateStockForVariantTable, currentVariant.stock_quantity);
    if(finalImageUrl !== undefined) addUpdateField('image_url', finalImageUrl, currentVariant.image_url); // Check against undefined to allow setting to null
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

    if (s3OldFileKey && s3OldFileKey !== s3NewFileKey) { // If a new image was uploaded and replaced an old one, or old one was removed
        try { await deleteFileFromS3(s3OldFileKey); }
        catch (s3e) { console.error(`Failed to delete old S3 variant image ${s3OldFileKey}:`, s3e); }
    }

    const optionDetails = await _getVariantOptionDetails(updatedVariant.id, client);
    return { ...updatedVariant, selected_options: optionDetails };

  } catch (error) {
    await client.query('ROLLBACK');
    if (s3NewFileKey && isS3Configured()) { // If new image uploaded but DB op failed
        try { await deleteFileFromS3(s3NewFileKey); }
        catch (s3e) { console.error(`CRITICAL: Failed to rollback S3 upload for new variant image ${s3NewFileKey}:`, s3e); }
    }
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) {
      throw error;
    }
    console.error(`Error in productService.updateProductVariant for ID ${variantId}:`, error);
    throw new AppError('Failed to update product variant.', 500, 'VARIANT_UPDATE_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}


/**
 * Deletes a product variant.
 * @param {number} variantId - The ID of the variant to delete.
 * @returns {Promise<object>} The deleted variant object.
 * @throws {NotFoundError} If the variant is not found.
 * @throws {AppError} If database operation fails.
 */
async function deleteProductVariant(variantId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const variantResult = await client.query('SELECT * FROM product_variants WHERE id = $1 FOR UPDATE', [variantId]);
    if (variantResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Variant with ID ${variantId} not found.`);
    }
    const deletedVariantData = variantResult.rows[0];
    const { product_id: baseProductId, image_url: variantImageUrl } = deletedVariantData;

    // product_variant_option_values are deleted by ON DELETE CASCADE constraint

    // Delete from inventory_batches (important to prevent orphaned batch stock)
    // This should ideally also log stock movements if current_quantity > 0 in deleted batches
    const batchDeletionResult = await client.query('DELETE FROM inventory_batches WHERE variant_id = $1 RETURNING current_quantity, batch_number', [variantId]);
    if (batchDeletionResult.rows.length > 0) {
        console.log(`Deleted ${batchDeletionResult.rowCount} inventory batches for variant ID ${variantId}. Affected quantities: ${batchDeletionResult.rows.map(r => r.current_quantity).join(', ')}`);
        // TODO: Consider logging these as stock write-offs if they had quantity.
    }


    const deleteResult = await client.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
    // No need to check rowCount again due to FOR UPDATE select

    // Check if the parent product has any remaining variants
    const remainingVariantsResult = await client.query('SELECT COUNT(*) AS count FROM product_variants WHERE product_id = $1', [baseProductId]);
    if (parseInt(remainingVariantsResult.rows[0].count, 10) === 0) {
      await client.query('UPDATE products SET has_variants = FALSE, updated_at = NOW() WHERE id = $1', [baseProductId]);
    }

    await client.query('COMMIT');

    // If variant had an S3 image, delete it after successful DB commit
    if (variantImageUrl && isS3Configured()) {
        const s3Key = getS3KeyFromUrl(variantImageUrl);
        if (s3Key) {
            try {
                await deleteFileFromS3(s3Key);
                console.log(`Deleted S3 image ${s3Key} for variant ${variantId}`);
            } catch (s3Error) {
                console.error(`Failed to delete S3 image ${s3Key} for variant ${variantId}:`, s3Error);
                // Non-critical, don't fail the whole operation
            }
        }
    }
    return deletedVariantData; // Return the data of the variant that was deleted
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError) {
      throw error;
    }
    // TODO: Check for FK constraints if variant is on order_items, etc.
    // For now, assuming orders lock variant details at time of purchase or handle missing variants.
    console.error(`Error in productService.deleteProductVariant for ID ${variantId}:`, error);
    throw new AppError(`Failed to delete product variant ID ${variantId}.`, 500, 'VARIANT_DELETE_FAILED');
  } finally {
    client.release();
  }
}


/**
 * Deletes a product and all its associated data including variants, images, tags, etc.
 * Performs dependency checks for orders and purchase orders.
 * Handles S3 image deletions after successful database transaction.
 * @param {number} productId - The ID of the product to delete.
 * @returns {Promise<object>} The data of the product that was deleted.
 * @throws {NotFoundError} If the product is not found.
 * @throws {BadRequestError} If the product is linked to orders or purchase orders.
 * @throws {AppError} If any other database or S3 operation fails critically.
 */
async function deleteProduct(productId) {
  const client = await db.pool.connect();
  const s3KeysToDelete = new Set(); // Use a Set to avoid duplicate keys

  try {
    await client.query('BEGIN');

    // 1. Product Existence & Locking (also get image_url and has_variants)
    const productResult = await client.query('SELECT id, image_url, has_variants FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK'); // No need to proceed if product not found
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const product = productResult.rows[0];
    if (product.image_url) {
      const key = getS3KeyFromUrl(product.image_url);
      if (key) s3KeysToDelete.add(key);
    }

    // 2. Dependency Checks
    const orderItemCheck = await client.query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [productId]);
    if (orderItemCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new BadRequestError(`Product ID ${productId} cannot be deleted: it is part of existing orders.`);
    }

    const poItemCheck = await client.query('SELECT 1 FROM purchase_order_items WHERE product_id = $1 LIMIT 1', [productId]);
    if (poItemCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new BadRequestError(`Product ID ${productId} cannot be deleted: it is part of existing purchase orders.`);
    }

    // 3. Collect S3 keys from gallery images
    const galleryImagesResult = await client.query('SELECT image_url FROM product_images WHERE product_id = $1', [productId]);
    galleryImagesResult.rows.forEach(img => {
      if (img.image_url) {
        const key = getS3KeyFromUrl(img.image_url);
        if (key) s3KeysToDelete.add(key);
      }
    });

    // 4. Handle Variants (if any)
    if (product.has_variants) {
      const variantsResult = await client.query('SELECT id, image_url FROM product_variants WHERE product_id = $1', [productId]);
      for (const variant of variantsResult.rows) {
        if (variant.image_url) {
          const key = getS3KeyFromUrl(variant.image_url);
          if (key) s3KeysToDelete.add(key);
        }
        // Delete inventory batches for this variant
        await client.query('DELETE FROM inventory_batches WHERE variant_id = $1', [variant.id]);
        // product_variant_option_values will be deleted by cascade when product_variants are deleted
      }
      // Delete all variants for the product
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
    } else {
      // Delete inventory batches for the base product (no variants)
      await client.query('DELETE FROM inventory_batches WHERE product_id = $1 AND variant_id IS NULL', [productId]);
    }

    // 5. Delete other associated data
    await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);

    // Must delete from product_assigned_option_specific_values before product_assigned_options
    await client.query(`
      DELETE FROM product_assigned_option_specific_values
      WHERE product_assigned_option_id IN (SELECT id FROM product_assigned_options WHERE product_id = $1)
    `, [productId]);
    await client.query('DELETE FROM product_assigned_options WHERE product_id = $1', [productId]);

    await client.query('DELETE FROM product_cost_history WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM product_reviews WHERE product_id = $1', [productId]);

    // 6. Delete Main Product Record
    const deletedProductResult = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
    // This should always return a row due to the FOR UPDATE select earlier, but good to have.
    if (deletedProductResult.rowCount === 0) {
        // This implies a concurrent deletion or an issue, rollback.
        await client.query('ROLLBACK');
        throw new AppError(`Product with ID ${productId} was unexpectedly not found during final delete operation.`, 500, 'PRODUCT_DELETE_RACE_CONDITION');
    }
    const deletedProductData = deletedProductResult.rows[0];

    // 7. Commit Transaction
    await client.query('COMMIT');

    // 8. Delete S3 Objects (After Successful Commit)
    if (s3KeysToDelete.size > 0 && isS3Configured()) {
      console.log(`Attempting to delete ${s3KeysToDelete.size} S3 objects for product ID ${productId}.`);
      for (const key of s3KeysToDelete) {
        try {
          await deleteFileFromS3(key);
          console.log(`Successfully deleted S3 object: ${key}`);
        } catch (s3Error) {
          // Log S3 deletion errors but do not fail the overall operation at this point
          console.error(`Failed to delete S3 object ${key} for product ID ${productId}:`, s3Error.message);
        }
      }
    }

    return deletedProductData;

  } catch (error) {
    // Ensure rollback if not already done
    if (client && client.activeQuery === null && !client._ending && client._connected ) { // Check if client is in a state where rollback is possible
        try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('Rollback error in deleteProduct catch block:', rbErr); }
    }
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error; // Re-throw known application errors
    }
    console.error(`Error in productService.deleteProduct for ID ${productId}:`, error);
    throw new AppError(`Failed to delete product ID ${productId}.`, 500, 'PRODUCT_DELETE_FAILED', { originalError: error.message });
  } finally {
    if (client) client.release();
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
  getProductVariants,
  getVariantById,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  deleteProduct,
  getPublicProductFilterOptions, // Added new function
};

/**
 * Fetches product options and their distinct values available for public filtering.
 * Considers only options linked to active products that have variants.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of option objects.
 *          Each object has:
 *            - option_id: number
 *            - option_name: string
 *            - values: Array of { value_id: number, value_name: string }
 *          The options are ordered by option_name.
 * @throws {AppError} If the database operation fails.
 */
async function getPublicProductFilterOptions() {
  const query = `
    WITH RelevantOptionValues AS (
        SELECT DISTINCT
            po.id AS option_id,
            po.name AS option_name,
            pov.id AS value_id,
            pov.value AS value_name
        FROM
            product_options po
        JOIN
            product_option_values pov ON po.id = pov.product_option_id
        JOIN
            product_variant_option_values pvov ON pov.id = pvov.product_option_value_id
        JOIN
            product_variants pv ON pvov.variant_id = pv.id -- Corrected pvov.product_variant_id to pvov.variant_id
        JOIN
            products p ON pv.product_id = p.id
        WHERE
            p.product_status = 'active' AND p.has_variants = TRUE
    )
    SELECT
        rov.option_id,
        rov.option_name,
        json_agg(jsonb_build_object('value_id', rov.value_id, 'value_name', rov.value_name) ORDER BY rov.value_name ASC) AS "values"
    FROM
        RelevantOptionValues rov
    GROUP BY
        rov.option_id, rov.option_name
    ORDER BY
        rov.option_name;
  `;
  try {
    const { rows } = await db.query(query);
    // The json_agg will return null if a group is empty (no values for an option_id/option_name combination from RelevantOptionValues)
    // which shouldn't happen if RelevantOptionValues only contains options that *do* have values linked to active products.
    // However, if an option exists but has no values linked to *active variant products*, it might not appear.
    // The original query's structure might have implicitly handled this differently by starting from product_options.
    // This new query will only return options that actually have values on active, variant products.
    return rows.map(option => ({
        ...option,
        values: option.values || [] // Ensure values is an array, especially if json_agg could return null for a group.
    }));
  } catch (error) {
    console.error('[productService.getPublicProductFilterOptions] Error fetching public filter options:', error);
    throw new AppError('Failed to retrieve public product filter options.', 500, 'PUBLIC_FILTER_OPTIONS_FETCH_FAILED');
  }
}
