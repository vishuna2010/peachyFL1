const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, checkPermission } = require('../auth'); // Assuming isAdmin might be replaced by checkPermission
const { query, validationResult } = require('express-validator');
const reportService = require('../services/reportService');
const { AppError } = require('../utils/AppError'); // For consistent error handling
const db = require('../db');

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

// GET /api/admin/reports/profit-loss - Profit & Loss Report
router.get('/profit-loss', 
  checkPermission('reports:view'),
  [
    query('startDate').notEmpty().withMessage('startDate is required.').isISO8601().toDate().withMessage('Invalid startDate format. Please use YYYY-MM-DD.'),
    query('endDate').notEmpty().withMessage('endDate is required.').isISO8601().toDate().withMessage('Invalid endDate format. Please use YYYY-MM-DD.')
      .custom((value, { req }) => {
        if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
          throw new Error('endDate cannot be before startDate.');
        }
        return true;
      }),
    query('groupBy').optional().isString().trim().toLowerCase().isIn(['day', 'week', 'month', 'quarter', 'year']).default('month'),
    query('productId').optional().isInt({ gt: 0 }).toInt().withMessage('productId must be a positive integer'),
    query('categoryId').optional().isInt({ gt: 0 }).toInt().withMessage('categoryId must be a positive integer'),
    query('variantId').optional().isInt({ gt: 0 }).toInt().withMessage('variantId must be a positive integer'),
    query('customerId').optional().isInt({ gt: 0 }).toInt().withMessage('customerId must be a positive integer'),
    query('orderStatus').optional().isString().trim().toLowerCase().isIn(['pending', 'processing', 'dispatched', 'delivered', 'completed', 'cancelled', 'refunded']).withMessage('Invalid order status'),
    query('paymentStatus').optional().isString().trim().toLowerCase().isIn(['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'failed', 'cancelled', 'voided']).withMessage('Invalid payment status'),
    query('supplierId').optional().isInt({ gt: 0 }).toInt().withMessage('supplierId must be a positive integer'),
    query('includeRefunds').optional().isBoolean().toBoolean().default(false),
    query('includeCancelled').optional().isBoolean().toBoolean().default(false)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { 
        startDate, 
        endDate, 
        groupBy = 'month',
        productId,
        categoryId,
        variantId,
        customerId,
        orderStatus,
        paymentStatus,
        supplierId,
        includeRefunds = false,
        includeCancelled = false
      } = req.query;

      // Build WHERE conditions dynamically
      let whereConditions = ['o.created_at >= $1', 'o.created_at <= $2'];
      let queryParams = [startDate, endDate];
      let paramIndex = 3;

      // Status conditions
      let statusConditions = ["'completed'", "'delivered'", "'dispatched'"];
      if (includeRefunds) {
        statusConditions.push("'refunded'");
      }
      if (includeCancelled) {
        statusConditions.push("'cancelled'");
      }
      whereConditions.push(`o.status IN (${statusConditions.join(', ')})`);

      // Add filters
      if (productId) {
        whereConditions.push(`oi.product_id = $${paramIndex++}`);
        queryParams.push(productId);
      }

      if (categoryId) {
        whereConditions.push(`p.category_id = $${paramIndex++}`);
        queryParams.push(categoryId);
      }

      if (variantId) {
        whereConditions.push(`oi.variant_id = $${paramIndex++}`);
        queryParams.push(variantId);
      }

      if (customerId) {
        whereConditions.push(`o.user_id = $${paramIndex++}`);
        queryParams.push(customerId);
      }

      if (orderStatus) {
        whereConditions.push(`o.status = $${paramIndex++}`);
        queryParams.push(orderStatus);
      }

      if (paymentStatus) {
        whereConditions.push(`o.payment_status = $${paramIndex++}`);
        queryParams.push(paymentStatus);
      }

      if (supplierId) {
        whereConditions.push(`p.supplier_id = $${paramIndex++}`);
        queryParams.push(supplierId);
      }

      const whereClause = whereConditions.join(' AND ');

    // Get revenue data
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) as product_sales,
        COALESCE(SUM(o.shipping_cost), 0) as shipping_revenue,
        COALESCE(SUM(o.total_tax_amount), 0) as tax_collected,
        COALESCE(SUM(o.discount_amount_applied), 0) as discounts_given
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE ${whereClause}
    `;

    // Get cost data
    const costQuery = `
      SELECT 
        COALESCE(SUM(oi.quantity * p.cost_price), 0) as product_costs,
        COALESCE(SUM(o.shipping_cost), 0) as shipping_costs,
        COALESCE(SUM(o.total_amount * 0.029 + 0.30), 0) as payment_fees,
        COALESCE(SUM(o.total_tax_amount), 0) as tax_paid,
        0 as operating_expenses
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE ${whereClause}
    `;

    // Get time series data based on grouping
    let timeSeriesQuery = '';
    let groupByClause = '';
    
    switch (groupBy) {
      case 'day':
        groupByClause = "DATE(o.created_at)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', o.created_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', o.created_at)";
        break;
      case 'quarter':
        groupByClause = "DATE_TRUNC('quarter', o.created_at)";
        break;
      case 'year':
        groupByClause = "DATE_TRUNC('year', o.created_at)";
        break;
      default:
        groupByClause = "DATE_TRUNC('month', o.created_at)";
    }

    timeSeriesQuery = `
      SELECT 
        ${groupByClause} as period,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) as revenue,
        COALESCE(SUM(oi.quantity * p.cost_price), 0) as costs,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase - oi.quantity * p.cost_price), 0) as gross_profit,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase - oi.quantity * p.cost_price - (oi.quantity * oi.price_at_purchase * 0.029 + 0.30)), 0) as net_profit
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE ${whereClause}
      GROUP BY ${groupByClause}
      ORDER BY period
    `;

    // Get top products by profit
    const topProductsQuery = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        SUM(oi.quantity) as units_sold,
        SUM(oi.quantity * oi.price_at_purchase) as revenue,
        SUM(oi.quantity * p.cost_price) as cost,
        SUM(oi.quantity * oi.price_at_purchase - oi.quantity * p.cost_price) as profit
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE ${whereClause}
      GROUP BY p.id, p.name, p.sku
      ORDER BY profit DESC
      LIMIT 10
    `;

    // Execute queries
    const [revenueResult, costResult, timeSeriesResult, topProductsResult] = await Promise.all([
      db.query(revenueQuery, queryParams),
      db.query(costQuery, queryParams),
      db.query(timeSeriesQuery, queryParams),
      db.query(topProductsQuery, queryParams)
    ]);

    // Calculate summary
    const revenue = revenueResult.rows[0];
    const costs = costResult.rows[0];
    
    const totalRevenue = parseFloat(revenue.product_sales) + parseFloat(revenue.shipping_revenue) + parseFloat(revenue.tax_collected) - parseFloat(revenue.discounts_given);
    const totalCosts = parseFloat(costs.product_costs) + parseFloat(costs.shipping_costs) + parseFloat(costs.payment_fees) + parseFloat(costs.tax_paid) + parseFloat(costs.operating_expenses);
    const grossProfit = totalRevenue - parseFloat(costs.product_costs) - parseFloat(costs.shipping_costs);
    const netProfit = grossProfit - parseFloat(costs.payment_fees) - parseFloat(costs.tax_paid) - parseFloat(costs.operating_expenses);

    // Calculate metrics
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const cogsPercentage = totalRevenue > 0 ? (parseFloat(costs.product_costs) / totalRevenue) * 100 : 0;
    const operatingExpensePercentage = totalRevenue > 0 ? (parseFloat(costs.operating_expenses) / totalRevenue) * 100 : 0;

    // Process time series data
    const timeSeries = timeSeriesResult.rows.map(row => ({
      period: row.period,
      revenue: parseFloat(row.revenue),
      costs: parseFloat(row.costs),
      gross_profit: parseFloat(row.gross_profit),
      net_profit: parseFloat(row.net_profit),
      profit_margin: parseFloat(row.revenue) > 0 ? (parseFloat(row.net_profit) / parseFloat(row.revenue)) * 100 : 0
    }));

    // Process top products
    const topProducts = topProductsResult.rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      sku: row.sku,
      units_sold: parseInt(row.units_sold),
      revenue: parseFloat(row.revenue),
      cost: parseFloat(row.cost),
      profit: parseFloat(row.profit),
      margin: parseFloat(row.revenue) > 0 ? (parseFloat(row.profit) / parseFloat(row.revenue)) * 100 : 0
    }));

    const reportData = {
      report_period: {
        start_date: startDate,
        end_date: endDate,
        group_by: groupBy
      },
      summary: {
        total_revenue: totalRevenue,
        total_costs: totalCosts,
        gross_profit: grossProfit,
        net_profit: netProfit
      },
      revenue: {
        product_sales: parseFloat(revenue.product_sales),
        shipping_revenue: parseFloat(revenue.shipping_revenue),
        tax_collected: parseFloat(revenue.tax_collected),
        discounts_given: parseFloat(revenue.discounts_given)
      },
      costs: {
        product_costs: parseFloat(costs.product_costs),
        shipping_costs: parseFloat(costs.shipping_costs),
        payment_fees: parseFloat(costs.payment_fees),
        tax_paid: parseFloat(costs.tax_paid),
        operating_expenses: parseFloat(costs.operating_expenses)
      },
      metrics: {
        grossProfitMargin,
        netProfitMargin,
        cogsPercentage,
        operatingExpensePercentage
      },
      timeSeries,
      topProducts
    };

    res.json(reportData);

  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      console.error('Error generating profit & loss report:', error);
      next(new AppError('Failed to generate profit & loss report', 500));
    }
  }
});

