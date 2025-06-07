const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// GET /api/admin/reports/low-stock-products - Fetch products that are at or below their reorder threshold
router.get('/low-stock-products', async (req, res) => {
  try {
    const query = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.stock_quantity,
        p.reorder_threshold,
        p.updated_at, -- Last time product (potentially stock) was updated
        s.name AS supplier_name,
        (p.stock_quantity - p.reorder_threshold) AS stock_difference -- For sorting by urgency
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE
        p.reorder_threshold IS NOT NULL AND -- Only include products with a defined threshold
        p.reorder_threshold > 0 AND         -- Only if threshold is actively set above zero
        p.stock_quantity <= p.reorder_threshold
      ORDER BY
        stock_difference ASC, -- Most urgent (further below threshold) first
        p.name ASC;
    `;
    // Note: Pagination could be added here if the list of low-stock products is expected to be very long.
    // For now, returning all matching products.

    const result = await db.query(query);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching low stock products report:', error);
    res.status(500).json({ message: 'Failed to retrieve low stock products report.' });
  }
});

module.exports = router;
