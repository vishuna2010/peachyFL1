const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { query, validationResult } = require('express-validator');

router.use(isAuthenticated, isAdmin);

// Validation for pagination and filter parameters
const validateGetAuditLogsParams = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('userId').optional().isInt({ gt: 0 }).toInt(),
  query('userEmail').optional().isEmail().normalizeEmail(),
  query('actionType').optional().isString().trim().escape(),
  query('resourceType').optional().isString().trim().escape(),
  query('resourceId').optional().isInt({ gt: 0 }).toInt(), // Assuming resourceId is integer
  query('dateFrom').optional().isISO8601().toDate(),
  query('dateTo').optional().isISO8601().toDate(),
  query('sortBy').optional().isIn(['timestamp', 'action_type', 'user_email', 'resource_type']).default('timestamp'),
  query('sortOrder').optional().isIn(['ASC', 'DESC']).toUpperCase().default('DESC')
];

// GET / - Fetch audit logs with filtering and pagination
router.get('/', validateGetAuditLogsParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    page, limit, userId, userEmail, actionType,
    resourceType, resourceId, dateFrom, dateTo,
    sortBy, sortOrder
  } = req.query;

  const offset = (page - 1) * limit;

  let queryParams = [];
  let whereClauses = [];
  let paramIndex = 1;

  if (userId) {
    whereClauses.push(`user_id = $${paramIndex++}`);
    queryParams.push(userId);
  }
  if (userEmail) {
    whereClauses.push(`user_email ILIKE $${paramIndex++}`);
    queryParams.push(`%${userEmail}%`);
  }
  if (actionType) {
    whereClauses.push(`action_type = $${paramIndex++}`);
    queryParams.push(actionType);
  }
  if (resourceType) {
    whereClauses.push(`resource_type = $${paramIndex++}`);
    queryParams.push(resourceType);
  }
  if (resourceId) {
    whereClauses.push(`resource_id = $${paramIndex++}`);
    queryParams.push(resourceId);
  }
  if (dateFrom) {
    whereClauses.push(`timestamp >= $${paramIndex++}`);
    queryParams.push(dateFrom);
  }
  if (dateTo) {
    // Adjust dateTo to include the whole day
    const adjustedDateTo = new Date(dateTo);
    adjustedDateTo.setDate(adjustedDateTo.getDate() + 1);
    whereClauses.push(`timestamp < $${paramIndex++}`);
    queryParams.push(adjustedDateTo);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Validate sortBy to prevent SQL injection (already done by isIn validator)
  const validSortColumns = {
      'timestamp': 'timestamp',
      'action_type': 'action_type',
      'user_email': 'user_email',
      'resource_type': 'resource_type'
  };
  const safeSortBy = validSortColumns[sortBy] || 'timestamp'; // Default to timestamp
  const safeSortOrder = (sortOrder === 'ASC') ? 'ASC' : 'DESC'; // Default to DESC

  try {
    const dataQueryString = `
      SELECT id, user_id, user_email, action_type, resource_type, resource_id, details, ip_address, user_agent, timestamp
      FROM audit_logs
      ${whereString}
      ORDER BY ${safeSortBy} ${safeSortOrder}, id ${safeSortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const countQueryString = `SELECT COUNT(*) FROM audit_logs ${whereString};`;

    // Params for data query need limit and offset added
    const dataQueryParams = [...queryParams, limit, offset];
    // Params for count query are just the filter params
    const countQueryParams = [...queryParams];

    const dataResult = await db.query(dataQueryString, dataQueryParams);
    const countResult = await db.query(countQueryString, countQueryParams);

    const totalItems = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      data: dataResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    next(error);
  }
});

module.exports = router;
