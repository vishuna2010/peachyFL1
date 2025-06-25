console.log("ADMIN USERS ROUTE FILE LOADED - VERSION MNO"); // NEW VERSION MARKER
const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth');
const permissionService = require('../services/permissionService');
const auditLogService = require('../services/auditLogService');
const { query, body, param, validationResult } = require('express-validator');
const { ConflictError, NotFoundError, BadRequestError, AppError } = require('../utils/AppError');
const bcrypt = require('bcrypt');

// POST /api/admin/users - Create a new user by an admin
router.post(
  '/',
  isAuthenticated,
  checkPermission('users:create'),
  [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    body('name').isString().trim().notEmpty().withMessage('Name is required.'),
    body('role_id').isInt({ gt: 0 }).withMessage('Valid Role ID is required.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role_id } = req.body;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return next(new ConflictError('A user with this email address already exists.'));
      }
      const roleCheck = await client.query('SELECT name FROM roles WHERE id = $1', [role_id]);
      if (roleCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return next(new BadRequestError(`Role with ID ${role_id} does not exist.`));
      }
      const newRoleName = roleCheck.rows[0].name;
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const insertQuery = `
        INSERT INTO users (name, email, password, role_id, role, is_tax_exempt)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, email, role_id, role as legacy_role, is_tax_exempt, created_at, updated_at;
      `;
      const result = await client.query(insertQuery, [name, email, hashedPassword, role_id, newRoleName, false]);
      const newUser = result.rows[0];
      await client.query('COMMIT');
      auditLogService.recordAuditEvent(
        'ADMIN_USER_CREATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: newUser.id },
        { createdUserEmail: newUser.email, createdUserRoleId: newUser.role_id, createdUserRoleName: newRoleName },
        req
      ).catch(err => console.error('Audit log failed for ADMIN_USER_CREATE_SUCCESS:', err));
      const { password: _, ...userResponseData } = newUser;
      userResponseData.role_name = newRoleName;
      res.status(201).json(userResponseData);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
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
    query('role_group').optional().isString().trim().isIn(['all', 'customer', 'administrator']).withMessage('Invalid role_group specified.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { role } = req.query;
    let queryString = `
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.role as legacy_role,
             u.is_tax_exempt, u.tax_exemption_certificate_id, u.tax_exemption_notes,
             u.created_at, u.updated_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    const queryParams = [];
    let paramIndex = 1;
    if (role) {
      queryString += ` WHERE LOWER(r.name) = LOWER($${paramIndex++})`;
      queryParams.push(role);
    }
    queryString += ' ORDER BY u.id ASC';
    try {
      const result = await db.query(queryString, queryParams);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error listing users:', error);
      next(new AppError('Error listing users.', 500, error));
    }
  }
);

// GET /api/admin/users/:id - View a specific user
router.get('/:id', isAuthenticated, checkPermission('users:view'), async (req, res, next) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }
  try {
    const result = await db.query('SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.role as legacy_role, u.is_tax_exempt, u.tax_exemption_certificate_id, u.tax_exemption_notes, u.created_at, u.updated_at FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [id]);
    if (result.rows.length === 0) {
      return next(new NotFoundError('User not found.'));
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    next(new AppError('Error fetching user.', 500, error));
  }
});

// PUT /api/admin/users/:id/role - Update a user's role (Legacy - consider removing or aligning with PUT /:id)
router.put('/:id/role', isAuthenticated, checkPermission('users:assign_roles'), async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }
  console.warn(`[PUT /api/admin/users/:${id}/role] Legacy role update endpoint hit. Consider migrating to main PUT /:id endpoint with role_id.`);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const roleResult = await client.query('SELECT id FROM roles WHERE LOWER(name) = LOWER($1)', [role]);
    if (roleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new BadRequestError(`Role '${role}' not found.`));
    }
    const roleIdToUpdate = roleResult.rows[0].id;

    const result = await client.query(
      'UPDATE users SET role_id = $1, role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, email, role_id',
      [roleIdToUpdate, role, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new NotFoundError('User not found.'));
    }
    const updatedUser = result.rows[0];
    await client.query('COMMIT');

    auditLogService.recordAuditEvent(
      'USER_ROLE_UPDATE_SUCCESS',
      { userId: req.user.userId, userEmail: req.user.email },
      { resourceType: 'USER', resourceId: updatedUser.id },
      { message: `User ID ${updatedUser.id} legacy role endpoint updated to role_id ${updatedUser.role_id} (text: ${role}).`},
      req
    ).catch(err => console.error('Audit log failed:', err));

    const finalUser = await db.query('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [updatedUser.id]);
    res.status(200).json({ message: 'User role updated successfully.', user: finalUser.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error updating role for user ${id} via legacy endpoint:`, error);
    next(new AppError('Error updating user role.', 500, error));
  } finally {
    client.release();
  }
});

