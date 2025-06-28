const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { isAuthenticated, checkPermission } = require('../auth'); // Assuming auth utilities are in this path
const marketingService = require('../services/marketingService');
const { AppError } = require('../utils/AppError'); // For consistent error handling

// Validation rules for sending a promotional email
const validateSendPromoEmail = [
  body('subject').notEmpty().withMessage('Subject is required.').isString().trim().isLength({ min: 3, max: 255 }),
  body('promoTitle').optional().isString().trim().isLength({ max: 255 }),
  body('promoMessageBody').notEmpty().withMessage('Promotional message body is required.').isString(),
  body('ctaLink').notEmpty().withMessage('Call-to-action link is required.').isURL().withMessage('Invalid CTA link URL.'),
  body('ctaText').notEmpty().withMessage('Call-to-action text is required.').isString().trim().isLength({ min: 1, max: 50 }),
  // body('segmentType').optional().isString().isIn(['all_users', 'specific_segment_placeholder']) // Example for future segment types
];

// POST /api/admin/marketing/send-promo-email
router.post(
  '/send-promo-email',
  isAuthenticated,
  checkPermission('marketing:send_emails'), // New permission
  validateSendPromoEmail,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      subject,
      promoTitle,
      promoMessageBody,
      ctaLink,
      ctaText,
      // segmentType // For future use
    } = req.body;

    const promoDetails = {
      subject,
      promoTitle,
      promoMessageBody,
      ctaLink,
      ctaText,
    };

    try {
      // const currentSegmentType = segmentType || 'all_users'; // Default segment
      // For now, marketingService handles 'all_users' implicitly
      const result = await marketingService.sendPromotionalEmailToSegment(promoDetails);

      res.status(200).json({
        message: result.message || 'Promotional email campaign initiated successfully.',
        details: {
          totalAttempted: result.totalUsersAttempted,
          successfulSends: result.emailsSentSuccessfully,
          failedSends: result.emailsFailed,
          errors: result.errors,
        }
      });
    } catch (error) {
      // Catch errors from marketingService (like AppError for invalid promo details or user fetch failure)
      // or any other unexpected errors.
      console.error('[AdminMarketingRoute] Error sending promotional email:', error);
      next(error); // Pass to global error handler
    }
  }
);

module.exports = router;
