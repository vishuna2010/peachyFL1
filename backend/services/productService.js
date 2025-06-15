const db = require('../db');
const { BadRequestError, NotFoundError } = require('../utils/AppError');

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

async function getAllProducts({
  searchTerm,
  categoryId,
  minPrice,
  maxPrice,
  sortBy,
  sort_order = 'ASC', // New: 'ASC' or 'DESC'
  optionValueId,
  status, // New: 'active', 'draft', 'archived', etc.
  stock_status, // New: 'in_stock', 'out_of_stock', 'low_stock'
  is_admin_request = false, // New: boolean
  include_total_stock = false, // New: boolean, to add total stock for variant products
  page = 1,
  limit = 10
}) {
  const queryValues = [];
  let paramIndex = 1;

  // Base columns to select from products p.
  const productColumns = `
    p.id, p.name, p.description, p.price, p.category_id, p.image_url,
    p.stock_quantity, p.sku, p.supplier_id, p.reorder_threshold,
    p.has_variants, p.average_rating, p.review_count, p.product_status,
    p.created_at, p.updated_at
  `;
  // Note: p.product_status is added

  let ctes = []; // Common Table Expressions

  // CTE for effective stock (handles variants)
  const stockCte = `
    product_effective_stock AS (
      SELECT
        p_stock.id as product_id,
        CASE
          WHEN p_stock.has_variants THEN COALESCE((SELECT SUM(pv_stock.stock_quantity) FROM product_variants pv_stock WHERE pv_stock.product_id = p_stock.id), 0)
          ELSE p_stock.stock_quantity
        END as effective_stock_quantity,
        CASE
          WHEN p_stock.has_variants THEN
            COALESCE((SELECT SUM(pv_stock.stock_quantity) FROM product_variants pv_stock WHERE pv_stock.product_id = p_stock.id), 0) > 0 AND
            COALESCE((SELECT SUM(pv_stock.stock_quantity) FROM product_variants pv_stock WHERE pv_stock.product_id = p_stock.id), 0) < p_stock.reorder_threshold
          ELSE p_stock.stock_quantity > 0 AND p_stock.stock_quantity < p_stock.reorder_threshold
        END as is_low_stock
      FROM products p_stock
    )
  `;
  ctes.push(stockCte);

  let withClause = "";
  if (ctes.length > 0) {
    withClause = `WITH ${ctes.join(", ")} `;
  }

  // Determine if product_variants table needs to be joined in the main query
  // It's needed for optionValueId filter or if searchTerm needs to check variant SKUs.
  let needsVariantJoinForFilter = !!optionValueId;
  if (searchTerm && !needsVariantJoinForFilter) { // if searchTerm is present and we haven't decided to join variants yet
      // This simple flag is not enough, as the join must be conditional in the query string itself.
      // For now, let's assume searchTerm might apply to variants if they exist.
  }


  let fromClause = `
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN product_effective_stock pes ON p.id = pes.product_id
  `;

  let selectColumns = `${productColumns},
    c.name as category_name, s.name as supplier_name,
    COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags,
    pes.effective_stock_quantity, pes.is_low_stock`;

  if (include_total_stock) { // This is somewhat redundant if pes.effective_stock_quantity is already what's needed
    selectColumns += `, pes.effective_stock_quantity as total_stock_display`;
  }


  let selectPrefix = `SELECT ${selectColumns}`;
  if (optionValueId) { // If filtering by optionValueId, ensure distinct products
    selectPrefix = `SELECT DISTINCT ON (p.id) ${selectColumns}`; // Use DISTINCT ON (p.id) and matching ORDER BY p.id first
    fromClause += `
      LEFT JOIN product_variants pv_filter ON p.id = pv_filter.product_id
      LEFT JOIN product_variant_option_values pvov_filter ON pv_filter.id = pvov_filter.product_variant_id
    `;
  } else if (searchTerm) { // General search might need to check variant SKU
     // No explicit join here, search term logic will handle conditional pv.sku search if needed
  }

  let baseSelect = withClause + selectPrefix + fromClause;
  let countBaseQuery = withClause + `SELECT COUNT(DISTINCT p.id) as total_count FROM products p LEFT JOIN product_effective_stock pes ON p.id = pes.product_id `;
   // Add joins to countBaseQuery if they are part of filtering conditions
  if (optionValueId) {
    countBaseQuery += `
      LEFT JOIN product_variants pv_filter_count ON p.id = pv_filter_count.product_id
      LEFT JOIN product_variant_option_values pvov_filter_count ON pv_filter_count.id = pvov_filter_count.product_variant_id
    `;
  }


  let whereClauses = [];

  if (!is_admin_request) {
    // Non-admins should only see active products by default
    whereClauses.push(`p.product_status = 'active'`);
  }

  if (searchTerm) {
    const searchTermPattern = `%${searchTerm}%`;
    queryValues.push(searchTermPattern);
    // Search in product name, desc, sku, AND variant skus if product has_variants.
    // This requires a more complex sub-condition for variants.
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
    queryValues.push(categoryId);
    paramIndex++;
  }
  if (minPrice !== undefined) {
    whereClauses.push(`p.price >= $${paramIndex}`); // Assumes p.price is base price. Variant pricing is complex.
    queryValues.push(minPrice);
    paramIndex++;
  }
  if (maxPrice !== undefined) {
    whereClauses.push(`p.price <= $${paramIndex}`);
    queryValues.push(maxPrice);
    paramIndex++;
  }
  if (optionValueId) {
    whereClauses.push(`pvov_filter.product_option_value_id = $${paramIndex}`);
    queryValues.push(optionValueId);
    paramIndex++;
     // Add to countBaseQuery's WHERE clause too
    if (!countBaseQuery.includes('WHERE')) countBaseQuery += ' WHERE '; else countBaseQuery += ' AND ';
    countBaseQuery += `pvov_filter_count.product_option_value_id = $${paramIndex}`; // Use the same paramIndex, queryValues are copied later
  }

  if (status && status !== 'all') {
    whereClauses.push(`p.product_status = $${paramIndex}`);
    queryValues.push(status);
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


  if (whereClauses.length > 0) {
    const whereString = " WHERE " + whereClauses.join(" AND ");
    baseSelect += whereString;
    // Apply to countBaseQuery, carefully, as it might already have a WHERE from optionValueId
    if (countBaseQuery.includes('WHERE')) {
        countBaseQuery += " AND " + whereClauses.filter(c => !c.startsWith('pvov_filter.')).join(" AND "); // Avoid duplicating optionValueId filter
    } else {
        countBaseQuery += whereString;
    }
  }

  // Group by for main query if not using DISTINCT ON or if other aggregations are added
  // For DISTINCT ON (p.id) to work, p.id must be the first item in ORDER BY
  // If using array_agg, GROUP BY is necessary.
  const groupByColumns = `${productColumns}, c.name, s.name, pes.effective_stock_quantity, pes.is_low_stock`;
  baseSelect += ` GROUP BY ${groupByColumns} `;
  if (include_total_stock) { // Already covered by pes.effective_stock_quantity
      // baseSelect += `, total_stock_display`; // No, total_stock_display is from pes
  }


  let orderByClause = "";
  const sortOrderSql = (sort_order && sort_order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

  const allowedSorts = {
    'price': `p.price ${sortOrderSql} NULLS LAST`,
    'name': `p.name ${sortOrderSql}`,
    'created_at': `p.created_at ${sortOrderSql}`,
    'stock': `pes.effective_stock_quantity ${sortOrderSql} NULLS LAST`, // Sort by effective stock
    // Add more as needed, e.g., 'status', 'sku'
    'product_status': `p.product_status ${sortOrderSql}`,
    'sku': `p.sku ${sortOrderSql}`
  };

  if (optionValueId) { // When DISTINCT ON (p.id) is used for optionValueId filter
    orderByClause = ` ORDER BY p.id ${sortOrderSql} `; // p.id must be first
    if (sortBy && allowedSorts[sortBy]) {
        orderByClause += `, ${allowedSorts[sortBy]}`;
    } else { // Default secondary sort if sortBy is not valid or not 'p.id'
        orderByClause += `, p.created_at ${sortOrderSql}`;
    }
  } else if (sortBy && allowedSorts[sortBy]) {
    orderByClause = ` ORDER BY ${allowedSorts[sortBy]} `;
  } else {
    orderByClause = ` ORDER BY p.created_at ${sortOrderSql} `; // Default sort
  }
  baseSelect += orderByClause;


  const numPage = Number(page) || 1;
  const numLimit = Number(limit) || 10;
  const offset = (numPage - 1) * numLimit;

  baseSelect += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1} `;

  // Create a separate copy of queryValues for count to avoid mutation issues with limit/offset
  const countQueryValues = [...queryValues];
  const finalQueryValuesForSelect = [...queryValues, numLimit, offset];

  // console.log('Executing product list query:', baseSelect);
  // console.log('With params:', finalQueryValuesForSelect);
  // console.log('Executing count query:', countBaseQuery);
  // console.log('With params:', countQueryValues);

  const productsResult = await db.query(baseSelect, finalQueryValuesForSelect);
  const countResult = await db.query(countBaseQuery, countQueryValues);

  const totalProducts = parseInt(countResult.rows[0].total_count);

  // The `products` field name is what the admin route expects in its response object's `data` field.
  // The pagination field names also match what the admin route expects.
  return {
    products: productsResult.rows,
    totalProducts: totalProducts, // For admin route to construct its pagination.currentPage, etc.
    page: numPage,
    limit: numLimit,
    totalPages: Math.ceil(totalProducts / numLimit)
    // Old structure for reference (frontend/routes/products.js may use this):
    // pagination: {
    //   total_products: totalProducts,
    //   current_page: numPage,
    //   limit: numLimit,
    //   total_pages: Math.ceil(totalProducts / numLimit)
    // }
  };
}

async function getProductById(productId) {
  // productId is assumed to be validated as an integer by the caller (route handler)
  const client = await db.pool.connect();
  try {
    // Temporarily simplified query for diagnostics
    const productQuery = `SELECT * FROM products p WHERE p.id = $1;`;
    const productResult = await client.query(productQuery, [productId]);

    if (productResult.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const product = productResult.rows[0];

    // Fetch product gallery images
    const imagesQuery = `
      SELECT id, image_url, alt_text, display_order
      FROM product_images
      WHERE product_id = $1
      ORDER BY display_order ASC, id ASC;
    `;
    const imagesResult = await client.query(imagesQuery, [productId]);
    product.images = imagesResult.rows; // Assign the array of images

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
              json_agg(DISTINCT jsonb_build_object('value_id', pov.id, 'value_name', pov.value, 'assigned_option_value_table_id', paov.id))
              FILTER (WHERE pov.id IS NOT NULL),
              '[]'::json
            ) as "values"
        FROM product_assigned_options pao
        JOIN product_options po ON pao.option_id = po.id
        JOIN product_assigned_option_values paov ON pao.id = paov.product_assigned_option_id
        JOIN product_option_values pov ON paov.option_value_id = pov.id
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

module.exports = {
  getAllProducts,
  getProductById,
  calculateProfitMargin
};