// GET /api/admin/reports/profit-loss/filter-options - Get filter options for P&L report
router.get('/profit-loss/filter-options', 
  checkPermission('reports:view'),
  async (req, res, next) => {
    try {
      // Get products
      const productsQuery = `
        SELECT id, name, sku 
        FROM products 
        ORDER BY name
      `;
      
      // Get categories
      const categoriesQuery = `
        SELECT id, name 
        FROM categories 
        ORDER BY name
      `;
      
      // Get variants
      const variantsQuery = `
        SELECT DISTINCT pv.id, pv.sku, p.name as product_name
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        ORDER BY p.name, pv.sku
      `;
      
      // Get customers (users who have placed orders)
      const customersQuery = `
        SELECT DISTINCT u.id, u.name, u.email
        FROM users u
        JOIN orders o ON u.id = o.user_id
        ORDER BY u.name
      `;
      
      // Get suppliers
      const suppliersQuery = `
        SELECT id, name 
        FROM suppliers 
        ORDER BY name
      `;

      const [productsResult, categoriesResult, variantsResult, customersResult, suppliersResult] = await Promise.all([
        db.query(productsQuery),
        db.query(categoriesQuery),
        db.query(variantsQuery),
        db.query(customersQuery),
        db.query(suppliersQuery)
      ]);

      const filterOptions = {
        products: productsResult.rows,
        categories: categoriesResult.rows,
        variants: variantsResult.rows,
        customers: customersResult.rows,
        suppliers: suppliersResult.rows,
        orderStatuses: [
          { value: 'pending', label: 'Pending' },
          { value: 'processing', label: 'Processing' },
          { value: 'dispatched', label: 'Dispatched' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'refunded', label: 'Refunded' }
        ],
        paymentStatuses: [
          { value: 'pending', label: 'Pending' },
          { value: 'paid', label: 'Paid' },
          { value: 'partially_paid', label: 'Partially Paid' },
          { value: 'refunded', label: 'Refunded' },
          { value: 'partially_refunded', label: 'Partially Refunded' },
          { value: 'failed', label: 'Failed' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'voided', label: 'Voided' }
        ]
      };

      res.status(200).json(filterOptions);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
