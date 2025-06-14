const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { query, validationResult } = require('express-validator');

router.use(isAuthenticated, isAdmin);

const validateGetLogsParams = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'),
  query('product_id').optional().isInt({ min: 1 }).toInt().withMessage('Product ID must be a positive integer.'),
  query('variant_id').optional().isInt({ min: 1 }).toInt().withMessage('Variant ID must be a positive integer.'),
  query('movement_type').optional().isString().trim().escape(),
  query('start_date').optional().isISO8601().toDate(),
  query('end_date').optional().isISO8601().toDate()
    .custom((value, { req }) => {
      if (req.query.start_date && value < req.query.start_date) {
        throw new Error('End date cannot be before start date.');
      }
      return true;
    }),
  query('sort_by').optional().isIn(['timestamp', 'product_id', 'movement_type']).withMessage("Invalid sort_by value. Allowed: 'timestamp', 'product_id', 'movement_type'."),
  query('sort_order').optional().isIn(['ASC', 'DESC']).withMessage("Invalid sort_order value. Allowed: 'ASC', 'DESC'.")
];

router.get('/', validateGetLogsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    page = 1,
    limit = 20,
    product_id,
    variant_id,
    movement_type,
    start_date,
    end_date,
    sort_by = 'timestamp',
    sort_order = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const queryParams = [];
  let paramIndex = 1;

  let baseQuery = `
    FROM stock_movement_logs sml
    LEFT JOIN products p ON sml.product_id = p.id
    LEFT JOIN product_variants pv ON sml.variant_id = pv.id
    LEFT JOIN users u ON sml.user_id = u.id
  `;
  let conditions = [];

  if (product_id) {
     conditions.push(`sml.product_id = $${paramIndex++}`);
    queryParams.push(product_id);
  }
  if (variant_id) {
     conditions.push(`sml.variant_id = $${paramIndex++}`);
    queryParams.push(variant_id);
  }
  if (movement_type) {
     conditions.push(`sml.movement_type ILIKE $${paramIndex++}`);
     queryParams.push(`%${movement_type}%`);
  }
  if (start_date) {
     conditions.push(`sml.timestamp >= $${paramIndex++}`);
    queryParams.push(start_date);
  }
  if (end_date) {
    const adjustedEndDate = new Date(end_date);
    adjustedEndDate.setHours(23, 59, 59, 999); // Include whole day
     conditions.push(`sml.timestamp <= $${paramIndex++}`);
    queryParams.push(adjustedEndDate);
  }

  if (conditions.length > 0) {
    baseQuery += ' WHERE ' + conditions.join(' AND ');
  }

  const countQuery = 'SELECT COUNT(sml.id) as total_count ' + baseQuery;
   const dataQuery = `
    SELECT
      sml.*,
      p.name as product_name,
      p.sku as product_sku,
      pv.sku as variant_sku,
      u.email as user_email
    \` + baseQuery + \` ORDER BY sml.${sort_by} ${sort_order}, sml.id ${sort_order} LIMIT $${paramIndex++} OFFSET $${paramIndex++}\`;

  const countQueryParams = [...queryParams];
  const dataQueryParams = [...queryParams, limit, offset];

  try {
    const countResult = await db.query(countQuery, countQueryParams);
    const totalLogs = parseInt(countResult.rows[0].total_count);

    const logsResult = await db.query(dataQuery, dataQueryParams);

    res.status(200).json({
      data: logsResult.rows,
      pagination: {
        total: totalLogs,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalLogs / limit),
        hasNextPage: page < Math.ceil(totalLogs / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching stock movement logs:', error);
    next(error); // Pass to global error handler
  }
});

module.exports = router;
