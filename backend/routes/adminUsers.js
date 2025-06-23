const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth'); // Updated: isAdmin removed, checkPermission added
const auditLogService = require('../services/auditLogService');
const { query, body, param, validationResult } = require('express-validator');
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/AppError');

const bcrypt = require('bcrypt'); // For password hashing

// All routes in this file are protected by isAuthenticated and isAdmin
// router.use(isAuthenticated, isAdmin); // REMOVED: Will apply isAuthenticated and checkPermission per route

// POST /api/admin/users - Create a new user by an admin
router.post(
  '/',
  isAuthenticated,
  checkPermission('users:create'),
  [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    // Optional: Add more password strength rules, e.g., .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/) for uppercase, lowercase, number
    body('name').isString().trim().notEmpty().withMessage('Name is required.'),
    body('role_id').isInt({ gt: 0 }).withMessage('Valid Role ID is required.').toInt() // Expect role_id
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role_id } = req.body; // Use role_id
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if email already exists
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return next(new ConflictError('A user with this email address already exists.'));
      }

      // Verify role_id exists
      const roleCheck = await client.query('SELECT name FROM roles WHERE id = $1', [role_id]);
      if (roleCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return next(new BadRequestError(`Role with ID ${role_id} does not exist.`));
      }
      const newRoleName = roleCheck.rows[0].name;


      // Hash password
      const saltRounds = 10; // Standard salt rounds
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert new user with role_id and also populate the legacy 'role' column
      const insertQuery = `
        INSERT INTO users (name, email, password, role_id, role, is_tax_exempt)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, email, role_id, role as legacy_role, is_tax_exempt, created_at, updated_at;
      `;
      // New users created by admin are not tax-exempt by default unless specified otherwise.
      const result = await client.query(insertQuery, [name, email, hashedPassword, role_id, newRoleName, false]);
      const newUser = result.rows[0];

      await client.query('COMMIT');

      // Audit log
      auditLogService.recordAuditEvent(
        'ADMIN_USER_CREATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: newUser.id },
        { createdUserEmail: newUser.email, createdUserRoleId: newUser.role_id, createdUserRoleName: newRoleName },
        req
      ).catch(err => console.error('Audit log failed for ADMIN_USER_CREATE_SUCCESS:', err));

      // Exclude password from the response, add role_name
      const { password: _, ...userResponseData } = newUser;
      userResponseData.role_name = newRoleName; // Add role_name to the response for clarity
      res.status(201).json(userResponseData);

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'users_email_key') { // PostgreSQL unique violation
        return next(new ConflictError('A user with this email address already exists (database constraint).'));
      }
      console.error('Error creating user by admin:', error);
      next(new AppError('Failed to create user.', 500, error));
    } finally {
      client.release();
    }
  }
);

