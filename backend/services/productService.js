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
  optionValueId, // New filter parameter
  page = 1,
  limit = 10
}) {
  const queryValues = [];
  let paramIndex = 1;

  // Base columns to select from products p.
  // average_rating and review_count are now part of products table.
  const productColumns = `p.id, p.name, p.description, p.price, p.category_id, p.image_url,
                          p.stock_quantity, p.sku, p.supplier_id, p.reorder_threshold,
                          p.has_variants, p.average_rating, p.review_count,
                          p.created_at, p.updated_at`;

  // Conditionally join product_variants if needed for searchTerm or optionValueId
  let needsVariantJoin = !!optionValueId;
  if (searchTerm) {
      needsVariantJoin = true;
  }

  let fromClause = `
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

  let selectPrefix = `SELECT ${productColumns},
                             c.name as category_name, s.name as supplier_name,
                             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags`;

  // If filtering by optionValueId, we need to ensure products are distinct and join with variant tables.
  if (optionValueId) {
    selectPrefix = `SELECT DISTINCT ${productColumns},
                                  c.name as category_name, s.name as supplier_name,
                                  COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags`;
    fromClause += `
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN product_variant_option_values pvov ON pv.id = pvov.product_variant_id
    `;
  } else if (needsVariantJoin && !fromClause.includes('product_variants pv')) {
    // Join for searchTerm if not already joined by optionValueId
    fromClause += ` LEFT JOIN product_variants pv ON p.id = pv.product_id `;
  }


  let baseSelect = selectPrefix + fromClause;

  let countBaseQuery = `SELECT COUNT(DISTINCT p.id) as total_count FROM products p `;
  if (needsVariantJoin && !countBaseQuery.includes('product_variants pv')) {
      countBaseQuery += ` LEFT JOIN product_variants pv ON p.id = pv.product_id `;
  }
  if (optionValueId && !countBaseQuery.includes('product_variant_option_values pvov')) {
      // This join implies pv is already joined or should be.
      if (!countBaseQuery.includes('product_variants pv')) { // Ensure pv is joined for pvov
         countBaseQuery += ` LEFT JOIN product_variants pv ON p.id = pv.product_id `;
      }
      countBaseQuery += ` LEFT JOIN product_variant_option_values pvov ON pv.id = pvov.product_variant_id `;
  }


  let whereClauses = [];
  if (searchTerm) {
    const searchTermPattern = `%${searchTerm}%`;
    queryValues.push(searchTermPattern); // Add value for $paramIndex
    let searchOrClauses = [
        `p.name ILIKE $${paramIndex}`,
        `p.description ILIKE $${paramIndex}`,
        `p.sku ILIKE $${paramIndex}`
    ];
    if (needsVariantJoin) {
        searchOrClauses.push(`pv.sku ILIKE $${paramIndex}`);
    }
    whereClauses.push(`(${searchOrClauses.join(" OR ")})`);
    paramIndex++; // Increment for the next filter
  }

  if (categoryId) {
    whereClauses.push(`p.category_id = $${paramIndex}`);
    queryValues.push(categoryId);
    paramIndex++;
    // Ensure category join is in countBaseQuery if categoryId is used (already part of fromClause for baseSelect)
    if (!countBaseQuery.includes('LEFT JOIN categories c ON p.category_id = c.id') && optionValueId) { // If optionValueId already added its joins
        // This logic might be tricky if category join isn't always part of optionValueId path
    } else if (!countBaseQuery.includes('LEFT JOIN categories c ON p.category_id = c.id')) {
        // Add if not present from optionValueId path
        countBaseQuery += ` LEFT JOIN categories c ON p.category_id = c.id `;
    }
  }
  if (minPrice !== undefined) {
    whereClauses.push(`p.price >= $${paramIndex}`);
    queryValues.push(minPrice);
    paramIndex++;
  }
  if (maxPrice !== undefined) {
    whereClauses.push(`p.price <= $${paramIndex}`);
    queryValues.push(maxPrice);
    paramIndex++;
  }
  if (optionValueId) {
    whereClauses.push(`pvov.product_option_value_id = $${paramIndex}`);
    queryValues.push(optionValueId);
    paramIndex++;
  }

  if (whereClauses.length > 0) {
    const whereString = " WHERE " + whereClauses.join(" AND ");
    baseSelect += whereString;
    countBaseQuery += whereString; // Apply same filters to count
  }

  // Group by all selected non-aggregated columns from products, categories, and suppliers
  // This is necessary because of the array_agg for tags and potential DISTINCT on product columns.
  // If using SELECT DISTINCT p.id, p.name ..., then GROUP BY those same columns.
  // The productColumns string already lists all p.* columns.
  // c.name and s.name are from LEFT JOINs and also selected.
  baseSelect += ` GROUP BY ${productColumns}, c.name, s.name `;


  let orderByClause = " ORDER BY p.created_at DESC ";
  const allowedSorts = {
    'price_asc': 'p.price ASC NULLS LAST', 'price_desc': 'p.price DESC NULLS LAST',
    'name_asc': 'p.name ASC', 'name_desc': 'p.name DESC',
    'created_at_desc': 'p.created_at DESC', 'created_at_asc': 'p.created_at ASC'
  };

  if (sortBy && allowedSorts[sortBy]) {
    orderByClause = ` ORDER BY ${allowedSorts[sortBy]} `;
  } else if (sortBy && !allowedSorts[sortBy]) {
    throw new BadRequestError("Invalid sort_by parameter.");
  }
  baseSelect += orderByClause;

  const numPage = page;
  const numLimit = limit;
  const offset = (numPage - 1) * numLimit;

  baseSelect += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1} `;
  const countQueryValues = [...queryValues];
  const finalQueryValuesForSelect = [...queryValues, numLimit, offset];

  const productsResult = await db.query(baseSelect, finalQueryValuesForSelect);
  const countResult = await db.query(countBaseQuery, countQueryValues);

  const totalProducts = parseInt(countResult.rows[0].total_count);

  return {
    products: productsResult.rows,
    pagination: {
      total_products: totalProducts,
      current_page: numPage,
      limit: numLimit,
      total_pages: Math.ceil(totalProducts / numLimit)
    }
  };
}

async function getProductById(productId) {
  // productId is assumed to be validated as an integer by the caller (route handler)
  const client = await db.pool.connect();
  try {
    const productQuery = `
      SELECT p.*,
             c.name as category_name,
             s.name as supplier_name,
             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN product_tags pt ON p.id = pt.product_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, c.name, s.name;
    `; // p.has_variants is selected via p.*
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
