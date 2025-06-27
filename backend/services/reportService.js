const db = require('../db');
const { AppError, BadRequestError } = require('../utils/AppError');

// Define relevant order statuses for different reports consistently
const VALID_SALE_STATUSES = ['shipped', 'delivered', 'completed'];
const VALID_TAXED_ORDER_STATUSES = ['processing', 'shipped', 'delivered', 'completed']; // May differ slightly based on when tax is considered "final"

/**
 * Generates a Low Stock Report.
 * @param {object} options - Filtering options (currently none, extensible).
 * @returns {Promise<object[]>} Array of low stock products.
 */
async function generateLowStockReport(options = {}) {
  // Future options: categoryId, supplierId, pagination
  try {
    const query = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.stock_quantity,
        p.reorder_threshold,
        p.updated_at,
        s.name AS supplier_name,
        (p.stock_quantity - p.reorder_threshold) AS stock_difference
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE
        p.reorder_threshold IS NOT NULL AND
        p.reorder_threshold > 0 AND
        p.stock_quantity <= p.reorder_threshold
      ORDER BY
        stock_difference ASC,
        p.name ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  } catch (error) {
    console.error('[ReportService.generateLowStockReport] Error:', error);
    throw new AppError('Failed to generate low stock products report.', 500, 'LOW_STOCK_REPORT_FAILED', { originalError: error.message });
  }
}

/**
 * Generates a Tax Report for a specified period.
 * @param {object} options - Report options: year, periodType, month, quarter.
 * @returns {Promise<object>} Tax report data.
 */
async function generateTaxReport(options = {}) {
  const { year, periodType, month, quarter } = options;

  // Validation of options should ideally be done by express-validator in the route
  // But a basic check here can be useful.
  if (!year || !periodType || (periodType === 'monthly' && !month) || (periodType === 'quarterly' && !quarter)) {
    throw new BadRequestError('Missing required parameters for tax report (year, periodType, and month/quarter).');
  }

  let startDate;
  let endDate;

  if (periodType === 'monthly') {
    startDate = new Date(Date.UTC(year, month - 1, 1));
    endDate = new Date(Date.UTC(year, month, 1));
  } else { // quarterly
    let startMonth;
    if (quarter === 1) startMonth = 0;      // Q1: Jan-Mar
    else if (quarter === 2) startMonth = 3; // Q2: Apr-Jun
    else if (quarter === 3) startMonth = 6; // Q3: Jul-Sep
    else startMonth = 9;                    // Q4: Oct-Dec
    startDate = new Date(Date.UTC(year, startMonth, 1));
    endDate = new Date(Date.UTC(year, startMonth + 3, 1));
  }

  const queryParams = [VALID_TAXED_ORDER_STATUSES, startDate.toISOString(), endDate.toISOString()];

  try {
    const query = `
      SELECT
        COALESCE(SUM(o.total_tax_amount), 0) as total_tax_for_period
      FROM orders o
      WHERE o.status = ANY($1::varchar[])
        AND o.created_at >= $2
        AND o.created_at < $3;
    `;
    const { rows } = await db.query(query, queryParams);
    const totalTax = rows[0] ? parseFloat(rows[0].total_tax_for_period).toFixed(2) : "0.00";

    return {
      report_parameters: {
        year,
        periodType,
        ...(month && { month }),
        ...(quarter && { quarter }),
        calculated_start_date: startDate.toISOString().split('T')[0],
        calculated_end_date: new Date(endDate.getTime() - 1).toISOString().split('T')[0] // Show last day of period
      },
      total_tax_for_period: totalTax
    };
  } catch (error) {
    console.error('[ReportService.generateTaxReport] Error:', error);
    throw new AppError('Failed to generate tax report.', 500, 'TAX_REPORT_FAILED', { originalError: error.message });
  }
}

/**
 * Generates an Invoice Export.
 * @param {object} options - Report options: startDate, endDate.
 * @returns {Promise<object[]>} Array of invoice export rows.
 */