// GET /api/admin/users - List all users
router.get(
  '/',
  isAuthenticated,
  checkPermission('users:view'),
  [
    query('role').optional().isString().trim().isIn(['admin', 'customer', 'user', 'guest']).withMessage('Invalid role specified.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role } = req.query;
    let queryString = 'SELECT id, name, email, role, is_tax_exempt, tax_exemption_certificate_id, tax_exemption_notes, created_at, updated_at FROM users';
    const queryParams = [];

    if (role) {
      queryString += ' WHERE role = $1';
      queryParams.push(role);
    }

    queryString += ' ORDER BY id ASC';

    try {
      const result = await db.query(queryString, queryParams);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error listing users:', error);
      // Pass to global error handler or keep specific response
      next(new AppError('Error listing users.', 500, error));
    }
  }
);

// GET /api/admin/users/:id - View a specific user
router.get('/:id', isAuthenticated, checkPermission('users:view'), async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    // This basic validation can be enhanced with express-validator's param('id').isInt() if desired,
    // similar to how it's used in other routes, for consistency.
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }
  try {
    const result = await db.query('SELECT id, name, email, role, is_tax_exempt, tax_exemption_certificate_id, tax_exemption_notes, created_at, updated_at FROM users WHERE id = $1', [id]);
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
router.put('/:id/role', isAuthenticated, checkPermission('users:assign_roles'), async (req, res) => {
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
    const updatedUser = result.rows[0];
    auditLogService.recordAuditEvent(
      'USER_ROLE_UPDATE_SUCCESS',
      { userId: req.user.userId, userEmail: req.user.email },
      { resourceType: 'USER', resourceId: updatedUser.id },
      {
        message: `User ID ${updatedUser.id} role updated to ${updatedUser.role}.`,
        updated_role: updatedUser.role
      },
      req
    ).catch(err => console.error('Audit log failed for USER_ROLE_UPDATE_SUCCESS:', err));
    res.status(200).json({ message: 'User role updated successfully.', user: updatedUser });
  } catch (error) {
    console.error(`Error updating role for user ${id}:`, error);
    res.status(500).json({ message: 'Error updating user role.' });
  }
});

// PUT /api/admin/users/:id - Update user details
router.put(
  '/:id',
  isAuthenticated,
  checkPermission('users:edit'),
  [
    param('id').isInt({ gt: 0 }).toInt(),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 chars.'),
    body('email').optional().isEmail().withMessage('Must be a valid email.').normalizeEmail(),
    // body('role').optional().isIn(['user', 'admin']).withMessage("Role must be 'user' or 'admin'."), // Old: string role
    body('role_id').optional().isInt({ gt: 0 }).withMessage('Role ID must be a positive integer.').toInt(), // New: role_id
    body('is_tax_exempt').optional().isBoolean().toBoolean(),
    body('tax_exemption_certificate_id').optional({ nullable: true }).isString().trim()
      .isLength({ max: 100 }).withMessage('Tax exemption certificate ID cannot exceed 100 characters.'),
    body('tax_exemption_notes').optional({ nullable: true }).isString().trim()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return next(new BadRequestError('No fields provided for update.'));
    }

    // Prevent admin from changing their own role to a non-admin role
    // This requires knowing the ID of the 'Super Admin' or general 'admin' roles.
    // Let's assume 'Super Admin' role ID is fetched or known (e.g., from seededDataIds if this were seed, or a helper)
    // For now, we'll make a simple check. A more robust check would query the target role_id's name.
    if (updates.role_id && parseInt(id) === req.user.userId) {
        // Fetch the name of the role being assigned
        const targetRoleResult = await db.query('SELECT name FROM roles WHERE id = $1', [updates.role_id]);
        if (targetRoleResult.rows.length > 0 && targetRoleResult.rows[0].name.toLowerCase() !== 'super admin' && targetRoleResult.rows[0].name.toLowerCase() !== 'admin') {
             // Fetch current user's role name to ensure they are currently an admin type
            const currentUserRoleResult = await db.query('SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [req.user.userId]);
            if (currentUserRoleResult.rows.length > 0 && (currentUserRoleResult.rows[0].name.toLowerCase() === 'super admin' || currentUserRoleResult.rows[0].name.toLowerCase() === 'admin')) {
                return next(new BadRequestError("Administrators cannot change their own role to a non-administrator role."));
            }
        }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const currentUserResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (currentUserResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new NotFoundError(`User with ID ${id} not found.`);
      }
      const currentUser = currentUserResult.rows[0];

      if (updates.email && updates.email.toLowerCase() !== currentUser.email.toLowerCase()) {
        const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [updates.email, id]);
        if (existingUser.rows.length > 0) {
          await client.query('ROLLBACK');
          throw new ConflictError('This email address is already in use by another account.');
        }
      }

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      // Updated fieldsToUpdate to use role_id instead of role
      const fieldsToUpdate = ['name', 'email', 'role_id', 'is_tax_exempt', 'tax_exemption_certificate_id', 'tax_exemption_notes'];
      for (const field of fieldsToUpdate) {
        if (updates[field] !== undefined) {
          if (field === 'tax_exemption_certificate_id' && updates[field] === '') updates[field] = null;
          if (field === 'tax_exemption_notes' && updates[field] === '') updates[field] = null;
          // Ensure role_id is handled as an integer if present
          if (field === 'role_id' && updates[field] !== null) {
             values.push(parseInt(updates[field],10));
          } else {
            values.push(updates[field]);
          }
          setClauses.push(`${field} = $${paramIndex++}`);
        }
      }

      if (setClauses.length === 0) {
        await client.query('ROLLBACK');
        // Fetch user with role name for consistent response
        const userWithRoleName = await client.query('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [currentUser.id]);
        return res.status(200).json(userWithRoleName.rows[0] || currentUser);
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id); // For WHERE id = $N

      const updateQuery = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id;`; // Only need ID to refetch
      await client.query(updateQuery, values);

      await client.query('COMMIT');

      // Re-fetch the user to get the role name and other fresh details
      const updatedUserResult = await db.query(
        `SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.is_tax_exempt,
                u.tax_exemption_certificate_id, u.tax_exemption_notes, u.created_at, u.updated_at, u.role as legacy_role
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`, [id]
      );
      const finalUpdatedUserWithRole = updatedUserResult.rows[0];


      const attemptedChanges = { ...updates };
      // Clean up sensitive fields if necessary

      auditLogService.recordAuditEvent(
        'USER_UPDATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: finalUpdatedUserWithRole.id },
        {
          message: `User ID ${finalUpdatedUserWithRole.id} details updated by admin.`,
          inputData: attemptedChanges,
          updatedSnapshot: {
              name: finalUpdatedUserWithRole.name,
              email: finalUpdatedUserWithRole.email,
              role_id: finalUpdatedUserWithRole.role_id,
              role_name: finalUpdatedUserWithRole.role_name, // Include role name
              is_tax_exempt: finalUpdatedUserWithRole.is_tax_exempt
          }
        },
        req
      ).catch(err => console.error('Audit log failed for USER_UPDATE_SUCCESS:', err));
      res.status(200).json(finalUpdatedUserWithRole);

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        return next(new ConflictError('This email address is already in use by another account (database constraint).'));
      }
      next(error);
    } finally {
      client.release();
    }
  }
);

// DELETE /api/admin/users/:id - Delete a user
router.delete('/:id', isAuthenticated, checkPermission('users:delete'), async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    // Consider using express-validator for param validation here too for consistency
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
    const deletedUserInfo = result.rows[0];
    auditLogService.recordAuditEvent(
      'USER_DELETE_SUCCESS',
      { userId: req.user.userId, userEmail: req.user.email },
      { resourceType: 'USER', resourceId: deletedUserInfo.id },
      { deletedUserEmail: deletedUserInfo.email },
      req
    ).catch(err => console.error('Audit log failed for USER_DELETE_SUCCESS:', err));
    res.status(200).json({ message: 'User deleted successfully.', user: deletedUserInfo });
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
