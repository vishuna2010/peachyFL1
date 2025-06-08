const db = require('../db');
const { BadRequestError, NotFoundError } = require('../utils/AppError');

// Helper function moved from routes/products.js
async function getVariantSelectedOptions(variantId, client) {
  const query = `
      SELECT pov.id as option_value_id, pov.value as value_name,
             po.id as option_id, po.name as option_name
      FROM product_variant_option_values pvov
      JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
      JOIN product_options po ON pov.product_option_id = po.id
      WHERE pvov.product_variant_id = $1
      ORDER BY po.name, pov.value;
  `;
  const result = await client.query(query, [variantId]);
  return result.rows;
}

async function getAllProducts({
  searchTerm,
  categoryId,
  minPrice,
  maxPrice,
  sortBy,
  page = 1,
  limit = 10
}) {
  const queryValues = [];
  let paramIndex = 1;

  let baseSelect = `
    SELECT p.id, p.name, p.description, p.price, p.category_id, p.image_url,
           p.stock_quantity, p.sku, p.supplier_id, p.reorder_threshold, p.created_at, p.updated_at,
           c.name as category_name,
           s.name as supplier_name,
           COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags,
           EXISTS(SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id) AS has_variants
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;
  let countBaseQuery = `SELECT COUNT(DISTINCT p.id) as total_count FROM products p `;

  let whereClauses = [];
  if (searchTerm) {
    whereClauses.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
    queryValues.push(`%${searchTerm}%`);
    paramIndex++;
  }
  if (categoryId) {
    whereClauses.push(`p.category_id = $${paramIndex}`);
    queryValues.push(categoryId);
    paramIndex++;
    if (!countBaseQuery.includes('LEFT JOIN categories')) {
        countBaseQuery += `LEFT JOIN categories c ON p.category_id = c.id `;
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

  if (whereClauses.length > 0) {
    const whereString = " WHERE " + whereClauses.join(" AND ");
    baseSelect += whereString;
    countBaseQuery += whereString;
  }

  baseSelect += " GROUP BY p.id, c.name, s.name ";

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
    `;
    const productResult = await client.query(productQuery, [productId]);
    if (productResult.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const product = productResult.rows[0];

    const optionsQuery = `
      SELECT po.id, po.name,
             COALESCE(json_agg(json_build_object('id', pov.id, 'value', pov.value) ORDER BY pov.value) FILTER (WHERE pov.id IS NOT NULL), '[]'::json) AS "values"
      FROM product_options po
      LEFT JOIN product_option_values pov ON po.id = pov.product_option_id
      WHERE po.product_id = $1
      GROUP BY po.id, po.name ORDER BY po.name ASC;
    `;
    const optionsResult = await client.query(optionsQuery, [productId]);
    product.options = optionsResult.rows;

    const variantsQuery = `
      SELECT id, sku, price_modifier, stock_quantity, image_url
      FROM product_variants WHERE product_id = $1 ORDER BY id ASC;
    `;
    const variantsResult = await client.query(variantsQuery, [productId]);
    product.variants = variantsResult.rows;

    for (const variant of product.variants) {
      variant.selected_options = await getVariantSelectedOptions(variant.id, client);
      variant.final_price = (parseFloat(product.price) + parseFloat(variant.price_modifier)).toFixed(2);
    }

    return product;
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  getAllProducts,
  getProductById
};
