const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const productService = require('../services/productService');
const { query, param, validationResult } = require('express-validator'); // Added query
const { NotFoundError } = require('../utils/AppError');


// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// PUT /api/admin/products/:id/stock - Update a product's stock quantity
router.put('/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { new_stock_quantity } = req.body;

  // Validate product ID
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID format.' });
  }

  // Validate new_stock_quantity
  if (new_stock_quantity === undefined) {
    return res.status(400).json({ message: 'new_stock_quantity is required in the request body.' });
  }
  const stockQuantity = parseInt(new_stock_quantity);
  if (isNaN(stockQuantity) || stockQuantity < 0) {
    return res.status(400).json({ message: 'new_stock_quantity must be a non-negative integer.' });
  }

  const client = await db.pool.connect();
  try {
    // We could start a transaction here if other operations were involved,
    // but for a single update, it's often optional unless strict atomicity with checks is needed.
    // For simplicity, let's proceed without an explicit transaction for this single update.
    // However, checking if product exists first is a good practice.

    // Check if product exists
    const productExistsResult = await client.query('SELECT id FROM products WHERE id = $1', [id]);
    if (productExistsResult.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${id} not found.` });
    }

    // Fetch product details to check has_variants
    const productDetailsResult = await client.query('SELECT id, has_variants FROM products WHERE id = $1', [id]);
    // This check is technically redundant due to productExistsResult, but good for clarity
    if (productDetailsResult.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${id} not found (unexpected after initial check).` });
    }
    const product = productDetailsResult.rows[0];

    if (product.has_variants) {
      return res.status(400).json({ message: `Stock for product ID ${id} is managed at the variant level. Please update variant stock instead.` });
    }

    // Update the product's stock quantity and updated_at timestamp
    // Note: The products table does not have an updated_at column currently.
    // If it's needed, it should be added to the products table schema.
    // For now, we'll just update stock_quantity.
    // If an updated_at column (e.g., named 'updated_at') existed:
    // const updateQuery = `
    //   UPDATE products
    //   SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
    //   WHERE id = $2
    //   RETURNING *;
    // `;
    const updateQuery = `
      UPDATE products
      SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id;
      -- Only need to know it succeeded, will re-fetch full details.
    `;
    const updatedProductResult = await client.query(updateQuery, [stockQuantity, id]);

    if (updatedProductResult.rowCount === 0) {
        // This case should ideally not be hit if the existence check passed and ID is valid.
        return res.status(404).json({ message: `Product with ID ${id} found but update failed to apply.`});
    }

    // Re-fetch the product with all details including supplier, category, and tags
    const finalProductQuery = `
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
    const finalProductResponse = await client.query(finalProductQuery, [id]);

    if (finalProductResponse.rows.length === 0) {
        // Should not happen if update was successful
        return res.status(404).json({ message: `Product with ID ${id} could not be re-fetched after update.`});
    }

    res.status(200).json({
      message: `Stock quantity for product #${id} updated to ${stockQuantity}.`,
      product: finalProductResponse.rows[0]
    });

  } catch (error) {
    console.error(`Error updating stock for product ID ${id}:`, error);
    res.status(500).json({ message: 'Failed to update product stock quantity.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/products/:id/label - Generate a PDF label for a product
router.get('/:id/label', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid product ID format.' });
  }

  try {
    // Fetch minimal product details needed for the label
    // Ensure SKU is fetched if it's preferred for barcode over ID.
    const productResult = await db.query(
      'SELECT id, name, sku, price FROM products WHERE id = $1',
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: `Product with ID ${id} not found.` });
    }
    const product = productResult.rows[0];

    // Generate the PDF
    const { generateProductLabelPdf } = require('../services/pdfService'); // Import here or at top
    const pdfBuffer = await generateProductLabelPdf(product);

    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    const fileNameSku = product.sku || product.id;
    res.setHeader('Content-Disposition', `inline; filename="product_label_${fileNameSku}.pdf"`);
    // Use 'attachment' instead of 'inline' to force download

    res.send(pdfBuffer);

  } catch (error) {
    console.error(`Error generating label for product ID ${id}:`, error);
    if (!res.headersSent) { // Avoid setting headers if already sent (e.g. by an earlier error)
        res.status(500).json({ message: 'Failed to generate product label PDF.' });
    } else {
        // If headers already sent, express will handle closing connection on error
        console.error("Headers already sent, could not send JSON error response for PDF generation.");
    }
  }
});

