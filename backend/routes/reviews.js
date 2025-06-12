const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../auth'); // Assuming auth.js exports this
const { body, param, query, validationResult } = require('express-validator');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/AppError'); // Assuming these custom errors exist

// POST /api/products/:productId/reviews - Submit a review for a product
router.post(
  '/products/:productId/reviews',
  isAuthenticated, // User must be logged in to post a review
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5.').toInt(),
    body('title').optional({ checkFalsy: true }).isString().trim().escape()
      .isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters.')
      .custom((value, { req }) => { // Ensure if title is provided, it's not empty after trim
          if (req.body.title !== undefined && value === '') { // title was provided but became empty after trim
              throw new Error('Title, if provided, cannot be empty.');
          }
          return true;
      }),
    body('comment').optional({ checkFalsy: true }).isString().trim().escape()
      .custom((value, { req }) => { // Ensure if comment is provided, it's not empty after trim
          if (req.body.comment !== undefined && value === '') {
              throw new Error('Comment, if provided, cannot be empty.');
          }
          return true;
      })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Map validation errors to a more structured format if desired, or just send array
      const simplifiedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
      return res.status(400).json({ errors: simplifiedErrors });
    }

    const { productId } = req.params;
    const userId = req.user.userId; // Assuming isAuthenticated adds user info to req.user
    const { rating, title, comment } = req.body;

    try {
      // Check if product exists
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      if (productCheck.rows.length === 0) {
        return next(new NotFoundError(`Product with ID ${productId} not found.`));
      }

      // Optional: Check if user has purchased this product (deferred)

      const result = await db.query(
        `INSERT INTO product_reviews (product_id, user_id, rating, title, comment, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id, product_id, user_id, rating, title, comment, status, created_at, updated_at`,
        [productId, userId, rating, title || null, comment || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'uk_product_user_review') {
        return next(new ConflictError('You have already reviewed this product.'));
      }
      // Log the full error for server-side debugging
      console.error(`Error submitting review for product ${productId} by user ${userId}:`, error);
      // Pass to the global error handler
      next(error);
    }
  }
);

// GET /api/products/:productId/reviews - List approved reviews for a product
router.get(
  '/products/:productId/reviews',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt().default(10)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const simplifiedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
      return res.status(400).json({ errors: simplifiedErrors });
    }

    const { productId } = req.params;
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    try {
      // Optional: Check if product exists. If not, could return 404 or empty list.
      // For a list endpoint, returning empty is often acceptable.
      // const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [productId]);
      // if (productCheck.rows.length === 0) {
      //   return next(new NotFoundError(`Product with ID ${productId} not found.`));
      // }

      const reviewsQuery = `
        SELECT r.id, r.rating, r.title, r.comment, r.created_at, u.name as user_name
        FROM product_reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.product_id = $1 AND r.status = 'approved'
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3;
      `;
      const reviewsResult = await db.query(reviewsQuery, [productId, limit, offset]);

      const totalCountQuery = `
        SELECT COUNT(*)
        FROM product_reviews
        WHERE product_id = $1 AND status = 'approved';
      `;
      const totalCountResult = await db.query(totalCountQuery, [productId]);
      const totalItems = parseInt(totalCountResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalItems / limit);

      res.json({
        reviews: reviewsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          pageSize: limit
        }
      });
    } catch (error) {
      console.error(`Error fetching reviews for product ${productId}:`, error);
      next(error);
    }
  }
);

module.exports = router;
