const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, checkPermission } = require('../auth'); // Added checkPermission
const { body, validationResult } = require('express-validator');
const inventoryService = require('../services/inventoryService');
// AppError, NotFoundError, BadRequestError will be thrown by the service and handled by global error handler

// Apply auth middleware. Consider replacing isAdmin with a more specific permission if available/needed.
// For now, keeping isAdmin for broad access control to this module.
// Alternatively, use a specific permission for all adjustment routes:
// router.use(isAuthenticated, checkPermission('inventory:adjust')); // Example
router.use(isAuthenticated, isAdmin);


// Validation for the generic /adjust route
const validateManualAdjustmentParams = [
  body('itemType').isIn(['product', 'variant']).withMessage("itemType must be 'product' or 'variant'."),
  body('itemId').isInt({ gt: 0 }).withMessage('itemId must be a positive integer.').toInt(),
  body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer for the adjustment magnitude.').toInt(),
  body('reason').notEmpty().isString().trim().withMessage('Reason is required.'),
  body('movementType').trim().isIn(inventoryService.VALID_ADJUSTMENT_MOVEMENT_TYPES)
    .withMessage(`Movement type must be one of: ${inventoryService.VALID_ADJUSTMENT_MOVEMENT_TYPES.join(', ')}`)
];

// Generic endpoint for various manual adjustments (write-offs, corrections, found stock etc.)
router.post(
  '/adjust',
  validateManualAdjustmentParams,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const adjustmentDetails = {
        itemType: req.body.itemType,
        itemId: req.body.itemId,
        quantity: req.body.quantity, // Service will determine if it's +/- based on movementType
        reason: req.body.reason,
        movementType: req.body.movementType,
        adminUserId: req.user.userId,
        adminUserEmail: req.user.email
      };

      const result = await inventoryService.performManualAdjustment(adjustmentDetails);
      res.status(200).json(result);
    } catch (error) {
      next(error); // Errors from service (NotFoundError, BadRequestError, AppError) passed to global handler
    }
  }
);

// Validation for Physical Count
const validatePhysicalCountParams = [
  body('itemType').isIn(['product', 'variant']).withMessage("itemType must be 'product' or 'variant'."),
  body('itemId').isInt({ gt: 0 }).toInt().withMessage('itemId must be a positive integer.'),
  body('countedQuantity').isInt({ min: 0 }).toInt().withMessage('Counted quantity must be a non-negative integer.'),
  body('reason').notEmpty().isString().trim().withMessage('Reason for count/adjustment is required.')
];

router.post(
  '/physical-count',
  validatePhysicalCountParams,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const countDetails = {
        itemType: req.body.itemType,
        itemId: req.body.itemId,
        countedQuantity: req.body.countedQuantity,
        reason: req.body.reason,
        adminUserId: req.user.userId,
        adminUserEmail: req.user.email
      };

      const result = await inventoryService.recordPhysicalCount(countDetails);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
