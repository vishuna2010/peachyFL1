const express = require('express');
const router = express.Router();
const db = require('../db');
const { AppError } = require('../utils/AppError');

// GET /api/options/public-filters - Fetch options and values for public product filtering
router.get('/public-filters', async (req, res, next) => {
  try {
    const query = `
      SELECT
          po.id AS option_id,
          po.name AS option_name,
          json_agg(DISTINCT jsonb_build_object('value_id', pov.id, 'value_name', pov.value)) AS "values"
      FROM
          product_options po
      JOIN
          product_option_values pov ON po.id = pov.product_option_id
      JOIN
          product_variant_option_values pvov ON pov.id = pvov.product_option_value_id
      JOIN
          product_variants pv ON pvov.product_variant_id = pv.id
      JOIN
          products p ON pv.product_id = p.id
      WHERE
          p.product_status = 'active' AND p.has_variants = TRUE
      GROUP BY
          po.id, po.name
      ORDER BY
          po.name;
    `;

    const { rows } = await db.query(query);
    res.json(rows);

  } catch (error) {
    console.error('Error fetching public filter options:', error);
    next(new AppError('Failed to fetch filter options.', 500));
  }
});

module.exports = router;
