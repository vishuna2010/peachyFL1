const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

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


module.exports = router;
