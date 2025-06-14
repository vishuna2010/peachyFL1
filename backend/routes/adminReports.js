const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { query, validationResult } = require('express-validator');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// GET /api/admin/reports/low-stock-products - Fetch products that are at or below their reorder threshold
router.get('/low-stock-products', async (req, res) => {
  try {
    const query = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.stock_quantity,
        p.reorder_threshold,
        p.updated_at, -- Last time product (potentially stock) was updated
        s.name AS supplier_name,
        (p.stock_quantity - p.reorder_threshold) AS stock_difference -- For sorting by urgency
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE
        p.reorder_threshold IS NOT NULL AND -- Only include products with a defined threshold
        p.reorder_threshold > 0 AND         -- Only if threshold is actively set above zero
        p.stock_quantity <= p.reorder_threshold
      ORDER BY
        stock_difference ASC, -- Most urgent (further below threshold) first
        p.name ASC;
    `;
    // Note: Pagination could be added here if the list of low-stock products is expected to be very long.
    // For now, returning all matching products.

    const result = await db.query(query);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching low stock products report:', error);
    res.status(500).json({ message: 'Failed to retrieve low stock products report.' });
  }
});

const validateTaxReturnsParams = [
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
        throw new Error('Month should not be provided when periodType is "quarterly".');
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
        throw new Error('Quarter should not be provided when periodType is "monthly".');
      }
      return true;
    })
];

// GET /api/admin/reports/tax-returns - Fetch total tax collected for a given period (month/quarter)
router.get('/tax-returns', validateTaxReturnsParams, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Use validated and sanitized values from req.query for year, periodType, month, quarter
  const { year, periodType, month, quarter } = req.query; // Validated and sanitized

  let startDate;
  let endDate;

  if (periodType === 'monthly') {
    // month is 1-indexed from validator, but 0-indexed for Date constructor
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 1); // First day of next month
  } else { // periodType === 'quarterly'
    let startMonth;
    if (quarter === 1) startMonth = 0; // Q1: Jan-Mar (months 0,1,2)
    else if (quarter === 2) startMonth = 3; // Q2: Apr-Jun (months 3,4,5)
    else if (quarter === 3) startMonth = 6; // Q3: Jul-Sep (months 6,7,8)
    else startMonth = 9; // Q4: Oct-Dec (months 9,10,11)

    startDate = new Date(year, startMonth, 1);
    endDate = new Date(year, startMonth + 3, 1); // First day of the month after the quarter ends
  }

  const queryParams = [];

  // Define relevant order statuses
  const RELEVANT_ORDER_STATUSES = ['completed', 'shipped', 'delivered']; // Consider which statuses mean "tax is final"
  queryParams.push(RELEVANT_ORDER_STATUSES);
  queryParams.push(startDate);
  queryParams.push(endDate);

  try {
    const query = `
      SELECT
        COALESCE(SUM(o.total_tax_amount), 0) as total_tax_for_period
      FROM orders o
      WHERE o.status = ANY($1::varchar[])
        AND o.created_at >= $2
        AND o.created_at < $3;
    `;

    const result = await db.query(query, queryParams);
    const totalTax = result.rows[0] ? parseFloat(result.rows[0].total_tax_for_period).toFixed(2) : "0.00";

    // Response formatting will be handled in the next step.
    // For now, just return the fetched totalTax along with parameters.
    res.status(200).json({
      report_parameters: {
        year,
        periodType,
        ...(month && { month }), // Conditionally add month
        ...(quarter && { quarter }) // Conditionally add quarter
      },
      total_tax_for_period: totalTax
    });

  } catch (error) {
    console.error('Error generating tax returns report:', error);
    res.status(500).json({ message: 'Failed to generate tax returns report.' });
  }
});

// GET /api/admin/reports/invoice-export - Export invoice-level data
router.get('/invoice-export', async (req, res) => {
  // Logic for date validation, query construction, and data fetching will be added in the next step.
  // For now, include basic structure and placeholder for the logic.
  const { start_date, end_date } = req.query;
  const queryParams = [];
  let dateConditions = "";
  let paramIndex = 1;

  // Validate and build date conditions (copied from tax-summary-by-region for now)
  if (start_date) {
    const startDateObj = new Date(start_date);
    if (isNaN(startDateObj.getTime())) {
      return res.status(400).json({ message: 'Invalid start_date format. Please use YYYY-MM-DD.' });
    }
    queryParams.push(startDateObj);
    dateConditions += ` AND o.created_at >= $${paramIndex++}`;
  }

  if (end_date) {
    const endDateObj = new Date(end_date);
    if (isNaN(endDateObj.getTime())) {
      return res.status(400).json({ message: 'Invalid end_date format. Please use YYYY-MM-DD.' });
    }
    endDateObj.setHours(23, 59, 59, 999); // Include whole end day
    queryParams.push(endDateObj);
    dateConditions += ` AND o.created_at <= $${paramIndex++}`;
  }

  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
     return res.status(400).json({ message: 'start_date cannot be after end_date.' });
  }

  try {
    // Define relevant order statuses to include in the export
    const RELEVANT_ORDER_STATUSES = ['processing', 'shipped', 'delivered', 'completed'];
    // Add RELEVANT_ORDER_STATUSES to queryParams, ensuring paramIndex is updated
    queryParams.push(RELEVANT_ORDER_STATUSES);
    const statusCondition = `o.status = ANY($${paramIndex++}::varchar[])`;

    const query = `
      SELECT
        o.id as order_id,
        o.created_at as order_date,
        o.status as order_status,
        o.payment_status,
        u.email as customer_email,
        u.name as customer_name,
        o.billing_country,
        o.billing_state_province_region,
        o.billing_city,
        o.billing_postal_code,
        o.shipping_country,
        o.shipping_state_province_region,
        o.shipping_city,
        o.shipping_postal_code,
        oi.id as line_item_id,
        p.sku as product_sku,
        p.name as product_name,
        pv.sku as variant_sku,
        oi.quantity,
        oi.price_at_purchase as exclusive_unit_price,
        (oi.quantity * oi.price_at_purchase) as line_item_exclusive_subtotal,
        oi.line_item_tax_amount,
        ((oi.quantity * oi.price_at_purchase) + oi.line_item_tax_amount) as line_item_total_inclusive_of_tax,
        o.original_total_amount as order_exclusive_subtotal_before_discount,
        o.discount_amount_applied as order_discount_amount,
        o.total_tax_amount as order_total_tax,
        o.total_amount as order_grand_total,
        oi.tax_class_id_at_purchase,
        tc.name as tax_class_name_at_purchase,
        oi.applied_tax_rate_percentage as line_item_effective_tax_rate,
        o.tax_summary_details as order_tax_summary_json
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN tax_classes tc ON oi.tax_class_id_at_purchase = tc.id
      WHERE ${statusCondition} ${dateConditions}  -- dateConditions will be empty if no dates are provided
      ORDER BY o.id ASC, oi.id ASC;
    `;

    const result = await db.query(query, queryParams);

    // The data formatting will be handled in the next step, for now, just return raw rows.
    // Or, if simple enough, include basic formatting here.
    // For this step, let's return raw rows and plan detailed formatting for the next step if complex.
    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error generating invoice export:', error);
    res.status(500).json({ message: 'Failed to generate invoice export.' });
  }
});

// GET /api/admin/reports/tax-summary-by-region - Fetch total tax collected grouped by region
router.get('/tax-summary-by-region', async (req, res) => {
  const { start_date, end_date } = req.query;
  const queryParams = [];
  let dateConditions = "";
  let paramIndex = 1;

  // Validate and build date conditions
  if (start_date) {
    const startDateObj = new Date(start_date);
    if (isNaN(startDateObj.getTime())) {
      return res.status(400).json({ message: 'Invalid start_date format. Please use YYYY-MM-DD.' });
    }
    queryParams.push(startDateObj);
    dateConditions += ` AND o.created_at >= $${paramIndex++}`;
  }

  if (end_date) {
    const endDateObj = new Date(end_date);
    if (isNaN(endDateObj.getTime())) {
      return res.status(400).json({ message: 'Invalid end_date format. Please use YYYY-MM-DD.' });
    }
    endDateObj.setHours(23, 59, 59, 999); // Include whole end day
    queryParams.push(endDateObj);
    dateConditions += ` AND o.created_at <= $${paramIndex++}`;
  }

  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
     return res.status(400).json({ message: 'start_date cannot be after end_date.' });
  }

  // Define valid statuses for orders to be included in tax summary
  const VALID_TAXED_ORDER_STATUSES = ['processing', 'shipped', 'delivered', 'completed'];
  queryParams.push(VALID_TAXED_ORDER_STATUSES);
  const statusCondition = `o.status = ANY($${paramIndex++}::varchar[])`;

  try {
    const query = `
      SELECT
        o.billing_country,
        o.billing_state_province_region,
        COALESCE(SUM(o.total_tax_amount), 0) as total_tax_collected,
        COUNT(DISTINCT o.id) as total_orders_contributing_tax
      FROM orders o
      WHERE o.total_tax_amount > 0 AND ${statusCondition} ${dateConditions}
      GROUP BY o.billing_country, o.billing_state_province_region
      ORDER BY o.billing_country, o.billing_state_province_region;
    `;

    const result = await db.query(query, queryParams);

    const reportData = result.rows.map(row => ({
        country: row.billing_country,
        region: row.billing_state_province_region || 'N/A', // Handle null regions
        total_tax_collected: parseFloat(row.total_tax_collected).toFixed(2),
        total_orders_contributing_tax: parseInt(row.total_orders_contributing_tax)
    }));

    res.status(200).json(reportData);

  } catch (error) {
    console.error('Error generating tax summary by region report:', error);
    res.status(500).json({ message: 'Failed to generate tax summary by region report.' });
  }
});


// --- Best Sellers Report ---
// VALID_SALE_STATUSES is already defined above for the Sales Report

router.get('/best-sellers', async (req, res) => {
  const {
    limit = 10, // Default to top 10
    start_date,
    end_date,
    sort_by_metric = 'quantity' // Default to sort by quantity
  } = req.query;

  // 1. Validate Parameters
  const numLimit = parseInt(limit);
  if (isNaN(numLimit) || numLimit <= 0 || numLimit > 100) { // Max limit of 100 for sensibility
    return res.status(400).json({ message: 'Invalid limit parameter. Must be a positive integer between 1 and 100.' });
  }

  const allowedSortMetrics = ['quantity', 'revenue'];
  if (!allowedSortMetrics.includes(sort_by_metric.toLowerCase())) {
    return res.status(400).json({ message: `Invalid sort_by_metric. Allowed values: ${allowedSortMetrics.join(', ')}` });
  }

  const queryParams = [];
  let paramIndex = 1;
  let dateConditions = "";

  if (start_date) {
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: 'Invalid start_date format. Please use YYYY-MM-DD.' });
    }
    queryParams.push(startDate);
    dateConditions += ` AND o.created_at >= $${paramIndex++} `;
  }

  if (end_date) {
    const endDate = new Date(end_date);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Invalid end_date format. Please use YYYY-MM-DD.' });
    }
    endDate.setHours(23, 59, 59, 999); // Include whole end day
    queryParams.push(endDate);
    dateConditions += ` AND o.created_at <= $${paramIndex++} `;
  }

  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
     return res.status(400).json({ message: 'start_date cannot be after end_date.' });
  }

  // Add VALID_SALE_STATUSES to queryParams
  queryParams.push(VALID_SALE_STATUSES);
  const statusCondition = ` o.status = ANY($${paramIndex++}::varchar[]) `;


  // 3. Construct SQL Query
  let orderByClause;
  if (sort_by_metric.toLowerCase() === 'revenue') {
    orderByClause = 'total_revenue_generated DESC';
  } else { // Default or 'quantity'
    orderByClause = 'total_quantity_sold DESC';
  }

  const query = `
    SELECT
      oi.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      SUM(oi.quantity_ordered) AS total_quantity_sold,
      SUM(oi.quantity_ordered * oi.price_at_purchase) AS total_revenue_generated
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE ${statusCondition} ${dateConditions}
    GROUP BY oi.product_id, p.name, p.sku
    ORDER BY ${orderByClause}, p.name ASC
    LIMIT $${paramIndex};
  `;
  queryParams.push(numLimit); // Add limit to the parameters list last


  try {
    const result = await db.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error generating best sellers report:', error);
    res.status(500).json({ message: 'Failed to generate best sellers report.' });
  }
});


// --- Sales Report ---
const VALID_SALE_STATUSES = ['shipped', 'delivered', 'completed']; // Define what constitutes a sale

// GET /api/admin/reports/sales - Fetch sales data for a given period
router.get('/sales', async (req, res) => {
  const { start_date, end_date } = req.query;

  // 1. Validate Dates
  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'Both start_date and end_date query parameters are required.' });
  }
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD.' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ message: 'start_date cannot be after end_date.' });
  }
  // Adjust endDate to be end of day for inclusive range
  endDate.setHours(23, 59, 59, 999);

  const client = await db.pool.connect();
  try {
    // Base query for orders within date range and with valid sale statuses
    const baseOrderSelection = `
      SELECT
        id,
        user_id,
        total_amount,
        original_total_amount,
        discount_amount_applied,
        status,
        created_at
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2 AND status = ANY($3::varchar[])
    `;

    // 3. Fetch Individual Orders
    const ordersQuery = `${baseOrderSelection} ORDER BY created_at DESC;`;
    const ordersResult = await client.query(ordersQuery, [startDate, endDate, VALID_SALE_STATUSES]);
    const individualOrders = ordersResult.rows;

    // 4. Calculate Aggregates
    // We can calculate aggregates from the fetched individualOrders to avoid a second complex query,
    // or run a separate aggregate query on the DB.
    // For simplicity with potentially many orders, a separate aggregate query might be more performant for summary.

    const aggregatesQuery = `
      SELECT
        COUNT(*) AS total_orders_count,
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(discount_amount_applied), 0) AS total_discount_given,
        COALESCE(SUM(original_total_amount), 0) AS total_gross_revenue
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2 AND status = ANY($3::varchar[]);
    `;
    const aggregatesResult = await client.query(aggregatesQuery, [startDate, endDate, VALID_SALE_STATUSES]);
    const summary = {
        total_orders_count: parseInt(aggregatesResult.rows[0].total_orders_count),
        total_revenue: parseFloat(aggregatesResult.rows[0].total_revenue).toFixed(2),
        total_discount_given: parseFloat(aggregatesResult.rows[0].total_discount_given).toFixed(2),
        // If original_total_amount was NULL for orders without discount, SUM might be less than total_revenue.
        // This logic assumes original_total_amount is populated correctly (equals total_amount if no discount).
        total_gross_revenue: parseFloat(aggregatesResult.rows[0].total_gross_revenue).toFixed(2),
    };

    // If original_total_amount could be null for non-discounted orders, adjust gross revenue calculation:
    // Gross = SUM(CASE WHEN original_total_amount IS NOT NULL THEN original_total_amount ELSE total_amount END)
    // Or, ensure original_total_amount always equals total_amount if no discount was applied.
    // The current DB schema for orders has original_total_amount as NULLABLE.
    // If discount_amount_applied is null, original_total_amount might also be null or same as total_amount.
    // The current insertion logic for orders sets original_total_amount = subtotal_for_items; total_amount = final_total_amount.
    // So, if no discount, original_total_amount should equal total_amount.
    // If discount applied, original_total_amount is pre-discount. This is correct.

    res.status(200).json({
      report_period: {
        start_date: startDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        end_date: new Date(end_date.getTime() - (23*60*60*1000 + 59*60*1000 + 59*1000 + 999)).toISOString().split('T')[0] // Format original end_date
      },
      summary: summary,
      orders: individualOrders
    });

  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ message: 'Failed to generate sales report.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/reports/tax-returns - Fetch total tax collected for a given period (month/quarter)
router.get('/tax-returns', async (req, res) => {
  // Validation and Logic will be implemented in subsequent steps.
  // For now, include basic structure.
  const { year, periodType, month, quarter } = req.query;

  try {
    // Placeholder for validation, date range calculation, query, and response formatting.
    res.status(200).json({
      message: 'Tax returns endpoint placeholder - logic to be implemented.',
      received_params: { year, periodType, month, quarter }
    });
  } catch (error) {
    console.error('Error generating tax returns report:', error);
    res.status(500).json({ message: 'Failed to generate tax returns report.' });
  }
});

module.exports = router;
