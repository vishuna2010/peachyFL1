const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, checkPermission } = require('../auth'); // Assuming isAdmin might be replaced by checkPermission
const { query, validationResult } = require('express-validator');
const reportService = require('../services/reportService');
const { AppError } = require('../utils/AppError'); // For consistent error handling

// Apply auth middleware to all routes in this router
// Using isAdmin for now, but individual routes could use more granular checkPermission if desired.
// Example: router.use(isAuthenticated, checkPermission('reports:view'));
router.use(isAuthenticated, isAdmin);

// GET /api/admin/reports/low-stock-products
router.get('/low-stock-products',
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('categoryId').optional().isInt({ gt: 0 }).toInt(),
    query('supplierId').optional().isInt({ gt: 0 }).toInt(),
    query('sortBy').optional().isString().trim().isIn(['name', 'sku', 'stock_quantity', 'reorder_threshold', 'stock_difference', 'supplier_name']).default('stock_difference'),
    query('sortOrder').optional().isString().trim().toUpperCase().isIn(['ASC', 'DESC']).default('ASC'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const options = { ...req.query };
      // Note: reportService.generateLowStockReport would need to be updated to use these options.
      const reportData = await reportService.generateLowStockReport(options);
      res.status(200).json(reportData);
    } catch (error) {
      next(error);
    }
  }
);

// Validation chain for Tax Report
const validateTaxReportParams = [
  query('year')
    .notEmpty().withMessage('Year is required.')
    .isInt({ min: 2000, max: new Date().getFullYear() + 5 }).withMessage(`Year must be an integer between 2000 and ${new Date().getFullYear() + 5}.`)
    .toInt(),
  query('periodType')
    .trim()
    .notEmpty().withMessage('periodType is required.')
    .isIn(['monthly', 'quarterly']).withMessage("periodType must be either 'monthly' or 'quarterly'."),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Month must be an integer between 1 and 12.')
    .toInt()
    .custom((value, { req }) => {
      if (req.query.periodType === 'monthly' && (value === undefined || value === null)) {
        throw new Error('Month is required when periodType is "monthly".');
      }
      if (req.query.periodType === 'quarterly' && value !== undefined && value !== null) {
        // Allow month to be passed but ignored if quarterly, or explicitly disallow:
        // throw new Error('Month should not be provided when periodType is "quarterly".');
      }
      return true;
    }),
  query('quarter')
    .optional()
    .isInt({ min: 1, max: 4 }).withMessage('Quarter must be an integer between 1 and 4.')
    .toInt()
    .custom((value, { req }) => {
      if (req.query.periodType === 'quarterly' && (value === undefined || value === null)) {
        throw new Error('Quarter is required when periodType is "quarterly".');
      }
      if (req.query.periodType === 'monthly' && value !== undefined && value !== null) {
        // Allow quarter to be passed but ignored if monthly, or explicitly disallow:
        // throw new Error('Quarter should not be provided when periodType is "monthly".');
      }
      return true;
    })
];

// GET /api/admin/reports/tax-report (Consolidated from /tax-returns)
router.get('/tax-report', validateTaxReportParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const options = { ...req.query }; // Pass all validated query params
    const reportData = await reportService.generateTaxReport(options);
    res.status(200).json(reportData);
  } catch (error) {
    next(error);
  }
});

// Validation chain for date range based reports
const validateDateRangeParams = [
    query('startDate').optional().isISO8601().toDate().withMessage('Invalid startDate format. Please use YYYY-MM-DD.'),
    query('endDate').optional().isISO8601().toDate().withMessage('Invalid endDate format. Please use YYYY-MM-DD.')
      .custom((value, { req }) => {
        if (req.query.startDate && value < new Date(req.query.startDate)) {
          throw new Error('endDate cannot be before startDate.');
        }
        return true;
      })
];

// GET /api/admin/reports/invoice-export
router.get('/invoice-export', validateDateRangeParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const reportData = await reportService.generateInvoiceExport(options);
    res.status(200).json(reportData);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/tax-summary-by-region
router.get('/tax-summary-by-region', validateDateRangeParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const reportData = await reportService.generateTaxSummaryByRegionReport(options);
    res.status(200).json(reportData);
  } catch (error) {
    next(error);
  }
});

// Validation for Best Sellers Report
const validateBestSellersParams = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
  query('sortByMetric').optional().trim().toLowerCase().isIn(['quantity', 'revenue']).default('quantity'),
  ...validateDateRangeParams // Include common date range validations
];

// GET /api/admin/reports/best-sellers
router.get('/best-sellers', validateBestSellersParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const options = {
      limit: req.query.limit,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      sortByMetric: req.query.sortByMetric
    };
    const reportData = await reportService.generateBestSellersReport(options);
    res.status(200).json(reportData);
  } catch (error) {
    next(error);
  }
});

// Validation for Sales Report (requires dates)
const validateSalesReportParams = [
  query('startDate').notEmpty().withMessage('startDate is required.').isISO8601().toDate().withMessage('Invalid startDate format. Please use YYYY-MM-DD.'),
  query('endDate').notEmpty().withMessage('endDate is required.').isISO8601().toDate().withMessage('Invalid endDate format. Please use YYYY-MM-DD.')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) { // Ensure date objects are compared
        throw new Error('endDate cannot be before startDate.');
      }
      return true;
    }),
  query('status').optional().isString().trim().toLowerCase().isIn(['shipped', 'delivered', 'completed']).withMessage('Invalid status. Allowed: shipped, delivered, completed.'),
  query('paymentStatus').optional().isString().trim().toLowerCase().isIn(['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided']).withMessage('Invalid paymentStatus.'),
  query('productId').optional().isInt({ gt: 0 }).toInt(),
  query('customerId').optional().isInt({ gt: 0 }).toInt() // Assuming customerId is userId
];

// GET /api/admin/reports/sales
router.get('/sales', validateSalesReportParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const options = {
      startDate: req.query.startDate, // Already validated and converted to Date objects
      endDate: req.query.endDate   // Already validated and converted to Date objects
    };
    const reportData = await reportService.generateSalesReport(options);
    res.status(200).json(reportData);
  } catch (error) {
    next(error);
  }
});

// Removed the duplicate /tax-returns placeholder route.

// Validation for Stock Valuation Report
const validateStockValuationParams = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('categoryId').optional().isInt({ gt: 0 }).toInt(),
  query('supplierId').optional().isInt({ gt: 0 }).toInt(),
  query('sortBy').optional().isString().trim().isIn(['product_name', 'sku', 'stock_quantity', 'cost_price', 'total_value']).default('product_name'),
  query('sortOrder').optional().isString().trim().toUpperCase().isIn(['ASC', 'DESC']).default('ASC')
];

// GET /api/admin/reports/stock-valuation
router.get('/stock-valuation', validateStockValuationParams, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      categoryId: req.query.categoryId,
      supplierId: req.query.supplierId,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const reportData = await reportService.generateStockValuationReport(options);
    res.status(200).json(reportData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
