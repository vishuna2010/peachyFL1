const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

// POST /api/admin/suppliers - Create a new supplier
router.post('/', async (req, res) => {
  const {
    name, contact_person, email, phone,
    address_line1, address_line2, city, postal_code, country, notes
  } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'Supplier name is required and must be a non-empty string.' });
  }
  // Email validation (basic)
  if (email && typeof email !== 'string') { // Could add more robust email format validation
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  const client = await db.pool.connect();
  try {
    const insertQuery = `
      INSERT INTO suppliers
        (name, contact_person, email, phone, address_line1, address_line2, city, postal_code, country, notes, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [
      name.trim(), contact_person || null, email ? email.trim() : null, phone || null,
      address_line1 || null, address_line2 || null, city || null, postal_code || null, country || null, notes || null
    ];

    const result = await client.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'suppliers_name_key') {
        return res.status(409).json({ message: 'Supplier name already exists.' });
      }
      if (error.constraint === 'suppliers_email_key') {
        return res.status(409).json({ message: 'Supplier email already exists.' });
      }
    }
    console.error('Error creating supplier:', error);
    res.status(500).json({ message: 'Failed to create supplier.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/suppliers - List all suppliers
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20; // Default limit
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM suppliers');
    const totalSuppliers = parseInt(countResult.rows[0].count);

    const result = await db.query('SELECT * FROM suppliers ORDER BY name ASC LIMIT $1 OFFSET $2', [limit, offset]);

    res.status(200).json({
        data: result.rows,
        pagination: {
            total: totalSuppliers,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalSuppliers / limit)
        }
    });
  } catch (error) {
    console.error('Error listing suppliers:', error);
    res.status(500).json({ message: 'Failed to retrieve suppliers.' });
  }
});

// GET /api/admin/suppliers/:id - Get a specific supplier
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid supplier ID format.' });
  }
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: `Supplier with ID ${id} not found.` });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching supplier ${id}:`, error);
    res.status(500).json({ message: 'Failed to retrieve supplier.' });
  }
});

// PUT /api/admin/suppliers/:id - Update a supplier
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid supplier ID format.' });
  }

  const {
    name, contact_person, email, phone,
    address_line1, address_line2, city, postal_code, country, notes
  } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const currentSupplier = await client.query('SELECT * FROM suppliers WHERE id = $1 FOR UPDATE', [id]);
    if (currentSupplier.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Supplier with ID ${id} not found.` });
    }

    // Build dynamic query
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        await client.query('ROLLBACK'); return res.status(400).json({ message: 'Supplier name must be a non-empty string.' });
      }
      setClauses.push(`name = $${paramIndex++}`); values.push(name.trim());
    }
    if (contact_person !== undefined) { setClauses.push(`contact_person = $${paramIndex++}`); values.push(contact_person); }
    if (email !== undefined) {
      if (email !== null && typeof email !== 'string') { // Basic email format check could be added
         await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid email format.' });
      }
      setClauses.push(`email = $${paramIndex++}`); values.push(email ? email.trim() : null);
    }
    if (phone !== undefined) { setClauses.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (address_line1 !== undefined) { setClauses.push(`address_line1 = $${paramIndex++}`); values.push(address_line1); }
    if (address_line2 !== undefined) { setClauses.push(`address_line2 = $${paramIndex++}`); values.push(address_line2); }
    if (city !== undefined) { setClauses.push(`city = $${paramIndex++}`); values.push(city); }
    if (postal_code !== undefined) { setClauses.push(`postal_code = $${paramIndex++}`); values.push(postal_code); }
    if (country !== undefined) { setClauses.push(`country = $${paramIndex++}`); values.push(country); }
    if (notes !== undefined) { setClauses.push(`notes = $${paramIndex++}`); values.push(notes); }


    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const updateQuery = `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    values.push(id);

    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');
    res.status(200).json(result.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'suppliers_name_key') {
        return res.status(409).json({ message: 'Another supplier with this name already exists.' });
      }
      if (error.constraint === 'suppliers_email_key') {
        return res.status(409).json({ message: 'Another supplier with this email already exists.' });
      }
    }
    console.error(`Error updating supplier ${id}:`, error);
    res.status(500).json({ message: 'Failed to update supplier.' });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/suppliers/:id - Delete a supplier
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid supplier ID format.' });
  }
  try {
    // If supplier_id was added to products table with ON DELETE SET NULL, this is fine.
    // If ON DELETE RESTRICT, this would fail if supplier is linked to products.
    // Application logic would need to handle reassigning products or deleting them first.
    const result = await db.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Supplier with ID ${id} not found.` });
    }
    res.status(200).json({ message: 'Supplier deleted successfully.', supplier: result.rows[0] }); // Or 204 No Content
  } catch (error) {
    console.error(`Error deleting supplier ${id}:`, error);
    // Handle foreign key constraint errors if products.supplier_id uses ON DELETE RESTRICT
    if (error.code === '23503') { // foreign_key_violation
        return res.status(409).json({ message: 'Cannot delete supplier: They are referenced by products or other records. Please reassign or delete those records first.' });
    }
    res.status(500).json({ message: 'Failed to delete supplier.' });
  }
});

module.exports = router;
