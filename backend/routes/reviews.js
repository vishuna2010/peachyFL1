const express = require('express');
const router = express.Router();
const reviewService = require('../services/reviewService'); // Import reviewService
const { isAuthenticated } = require('../auth');
const { body, param, query, validationResult } = require('express-validator');
// Removed db import and specific error types as service handles them

// POST /api/products/:productId/reviews - Submit a review for a product
router.post(
  '/products/:productId/reviews',
  isAuthenticated,
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5.').toInt(),
    body('title').optional({ checkFalsy: true }).isString().trim().escape()
      .isLength({ max: 255 }).withMessage('Title cannot exceed 255 characters.')
      .custom((value, { req }) => {
          if (req.body.title !== undefined && value === '') {
              throw new Error('Title, if provided, cannot be empty.');
          }
          return true;
      }),
    body('comment').optional({ checkFalsy: true }).isString().trim().escape()
      .custom((value, { req }) => {
          if (req.body.comment !== undefined && value === '') {
              throw new Error('Comment, if provided, cannot be empty.');
          }
          return true;
      })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const simplifiedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
      return res.status(400).json({ errors: simplifiedErrors });
    }

    const { productId } = req.params;
    const userId = req.user.userId;
    const reviewData = { rating: req.body.rating, title: req.body.title, comment: req.body.comment };

    try {
      const newReview = await reviewService.submitNewReview(userId, productId, reviewData);
      res.status(201).json(newReview);
    } catch (error) {
      next(error); // Errors (NotFoundError, ConflictError, AppError) handled by global handler
    }
  }
);

// GET /api/products/:productId/reviews/my-review - Get the current user's review for a product
router.get(
  '/products/:productId/reviews/my-review',
  isAuthenticated,
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const simplifiedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
      return res.status(400).json({ errors: simplifiedErrors });
    }

    const { productId } = req.params;
    const userId = req.user.userId;

    try {
      const review = await reviewService.getUserReviewForProduct(userId, productId);
      res.json(review); // Service returns review object or null
    } catch (error) {
      next(error);
    }
  }
);


// GET /api/products/:productId/reviews - List approved reviews for a product
router.get(
  '/products/:productId/reviews',
  [
    param('productId').isInt({ gt: 0 }).withMessage('Product ID must be a positive integer.').toInt(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const simplifiedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
      return res.status(400).json({ errors: simplifiedErrors });
    }

    const { productId } = req.params;
    // Get page and limit from req.query; service will apply defaults if undefined
    const { page, limit } = req.query;

    try {
      const result = await reviewService.getApprovedReviewsForProduct(productId, { page, limit });
      res.json(result); // Service returns { reviews: [], pagination: {} }
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
