const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

const ALLOWED_DISCOUNT_TYPES = ['percentage', 'fixed_amount'];

// POST /api/admin/discounts - Create a new discount code
router.post('/', async (req, res) => {
  const {
    code, type, value, description, is_active = true,
    valid_from, valid_until, usage_limit, min_order_amount
  } = req.body;

  // Validation
  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ message: 'Discount code is required and must be a non-empty string.' });
  }
  if (!type || !ALLOWED_DISCOUNT_TYPES.includes(type.toLowerCase())) {
    return res.status(400).json({ message: `Invalid discount type. Allowed types: ${ALLOWED_DISCOUNT_TYPES.join(', ')}` });
  }
  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue <= 0) {
    return res.status(400).json({ message: 'Discount value must be a positive number.' });
  }
  if (type.toLowerCase() === 'percentage' && (numValue < 0 || numValue > 100)) {
    return res.status(400).json({ message: 'Percentage discount value must be between 0 and 100.' });
  }
  if (usage_limit !== null && usage_limit !== undefined && (isNaN(parseInt(usage_limit)) || parseInt(usage_limit) < 0)) {
    return res.status(400).json({ message: 'Usage limit must be a non-negative integer if provided.' });
  }
  if (min_order_amount !== null && min_order_amount !== undefined && (isNaN(parseFloat(min_order_amount)) || parseFloat(min_order_amount) < 0)) {
    return res.status(400).json({ message: 'Minimum order amount must be a non-negative number if provided.' });
  }
  // Date validations can be more complex (e.g., valid_until after valid_from)
  // For now, just check if they are valid date strings if provided
  if (valid_from && isNaN(new Date(valid_from).getTime())) {
    return res.status(400).json({ message: 'Invalid valid_from date format.' });
  }
  if (valid_until && isNaN(new Date(valid_until).getTime())) {
    return res.status(400).json({ message: 'Invalid valid_until date format.' });
  }


  const client = await db.pool.connect();
  try {
    const insertQuery = `
      INSERT INTO discounts
        (code, type, value, description, is_active, valid_from, valid_until, usage_limit, min_order_amount, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [
      code.trim().toUpperCase(), // Store codes in uppercase for consistency
      type.toLowerCase(),
      numValue,
      description || null,
      typeof is_active === 'boolean' ? is_active : true,
      valid_from || null,
      valid_until || null,
      usage_limit !== null && usage_limit !== undefined ? parseInt(usage_limit) : null,
      min_order_amount !== null && min_order_amount !== undefined ? parseFloat(min_order_amount) : null,
    ];

    const result = await client.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (e.g., code already exists)
      return res.status(409).json({ message: 'Discount code already exists.' });
    }
    console.error('Error creating discount code:', error);
    res.status(500).json({ message: 'Failed to create discount code.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/discounts - List all discount codes
router.get('/', async (req, res) => {
  // Basic pagination (optional for this step, but good for future)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM discounts');
    const totalDiscounts = parseInt(countResult.rows[0].count);

    const result = await db.query('SELECT * FROM discounts ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.status(200).json({
        data: result.rows,
        pagination: {
            total: totalDiscounts,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalDiscounts / limit)
        }
    });
  } catch (error) {
    console.error('Error listing discount codes:', error);
    res.status(500).json({ message: 'Failed to retrieve discount codes.' });
  }
});

// GET /api/admin/discounts/:id - Get a specific discount code
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid discount ID format.' });
  }
  try {
    const result = await db.query('SELECT * FROM discounts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: `Discount code with ID ${id} not found.` });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching discount code ${id}:`, error);
    res.status(500).json({ message: 'Failed to retrieve discount code.' });
  }
});

// PUT /api/admin/discounts/:id - Update a discount code
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid discount ID format.' });
  }

  const {
    type, value, description, is_active,
    valid_from, valid_until, usage_limit, min_order_amount
  } = req.body;

  // Note: 'code' is not updatable. 'times_used' is updated by order logic, not manually here.

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const currentDiscount = await client.query('SELECT * FROM discounts WHERE id = $1 FOR UPDATE', [id]);
    if (currentDiscount.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Discount code with ID ${id} not found.` });
    }

    // Build dynamic query
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (type !== undefined) {
      if (!ALLOWED_DISCOUNT_TYPES.includes(type.toLowerCase())) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid discount type. Allowed types: ${ALLOWED_DISCOUNT_TYPES.join(', ')}` });
      }
      setClauses.push(`type = $${paramIndex++}`);
      values.push(type.toLowerCase());
    }
    if (value !== undefined) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Discount value must be a positive number.' });
      }
      const currentType = type !== undefined ? type.toLowerCase() : currentDiscount.rows[0].type;
      if (currentType === 'percentage' && (numValue < 0 || numValue > 100)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Percentage discount value must be between 0 and 100.' });
      }
      setClauses.push(`value = $${paramIndex++}`);
      values.push(numValue);
    }
    if (description !== undefined) { setClauses.push(`description = $${paramIndex++}`); values.push(description); }
    if (is_active !== undefined) { setClauses.push(`is_active = $${paramIndex++}`); values.push(Boolean(is_active)); }
    if (valid_from !== undefined) {
        if (valid_from !== null && isNaN(new Date(valid_from).getTime())) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid valid_from date format.' });}
        setClauses.push(`valid_from = $${paramIndex++}`); values.push(valid_from || null);
    }
    if (valid_until !== undefined) {
        if (valid_until !== null && isNaN(new Date(valid_until).getTime())) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid valid_until date format.' });}
        setClauses.push(`valid_until = $${paramIndex++}`); values.push(valid_until || null);
    }
    if (usage_limit !== undefined) {
        if (usage_limit !== null && (isNaN(parseInt(usage_limit)) || parseInt(usage_limit) < 0)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Usage limit must be a non-negative integer if provided.' });}
        setClauses.push(`usage_limit = $${paramIndex++}`); values.push(usage_limit !== null ? parseInt(usage_limit) : null);
    }
    if (min_order_amount !== undefined) {
        if (min_order_amount !== null && (isNaN(parseFloat(min_order_amount)) || parseFloat(min_order_amount) < 0)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Minimum order amount must be a non-negative number if provided.' });}
        setClauses.push(`min_order_amount = $${paramIndex++}`); values.push(min_order_amount !== null ? parseFloat(min_order_amount) : null);
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`); // Always update this

    const updateQuery = `UPDATE discounts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    values.push(id);

    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');
    res.status(200).json(result.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK'); // Ensure rollback on any other error
    console.error(`Error updating discount code ${id}:`, error);
    res.status(500).json({ message: 'Failed to update discount code.' });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/discounts/:id - Delete a discount code
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid discount ID format.' });
  }
  try {
    // For now, hard delete. Consider soft delete (setting is_active = false) in a real app
    // if discount history or association with past orders is important to preserve.
    const result = await db.query('DELETE FROM discounts WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Discount code with ID ${id} not found.` });
    }
    res.status(200).json({ message: 'Discount code deleted successfully.', discount: result.rows[0] });
  } catch (error) {
    console.error(`Error deleting discount code ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete discount code.' });
  }
});

module.exports = router;
