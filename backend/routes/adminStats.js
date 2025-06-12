const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth'); // Corrected import path

// Middleware to protect all routes in this file
router.use(isAuthenticated, isAdmin);

// GET /api/admin/stats/users-count - Total Users
router.get('/users-count', async (req, res, next) => {
  try {
    const result = await db.query('SELECT COUNT(*) AS count FROM users;');
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching total users count:', error);
    next(error); // Pass error to global error handler
  }
});

// GET /api/admin/stats/orders-count - Total Orders
router.get('/orders-count', async (req, res, next) => {
  try {
    const result = await db.query('SELECT COUNT(*) AS count FROM orders;');
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching total orders count:', error);
    next(error);
  }
});

// GET /api/admin/stats/products-count - Total Products
router.get('/products-count', async (req, res, next) => {
  try {
    const result = await db.query('SELECT COUNT(*) AS count FROM products;');
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching total products count:', error);
    next(error);
  }
});

// GET /api/admin/stats/total-revenue - Total Revenue
router.get('/total-revenue', async (req, res, next) => {
  try {
    // Assuming 'Completed', 'Shipped', 'Delivered' are statuses that contribute to revenue.
    // Adjust statuses if your application uses different ones.
    const result = await db.query(
      "SELECT SUM(total_amount) AS total_revenue FROM orders WHERE status IN ('Completed', 'Shipped', 'Delivered');"
    );
    let totalRevenue = 0;
    if (result.rows.length > 0 && result.rows[0].total_revenue !== null) {
      totalRevenue = parseFloat(result.rows[0].total_revenue);
    }
    res.json({ total_revenue: totalRevenue });
  } catch (error) {
    console.error('Error fetching total revenue:', error);
    next(error);
  }
});

module.exports = router;
