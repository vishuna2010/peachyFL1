const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../auth');
const db = require('../db');
const { AppError } = require('../utils/AppError');

// Apply authentication middleware to all routes
router.use(isAuthenticated);
router.use(isAdmin);

// Get total revenue
router.get('/total-revenue', async (req, res, next) => {
  try {
    const query = `
      SELECT COALESCE(SUM(total_amount), 0) as total_revenue
      FROM orders 
      WHERE status IN ('completed', 'delivered', 'dispatched')
    `;
    
    const result = await db.query(query);
    res.json({ total_revenue: result.rows[0].total_revenue });
  } catch (error) {
    next(new AppError('Failed to fetch total revenue', 500));
  }
});

// Get total orders count
router.get('/orders-count', async (req, res, next) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM orders
    `;
    
    const result = await db.query(query);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    next(new AppError('Failed to fetch orders count', 500));
  }
});

// Get total products count
router.get('/products-count', async (req, res, next) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM products
    `;
    
    const result = await db.query(query);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    next(new AppError('Failed to fetch products count', 500));
  }
});

// Get total users count
router.get('/users-count', async (req, res, next) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM users
    `;
    
    const result = await db.query(query);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    next(new AppError('Failed to fetch users count', 500));
  }
});

module.exports = router;