// GET /api/admin/products/:productId/label-data - Get structured data for product labels
router.get(
  '/:productId/label-data',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const PRODUCT_PAGE_BASE_URL = process.env.FRONTEND_URL || 'https://yourstore.com';

    try {
      const product = await productService.getProductById(parseInt(productId));
      // productService.getProductById should throw NotFoundError if product doesn't exist.

      // For now, assume a base store currency. This can be enhanced later.
      const STORE_CURRENCY_CODE = 'USD'; // Example, ideally from config
      const STORE_CURRENCY_SYMBOL = '$';   // Example, ideally from config or currency data

      const labelsData = [];

      if (product.has_variants && product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          let suffixParts = [];
          if (product.available_options && variant.option_value_ids) {
            for (const valId of variant.option_value_ids) {
              for (const opt of product.available_options) {
                const foundValue = opt.values.find(v => v.value_id === valId);
                if (foundValue) {
                  suffixParts.push(`${opt.option_name}: ${foundValue.value_name}`);
                  break;
                }
              }
            }
          }
          const constructed_suffix = suffixParts.length > 0 ? ` - ${suffixParts.join(', ')}` : '';

          labelsData.push({
            product_id: product.id,
            variant_id: variant.id,
            product_name: product.name,
            variant_name_suffix: constructed_suffix,
            full_display_name: `${product.name}${constructed_suffix}`,
            sku: variant.sku || product.sku, // Prioritize variant SKU
            // A more robust barcode might include product ID and variant ID if SKU is not guaranteed unique across all
            barcode_value: variant.sku || product.sku || `${product.id}${variant.id ? '-' + variant.id : ''}`,
            selling_price: parseFloat(variant.final_price).toFixed(2), // final_price is already calculated in getProductById
            currency_code: STORE_CURRENCY_CODE, // Assuming product/variant prices are in store's base currency
            currency_symbol: STORE_CURRENCY_SYMBOL,
            qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}?variantId=${variant.id}`
          });
        }
      } else {
        labelsData.push({
          product_id: product.id,
          variant_id: null,
          product_name: product.name,
          variant_name_suffix: null,
          full_display_name: product.name,
          sku: product.sku,
          barcode_value: product.sku || product.id.toString(),
          selling_price: parseFloat(product.price).toFixed(2),
          currency_code: STORE_CURRENCY_CODE,
            currency_symbol: STORE_CURRENCY_SYMBOL,
            qr_code_data_product_url: `${PRODUCT_PAGE_BASE_URL}/products/${product.id}`
        });
      }
      res.status(200).json(labelsData);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      // Pass other errors to global error handler
      next(error);
    }
  }
);

// GET /api/admin/products/:productId/cost-history - Get cost history for a product (and optionally variant)
router.get(
  '/:productId/cost-history',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    query('variant_id').optional().isInt({ gt: 0 }).toInt().withMessage('Variant ID must be a positive integer if provided.'),
    query('supplier_id').optional().isInt({ gt: 0 }).toInt().withMessage('Supplier ID must be a positive integer if provided.'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params; // Now an integer
    const { variant_id, supplier_id, page, limit } = req.query; // variant_id, supplier_id, page, limit are integers or undefined
    const offset = (page - 1) * limit;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        throw new NotFoundError(`Product with ID ${productId} not found.`);
      }

      const queryParams = [];
      let whereClauses = ['pch.product_id = $1'];
      queryParams.push(productId);
      let currentParamIndex = 1; // For $1, $2 etc.

      if (variant_id) {
        currentParamIndex++;
        queryParams.push(variant_id);
        whereClauses.push(`pch.variant_id = $${currentParamIndex}`);
      }
      if (supplier_id) {
        currentParamIndex++;
        queryParams.push(supplier_id);
        whereClauses.push(`pch.supplier_id = $${currentParamIndex}`);
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
        LIMIT $${currentParamIndex + 1} OFFSET $${currentParamIndex + 2};
      `;
      const dataParams = [...queryParams, limit, offset];

      const countQuery = `SELECT COUNT(*) FROM product_cost_history pch WHERE ${whereString};`;

      const dataResult = await db.query(dataQuery, dataParams);
      const countResult = await db.query(countQuery, queryParams); // Count query uses only filter params

      const totalRecords = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalRecords / limit);

      res.status(200).json({
        data: dataResult.rows,
        pagination: {
          total: totalRecords,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
);

module.exports = router;
