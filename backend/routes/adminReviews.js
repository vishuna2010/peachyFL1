const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth'); // Updated import
const { query, param, body, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError } = require('../utils/AppError');

// Apply admin protection to all routes
// router.use(isAuthenticated, isAdmin); // REMOVED

// Helper function to update product's average rating and review count
async function updateProductAverageRating(productId, client) {
  const BARE_QUERY = client ? client : db; // Use provided client if in transaction, else pool
  try {
    const ratingStats = await BARE_QUERY.query(
      `SELECT COALESCE(AVG(rating), 0) as average_rating, COUNT(id) as review_count
       FROM product_reviews
       WHERE product_id = $1 AND status = 'approved'`,
      [productId]
    );

    const { average_rating, review_count } = ratingStats.rows[0];

    await BARE_QUERY.query(
      `UPDATE products
       SET average_rating = $1, review_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [parseFloat(average_rating).toFixed(2), parseInt(review_count, 10), productId]
    );
    console.log(`Updated average rating for product ${productId}: ${average_rating}, count: ${review_count}`);
  } catch (error) {
    console.error(`Failed to update average rating for product ${productId}:`, error);
    // Decide if this error should be propagated or just logged
    // If propagated, the calling transaction should roll back.
    throw error;
  }
}

// Endpoint 1: GET /api/admin/reviews (List All Reviews for Admin)
router.get(
  '/',
  isAuthenticated,
  checkPermission('reviews:manage'),
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('status').optional().isString().isIn(['pending', 'approved', 'rejected']),
    query('productId').optional().isInt({ gt: 0 }).toInt(),
    query('userId').optional().isInt({ gt: 0 }).toInt(),
    query('sort').optional().isString().isIn([
      'created_at_desc', 'created_at_asc',
      'rating_desc', 'rating_asc',
      'status_asc', 'status_desc' // Added status sort
    ]).withMessage('Invalid sort parameter.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page, limit, status, productId, userId, sort } = req.query;
    const offset = (page - 1) * limit;

    let whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereClauses.push(`r.status = $${paramIndex++}`);
      queryParams.push(status);
    }
    if (productId) {
      whereClauses.push(`r.product_id = $${paramIndex++}`);
      queryParams.push(productId);
    }
    if (userId) {
      whereClauses.push(`r.user_id = $${paramIndex++}`);
      queryParams.push(userId);
    }

    const whereCondition = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderByClause = 'ORDER BY r.created_at DESC';
    if (sort) {
        const sortMap = {
            'created_at_desc': 'r.created_at DESC',
            'created_at_asc': 'r.created_at ASC',
            'rating_desc': 'r.rating DESC, r.created_at DESC',
            'rating_asc': 'r.rating ASC, r.created_at ASC',
            'status_asc': 'r.status ASC, r.created_at DESC',
            'status_desc': 'r.status DESC, r.created_at DESC',
        };
        if (sortMap[sort]) {
            orderByClause = `ORDER BY ${sortMap[sort]}`;
        }
    }

    try {
      const reviewsQuery = `
        SELECT r.id, r.rating, r.title, r.comment, r.status, r.created_at, r.updated_at,
               p.id as product_id, p.name as product_name,
               u.id as user_id, u.name as user_name, u.email as user_email
        FROM product_reviews r
        JOIN products p ON r.product_id = p.id
        JOIN users u ON r.user_id = u.id
        ${whereCondition}
        ${orderByClause}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
      const finalQueryParams = [...queryParams, limit, offset];
      const reviewsResult = await db.query(reviewsQuery, finalQueryParams);

      const totalCountQuery = `SELECT COUNT(*) FROM product_reviews r ${whereCondition};`;
      const totalCountResult = await db.query(totalCountQuery, queryParams); // Use only filter params for count

      const totalItems = parseInt(totalCountResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalItems / limit);

      res.json({
        data: reviewsResult.rows, // Changed 'reviews' to 'data'
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          pageSize: limit // Retaining pageSize as it was, frontend might use 'limit' or 'pageSize'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Endpoint 2: GET /api/admin/reviews/:reviewId (Get Single Review)
router.get(
  '/:reviewId',
  isAuthenticated,
  checkPermission('reviews:manage'),
  [param('reviewId').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.').toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reviewId } = req.params;
    try {
      const result = await db.query(
        `SELECT r.*, p.name as product_name, u.name as user_name, u.email as user_email
         FROM product_reviews r
         JOIN products p ON r.product_id = p.id
         JOIN users u ON r.user_id = u.id
         WHERE r.id = $1`,
        [reviewId]
      );
      if (result.rows.length === 0) {
        return next(new NotFoundError(`Review with ID ${reviewId} not found.`));
      }
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Endpoint 3: PUT /api/admin/reviews/:reviewId/status (Update Review Status)
router.put(
  '/:reviewId/status',
  isAuthenticated,
  checkPermission('reviews:manage'),
  [
    param('reviewId').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.').toInt(),
    body('status').isString().isIn(['approved', 'rejected', 'pending']).withMessage("Status must be one of: 'pending', 'approved', 'rejected'.")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reviewId } = req.params;
    const { status } = req.body;
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      const reviewCheck = await client.query('SELECT product_id, status as old_status FROM product_reviews WHERE id = $1 FOR UPDATE', [reviewId]);
      if (reviewCheck.rows.length === 0) {
        throw new NotFoundError(`Review with ID ${reviewId} not found.`);
      }
      const { product_id, old_status } = reviewCheck.rows[0];

      if (old_status === status) { // No change in status
        // Still return the review, but no actual update or rating recalc needed
        const currentReview = await client.query('SELECT * FROM product_reviews WHERE id = $1', [reviewId]);
        await client.query('COMMIT');
        return res.json(currentReview.rows[0]);
      }

      const result = await client.query(
        'UPDATE product_reviews SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, reviewId]
      );

      // Update product average rating if status changed to/from 'approved'
      if (old_status === 'approved' || status === 'approved') {
        await updateProductAverageRating(product_id, client);
      }

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

// Endpoint 4: DELETE /api/admin/reviews/:reviewId (Delete a Review)
router.delete(
  '/:reviewId',
  isAuthenticated,
  checkPermission('reviews:manage'),
  [param('reviewId').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.').toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reviewId } = req.params;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const reviewDataResult = await client.query('SELECT product_id, status FROM product_reviews WHERE id = $1 FOR UPDATE', [reviewId]);
      if (reviewDataResult.rows.length === 0) {
        throw new NotFoundError(`Review with ID ${reviewId} not found.`);
      }
      const { product_id, status: reviewStatus } = reviewDataResult.rows[0];

      const deleteResult = await client.query('DELETE FROM product_reviews WHERE id = $1', [reviewId]);
      // No RETURNING needed, rowCount check is handled by NotFoundError above if select fails.
      // If deleteResult.rowCount were 0 after a successful select, it would be an anomaly.

      // If the deleted review was approved, update product average rating
      if (reviewStatus === 'approved') {
        await updateProductAverageRating(product_id, client);
      }

      await client.query('COMMIT');
      res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