async function generateInvoiceExport(options = {}) {
  const { startDate: startDateInput, endDate: endDateInput } = options;
  const queryParams = [];
  let dateConditions = "";
  let paramIndex = 1;

  if (startDateInput) {
    const startDateObj = new Date(startDateInput);
    // Basic validation, more robust in route
    if (isNaN(startDateObj.getTime())) throw new BadRequestError('Invalid start_date format.');
    queryParams.push(startDateObj.toISOString());
    dateConditions += ` AND o.created_at >= $${paramIndex++}`;
  }

  if (endDateInput) {
    const endDateObj = new Date(endDateInput);
    if (isNaN(endDateObj.getTime())) throw new BadRequestError('Invalid end_date format.');
    endDateObj.setUTCHours(23, 59, 59, 999); // End of day in UTC
    queryParams.push(endDateObj.toISOString());
    dateConditions += ` AND o.created_at <= $${paramIndex++}`;
  }

  queryParams.push(VALID_TAXED_ORDER_STATUSES); // Use VALID_TAXED_ORDER_STATUSES defined above
  const statusCondition = `o.status = ANY($${paramIndex++}::varchar[])`;

  try {
    const query = `
      SELECT
        o.id as order_id, o.created_at as order_date, o.status as order_status, o.payment_status,
        u.email as customer_email, u.name as customer_name,
        o.billing_country, o.billing_state_province_region, o.billing_city, o.billing_postal_code,
        o.shipping_country, o.shipping_state_province_region, o.shipping_city, o.shipping_postal_code,
        oi.id as line_item_id, p.sku as product_sku, p.name as product_name, pv.sku as variant_sku,
        oi.quantity, oi.price_at_purchase as exclusive_unit_price,
        (oi.quantity * oi.price_at_purchase) as line_item_exclusive_subtotal,
        oi.line_item_tax_amount,
        ((oi.quantity * oi.price_at_purchase) + oi.line_item_tax_amount) as line_item_total_inclusive_of_tax,
        o.original_total_amount as order_exclusive_subtotal_before_discount,
        o.discount_amount_applied as order_discount_amount,
        o.total_tax_amount as order_total_tax,
        o.total_amount as order_grand_total,
        oi.tax_class_id_at_purchase, tc.name as tax_class_name_at_purchase,
        oi.applied_tax_rate_percentage as line_item_effective_tax_rate,
        o.tax_summary_details as order_tax_summary_json
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN tax_classes tc ON oi.tax_class_id_at_purchase = tc.id
      WHERE ${statusCondition} ${dateConditions}
      ORDER BY o.id ASC, oi.id ASC;
    `;
    const { rows } = await db.query(query, queryParams);
    return rows;
  } catch (error) {
    console.error('[ReportService.generateInvoiceExport] Error:', error);
    throw new AppError('Failed to generate invoice export.', 500, 'INVOICE_EXPORT_FAILED', { originalError: error.message });
  }
}

/**
 * Generates a Tax Summary by Region Report.
 * @param {object} options - Report options: startDate, endDate.
 * @returns {Promise<object[]>} Array of tax summary rows by region.
 */
async function generateTaxSummaryByRegionReport(options = {}) {
  const { startDate: startDateInput, endDate: endDateInput } = options;
  const queryParams = [];
  let dateConditions = "";
  let paramIndex = 1;

  if (startDateInput) {
    const startDateObj = new Date(startDateInput);
    if (isNaN(startDateObj.getTime())) throw new BadRequestError('Invalid start_date format.');
    queryParams.push(startDateObj.toISOString());
    dateConditions += ` AND o.created_at >= $${paramIndex++}`;
  }

  if (endDateInput) {
    const endDateObj = new Date(endDateInput);
    if (isNaN(endDateObj.getTime())) throw new BadRequestError('Invalid end_date format.');
    endDateObj.setUTCHours(23, 59, 59, 999); // End of day in UTC
    queryParams.push(endDateObj.toISOString());
    dateConditions += ` AND o.created_at <= $${paramIndex++}`;
  }

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
    const { rows } = await db.query(query, queryParams);
    return rows.map(row => ({
        country: row.billing_country,
        region: row.billing_state_province_region || 'N/A',
        total_tax_collected: parseFloat(row.total_tax_collected).toFixed(2),
        total_orders_contributing_tax: parseInt(row.total_orders_contributing_tax)
    }));
  } catch (error) {
    console.error('[ReportService.generateTaxSummaryByRegionReport] Error:', error);
    throw new AppError('Failed to generate tax summary by region report.', 500, 'TAX_SUMMARY_REGION_FAILED', { originalError: error.message });
  }
}

/**
 * Generates a Best Sellers Report.
 * @param {object} options - Report options: limit, startDate, endDate, sortByMetric.
 * @returns {Promise<object[]>} Array of best-selling products.
 */
