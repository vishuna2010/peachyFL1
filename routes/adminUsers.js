const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// All routes in this file are protected by isAuthenticated and isAdmin
router.use(isAuthenticated, isAdmin);

// GET /api/admin/users - List all users
router.get('/', async (req, res) => {
  try {
    // Exclude password hashes from the output
    const result = await db.query('SELECT id, email, role, created_at FROM users ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ message: 'Error listing users.' });
  }
});

// GET /api/admin/users/:id - View a specific user
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }
  try {
    const result = await db.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    res.status(500).json({ message: 'Error fetching user.' });
  }
});

// PUT /api/admin/users/:id/role - Update a user's role
router.put('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }
  if (!role || typeof role !== 'string') {
    return res.status(400).json({ message: 'Role is required and must be a string.' });
  }
  // Potentially add validation for allowed roles: e.g., ['customer', 'admin']
  const allowedRoles = ['customer', 'admin']; // Define acceptable roles
  if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Allowed roles are: ${allowedRoles.join(', ')}`});
  }

  // Prevent admin from accidentally changing their own role in a way that locks them out?
  // Or prevent changing superadmin roles etc. For now, simple update.
  // if (parseInt(id) === req.user.userId && role !== 'admin') {
  //   return res.status(400).json({ message: "Admins cannot change their own role to non-admin via this endpoint." });
  // }


  try {
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({ message: 'User role updated successfully.', user: result.rows[0] });
  } catch (error) {
    console.error(`Error updating role for user ${id}:`, error);
    res.status(500).json({ message: 'Error updating user role.' });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }

  // Prevent admin from deleting themselves?
  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ message: "Cannot delete currently logged-in admin user." });
  }

  try {
    // Consider what happens to related data (e.g., orders).
    // Foreign key constraints with ON DELETE CASCADE or ON DELETE SET NULL would handle this at DB level.
    // For products, if user_id was linked, it would be relevant.
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({ message: 'User deleted successfully.', user: result.rows[0] });
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error);
    // Check for foreign key constraint violations if user is referenced elsewhere
    if (error.code === '23503') { // foreign_key_violation
        return res.status(409).json({ message: 'Cannot delete user: They are referenced in other records (e.g., products, orders). Please reassign or delete those records first.' });
    }
    res.status(500).json({ message: 'Error deleting user.' });
  }
});

module.exports = router;
