const express = require('express');
const router = express.Router();
const { isAuthenticated, checkPermission } = require('../auth');
const { query, param, body, validationResult } = require('express-validator');
const reviewService = require('../services/reviewService');
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Added BadRequestError

// Endpoint 1: GET /api/admin/reviews (List All Reviews for Admin)
router.get(
  '/',
  isAuthenticated,
  checkPermission('reviews:manage'),
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('status').optional().isString().trim().toLowerCase().isIn(['pending', 'approved', 'rejected']), // 'rejected' will map to is_approved: false
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
      'created_at', 'rating', 'is_approved', 'product_name', 'user_name' // Changed 'status' to 'is_approved'
    ]).withMessage('Invalid sortBy parameter.').default('created_at'),
    query('sortOrder').optional().isString().trim().toUpperCase().isIn(['ASC', 'DESC']).default('DESC')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // The reviewService.getAllReviews now handles mapping string 'status' query param
      // to boolean 'is_approved' logic.
      const options = { ...req.query };
      const result = await reviewService.getAllReviews(options);
      res.json(result);
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
      const review = await reviewService.getReviewById(reviewId);
      res.json(review); // reviewService now returns is_approved instead of status
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
    body('status').isString().trim().toLowerCase().isIn(['approved', 'rejected', 'pending']).withMessage("Status must be one of: 'pending', 'approved', 'rejected'.")
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reviewId } = req.params;
    const { status } = req.body; // status is 'approved', 'pending', or 'rejected'
    const adminUserId = req.user.userId;
    const adminUserEmail = req.user.email;

    let is_approved_value;
    if (status === 'approved') {
      is_approved_value = true;
    } else if (status === 'pending' || status === 'rejected') {
      // Both 'pending' and 'rejected' map to is_approved = false
      // The distinction, if needed, would have to be handled by another field or not at all if only approval matters.
      is_approved_value = false;
    } else {
      // This case should ideally not be reached due to isIn validator, but as a safeguard:
      return next(new BadRequestError("Invalid status value provided."));
    }

    try {
      const updatedReview = await reviewService.updateReview(
        reviewId,
        { is_approved: is_approved_value }, // Pass the boolean is_approved
        adminUserId,
        adminUserEmail
      );
      res.json(updatedReview); // reviewService now returns is_approved
    } catch (error) {
      next(error);
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
    const adminUserId = req.user.userId;
    const adminUserEmail = req.user.email;

    try {
      await reviewService.deleteReview(reviewId, adminUserId, adminUserEmail);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