async function generateBestSellersReport(options = {}) {
  const {
    limit = 10,
    startDate: startDateInput,
    endDate: endDateInput,
    sortByMetric = 'quantity'
  } = options;

  const queryParams = [];
  let paramIndex = 1;
  let dateConditions = "";

  if (startDateInput) {
    const startDateObj = new Date(startDateInput);
    if (isNaN(startDateObj.getTime())) throw new BadRequestError('Invalid start_date format.');
    queryParams.push(startDateObj.toISOString());
    dateConditions += ` AND o.created_at >= $${paramIndex++}`;
  }
  if (endDateInput) {
    const endDateObj = new Date(endDateInput);
    if (isNaN(endDateObj.getTime())) throw new BadRequestError('Invalid end_date format.');
    endDateObj.setUTCHours(23, 59, 59, 999);
    queryParams.push(endDateObj.toISOString());
    dateConditions += ` AND o.created_at <= $${paramIndex++}`;
  }

  queryParams.push(VALID_SALE_STATUSES);
  const statusCondition = `o.status = ANY($${paramIndex++}::varchar[])`;

  let orderBySql;
  if (sortByMetric.toLowerCase() === 'revenue') {
    orderBySql = 'total_revenue_generated DESC';
  } else {
    orderBySql = 'total_quantity_sold DESC';
  }

  queryParams.push(limit); // Add limit as the last parameter

  try {
    const query = `
      SELECT
        oi.product_id, p.name AS product_name, p.sku AS product_sku,
        SUM(oi.quantity) AS total_quantity_sold,
        SUM(oi.quantity * oi.price_at_purchase) AS total_revenue_generated
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE ${statusCondition} ${dateConditions}
      GROUP BY oi.product_id, p.name, p.sku
      ORDER BY ${orderBySql}, p.name ASC
      LIMIT $${paramIndex};
    `;
    // Note: In adminReports.js, quantity was oi.quantity_ordered. Assuming oi.quantity is correct for order_items
    // Corrected sum to use oi.quantity (standard for order_items)
    const { rows } = await db.query(query, queryParams);
    return rows.map(r => ({
      ...r,
      total_quantity_sold: parseInt(r.total_quantity_sold),
      total_revenue_generated: parseFloat(r.total_revenue_generated).toFixed(2)
    }));
  } catch (error) {
    console.error('[ReportService.generateBestSellersReport] Error:', error);
    throw new AppError('Failed to generate best sellers report.', 500, 'BEST_SELLERS_REPORT_FAILED', { originalError: error.message });
  }
}

/**
 * Generates a Sales Report.
 * @param {object} options - Report options: startDate, endDate.
 * @returns {Promise<object>} Sales report data including summary and individual orders.
 */
async function generateSalesReport(options = {}) {
  const { startDate: startDateInput, endDate: endDateInput } = options;

  if (!startDateInput || !endDateInput) {
    throw new BadRequestError('Both startDate and endDate are required for sales report.');
  }
  const startDate = new Date(startDateInput);
  const endDateOriginal = new Date(endDateInput); // Keep original for report parameters
  const endDateQuery = new Date(endDateInput);   // Use this for query adjustment

  if (isNaN(startDate.getTime()) || isNaN(endDateOriginal.getTime())) {
    throw new BadRequestError('Invalid date format.');
  }
  endDateQuery.setUTCHours(23, 59, 59, 999);


  const client = await db.pool.connect(); // Use a client for multiple queries
  try {
    const ordersQuery = `
      SELECT id, user_id, total_amount, original_total_amount, discount_amount_applied, status, created_at,
             shipping_address_line1, shipping_address_line2, shipping_city, shipping_state_province_region, shipping_postal_code, shipping_country,
             billing_address_line1, billing_address_line2, billing_city, billing_state_province_region, billing_postal_code, billing_country,
             user_email, payment_method, payment_status, invoice_number
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2 AND status = ANY($3::varchar[])
      ORDER BY created_at DESC;
    `;
    const ordersResult = await client.query(ordersQuery, [startDate.toISOString(), endDateQuery.toISOString(), VALID_SALE_STATUSES]);

    const aggregatesQuery = `
      SELECT
        COUNT(*) AS total_orders_count,
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(discount_amount_applied), 0) AS total_discount_given,
        COALESCE(SUM(original_total_amount), 0) AS total_gross_revenue,
        COALESCE(SUM(total_tax_amount),0) AS total_tax_collected,
        COALESCE(SUM(shipping_cost),0) AS total_shipping_charged
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2 AND status = ANY($3::varchar[]);
    `;
    const aggregatesResult = await client.query(aggregatesQuery, [startDate.toISOString(), endDateQuery.toISOString(), VALID_SALE_STATUSES]);

    const summary = {
        total_orders_count: parseInt(aggregatesResult.rows[0].total_orders_count),
        total_revenue: parseFloat(aggregatesResult.rows[0].total_revenue).toFixed(2),
        total_discount_given: parseFloat(aggregatesResult.rows[0].total_discount_given).toFixed(2),
        total_gross_revenue: parseFloat(aggregatesResult.rows[0].total_gross_revenue).toFixed(2),
        total_tax_collected: parseFloat(aggregatesResult.rows[0].total_tax_collected).toFixed(2),
        total_shipping_charged: parseFloat(aggregatesResult.rows[0].total_shipping_charged).toFixed(2),
    };

    return {
      report_period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDateOriginal.toISOString().split('T')[0]
      },
      summary: summary,
      orders: ordersResult.rows
    };
  } catch (error) {
    console.error('[ReportService.generateSalesReport] Error:', error);
    throw new AppError('Failed to generate sales report.', 500, 'SALES_REPORT_FAILED', { originalError: error.message });
  } finally {
    client.release();
  }
}

module.exports = {
  generateLowStockReport,
  generateTaxReport,
  generateInvoiceExport,
  generateTaxSummaryByRegionReport,
  generateBestSellersReport,
  generateSalesReport
};
