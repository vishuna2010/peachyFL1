const express = require('express');
const router = express.Router();
const { isAuthenticated, checkPermission } = require('../auth');
const { query, param, body, validationResult } = require('express-validator');
const reviewService = require('../services/reviewService');
const { NotFoundError } = require('../utils/AppError'); // Only NotFoundError might be directly thrown by routes if service handles others

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
    query('rating').optional().isInt({ min: 1, max: 5 }).toInt(),
    query('dateFrom').optional().isISO8601().toDate(),
    query('dateTo').optional().isISO8601().toDate().custom((value, { req }) => {
      if (value && req.query.dateFrom) {
        if (new Date(value) < new Date(req.query.dateFrom)) {
          throw new Error('dateTo cannot be earlier than dateFrom.');
        }
      }
      return true;
    }),
    query('sortBy').optional().isString().trim().isIn([
      'created_at', 'rating', 'status', 'product_name', 'user_name'
    ]).withMessage('Invalid sortBy parameter.').default('created_at'),
    query('sortOrder').optional().isString().trim().toUpperCase().isIn(['ASC', 'DESC']).default('DESC')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Pass all validated and sanitized query params to the service
      const options = { ...req.query };
      const result = await reviewService.getAllReviews(options);
      res.json(result); // Service returns { data: [], pagination: {} }
    } catch (error) {
      next(error); // Pass errors from service to global error handler
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
      const review = await reviewService.getReviewById(reviewId);
      // reviewService.getReviewById throws NotFoundError if not found
      res.json(review);
    } catch (error) {
      next(error);
    }
  }
);

// Endpoint 3: PUT /api/admin/reviews/:reviewId/status (Update Review Status)
// This route specifically updates status. A more general PUT /:reviewId could update other fields.
router.put(
  '/:reviewId/status',
  isAuthenticated,
  checkPermission('reviews:manage'), // Or a more specific 'reviews:edit_status'
  [
    param('reviewId').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.').toInt(),
    body('status').isString().isIn(['approved', 'rejected', 'pending']).withMessage("Status must be one of: 'pending', 'approved', 'rejected'.")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reviewId } = req.params;
    const { status } = req.body;
    const adminUserId = req.user.userId;
    const adminUserEmail = req.user.email;

    try {
      // The service method `updateReview` can handle just status updates
      const updatedReview = await reviewService.updateReview(
        reviewId,
        { status }, // Pass only status in updateData
        adminUserId,
        adminUserEmail
      );
      res.json(updatedReview);
    } catch (error) {
      next(error);
    }
  }
);

// Endpoint 4: DELETE /api/admin/reviews/:reviewId (Delete a Review)
router.delete(
  '/:reviewId',
  isAuthenticated,
  checkPermission('reviews:manage'), // Or a more specific 'reviews:delete'
  [param('reviewId').isInt({ gt: 0 }).withMessage('Review ID must be a positive integer.').toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reviewId } = req.params;
    const adminUserId = req.user.userId;
    const adminUserEmail = req.user.email;

    try {
      await reviewService.deleteReview(reviewId, adminUserId, adminUserEmail);
      // deleteReview service method handles NotFoundError and internal transaction.
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
