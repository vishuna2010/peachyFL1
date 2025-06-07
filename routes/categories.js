const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/categories - Fetch all categories
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name FROM categories ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories.' });
  }
});

module.exports = router;