// PUT /api/admin/users/:id - Update user details
router.put(
  '/:id',
  isAuthenticated,
  checkPermission('users:edit'), // RESTORED: Standard permission check
  [
    param('id').isInt({ gt: 0 }).toInt(),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 chars.'),
    body('email').optional().isEmail().withMessage('Must be a valid email.').normalizeEmail(),
    body('role_id').optional().isInt({ gt: 0 }).withMessage('Role ID must be a positive integer.').toInt(),
    body('is_tax_exempt').optional().isBoolean().toBoolean(),
    body('tax_exemption_certificate_id').optional({ nullable: true }).isString().trim()
      .isLength({ max: 100 }).withMessage('Tax exemption certificate ID cannot exceed 100 characters.'),
    body('tax_exemption_notes').optional({ nullable: true }).isString().trim()
  ],
  async (req, res, next) => {
    const { id } = req.params;
    console.log(`[PUT /api/admin/users/:${id}] Handler reached AFTER checkPermission('users:edit'). req.user:`, JSON.stringify(req.user, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(`[PUT /api/admin/users/:${id}] Validation errors:`, JSON.stringify(errors.array()));
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = { ...req.body };
    if (Object.keys(updates).length === 0) {
      return next(new BadRequestError('No fields provided for update.'));
    }

    const client = await db.pool.connect();
    try {
      if (updates.role_id !== undefined) {
        console.log(`[PUT /api/admin/users/:${id}] Role update detected. Checking 'users:assign_roles' for userId: ${req.user.userId}`);
        const hasAssignRolesPermission = await permissionService.userHasPermission(req.user.userId, 'users:assign_roles');
        if (!hasAssignRolesPermission) {
           console.warn(`[PUT /api/admin/users/:${id}] User ${req.user.userId} lacks 'users:assign_roles' for role update.`);
           throw new AppError("Forbidden: You do not have permission to assign roles.", 403);
        }
        console.log(`[PUT /api/admin/users/:${id}] User ${req.user.userId} HAS 'users:assign_roles' for role update.`);

        const newRoleIdInt = parseInt(updates.role_id, 10);
        if (isNaN(newRoleIdInt) || newRoleIdInt <= 0) {
            throw new BadRequestError('Invalid Role ID provided.');
        }
        updates.role_id = newRoleIdInt;

        const targetRoleResult = await client.query('SELECT name FROM roles WHERE id = $1', [updates.role_id]);
        if (targetRoleResult.rows.length === 0) {
          throw new BadRequestError(`Role with ID ${updates.role_id} not found.`);
        }
        const newRoleName = targetRoleResult.rows[0].name;
        updates.role = newRoleName;

        if (parseInt(id) === req.user.userId) {
            if (newRoleName.toLowerCase() !== 'super admin' && newRoleName.toLowerCase() !== 'admin') {
                const currentUserRoleResult = await client.query('SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [req.user.userId]);
                if (currentUserRoleResult.rows.length > 0 && (currentUserRoleResult.rows[0].name.toLowerCase() === 'super admin' || currentUserRoleResult.rows[0].name.toLowerCase() === 'admin')) {
                    throw new BadRequestError("Administrators cannot change their own role to a non-administrator role.");
                }
            }
        }
      }

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
      const fieldsToUpdate = ['name', 'email', 'role_id', 'role', 'is_tax_exempt', 'tax_exemption_certificate_id', 'tax_exemption_notes'];
      for (const field of fieldsToUpdate) {
        if (updates[field] !== undefined) {
          if ((field === 'tax_exemption_certificate_id' || field === 'tax_exemption_notes') && updates[field] === '') {
            values.push(null);
          } else {
            values.push(updates[field]);
          }
          setClauses.push(`${field} = $${paramIndex++}`);
        }
      }

      if (setClauses.length === 0) {
        await client.query('ROLLBACK');
        const userWithRoleName = await db.query('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [currentUser.id]);
        return res.status(200).json(userWithRoleName.rows[0] || currentUser);
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const updateQuery = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id;`;
      await client.query(updateQuery, values);
      await client.query('COMMIT');

      const updatedUserResult = await db.query(
        `SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.is_tax_exempt,
                u.tax_exemption_certificate_id, u.tax_exemption_notes, u.created_at, u.updated_at, u.role as legacy_role
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`, [id]
      );
      const finalUpdatedUserWithRole = updatedUserResult.rows[0];

      auditLogService.recordAuditEvent(
        'USER_UPDATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: finalUpdatedUserWithRole.id },
        {
          message: `User ID ${finalUpdatedUserWithRole.id} details updated by admin.`,
          inputData: { ...updates },
          updatedSnapshot: {
              name: finalUpdatedUserWithRole.name,
              email: finalUpdatedUserWithRole.email,
              role_id: finalUpdatedUserWithRole.role_id,
              role_name: finalUpdatedUserWithRole.role_name,
              is_tax_exempt: finalUpdatedUserWithRole.is_tax_exempt
          }
        },
        req
      ).catch(err => console.error('Audit log failed for USER_UPDATE_SUCCESS:', err));
      res.status(200).json(finalUpdatedUserWithRole);

    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(rbErr => console.error('Rollback error:', rbErr));
      if (!(error instanceof AppError || error instanceof ConflictError || error instanceof NotFoundError || error instanceof BadRequestError)) {
         console.error(`[PUT /api/admin/users/:${id}] Caught non-AppError:`, error);
         return next(new AppError(error.message || 'Error updating user.', error.statusCode || 500, error));
      }
      next(error);
    } finally {
      if (client) client.release();
    }
  }
);

// DELETE /api/admin/users/:id - Delete a user
router.delete('/:id', isAuthenticated, checkPermission('users:delete'), async (req, res, next) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }

  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ message: "Cannot delete currently logged-in admin user." });
  }

  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
    if (result.rowCount === 0) {
      return next(new NotFoundError('User not found.'));
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
    if (error.code === '23503') {
        return next(new ConflictError('Cannot delete user: They are referenced in other records. Please reassign or delete those records first.'));
    }
    next(new AppError('Error deleting user.', 500, error));
  }
});

module.exports = router;
