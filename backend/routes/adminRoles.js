const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth');
const { body, param, validationResult } = require('express-validator');
const { AppError, NotFoundError, ConflictError, BadRequestError } = require('../utils/AppError');
const auditLogService = require('../services/auditLogService');

// --- Validation Chains ---
const validateRoleNameAndDescription = [
  body('name')
    .trim()
    .notEmpty().withMessage('Role name is required.')
    .isString().withMessage('Role name must be a string.')
    .isLength({ min: 2, max: 100 }).withMessage('Role name must be between 2 and 100 characters.'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string if provided.')
    .trim()
    .isLength({ max: 500 }).withMessage('Description can be at most 500 characters.')
];

const validateRoleIdParam = [
  param('roleId').isInt({ gt: 0 }).withMessage('Role ID must be a positive integer.').toInt()
];

const validatePermissionsArray = [
    body('permissionIds')
        .isArray().withMessage('permissionIds must be an array.')
        .custom((value) => {
            if (value.some(id => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)) {
                throw new Error('All permissionIds must be positive integers.');
            }
            return true;
        })
];


// GET /api/admin/roles - List all roles
router.get(
  '/',
  isAuthenticated,
  checkPermission('rbac:manage'), // Or 'users:assign_roles' if a broader set of users needs to list roles for assignment
  async (req, res, next) => {
    try {
      const result = await db.query('SELECT id, name, description, created_at, updated_at FROM roles ORDER BY name ASC');
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error listing roles:', error);
      next(new AppError('Failed to retrieve roles.', 500, error));
    }
  }
);

// GET /api/admin/roles/:roleId - Get a specific role
router.get(
  '/:roleId',
  isAuthenticated,
  checkPermission('rbac:manage'),
  validateRoleIdParam,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { roleId } = req.params;
    try {
      const result = await db.query('SELECT id, name, description, created_at, updated_at FROM roles WHERE id = $1', [roleId]);
      if (result.rows.length === 0) {
        return next(new NotFoundError('Role not found.'));
      }
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching role ${roleId}:`, error);
      next(new AppError('Failed to retrieve role.', 500, error));
    }
  }
);

// GET /api/admin/roles/:roleId/permissions - List permission IDs for a specific role
router.get(
  '/:roleId/permissions',
  isAuthenticated,
  checkPermission('rbac:manage'),
  validateRoleIdParam,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { roleId } = req.params;
    try {
      // Check if role exists first
      const roleCheck = await db.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleCheck.rows.length === 0) {
          return next(new NotFoundError('Role not found.'));
      }
      const result = await db.query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [roleId]);
      res.status(200).json(result.rows.map(r => r.permission_id));
    } catch (error) {
      console.error(`Error fetching permissions for role ${roleId}:`, error);
      next(new AppError('Failed to retrieve role permissions.', 500, error));
    }
  }
);


// POST /api/admin/roles - Create a new role
router.post(
  '/',
  isAuthenticated,
  checkPermission('rbac:manage'),
  validateRoleNameAndDescription,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, description } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
        [name, description]
      );
      const newRole = result.rows[0];
      auditLogService.recordAuditEvent('ROLE_CREATE_SUCCESS', req.user, { resourceId: newRole.id }, { name, description }, req);
      res.status(201).json(newRole);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'roles_name_key') {
        return next(new ConflictError(`A role with the name "${name}" already exists.`));
      }
      console.error('Error creating role:', error);
      next(new AppError('Failed to create role.', 500, error));
    }
  }
);

// PUT /api/admin/roles/:roleId - Update a role's name/description
router.put(
  '/:roleId',
  isAuthenticated,
  checkPermission('rbac:manage'),
  validateRoleIdParam,
  validateRoleNameAndDescription, // Re-uses the same validation for name/desc
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { roleId } = req.params;
    const { name, description } = req.body;

    try {
      const result = await db.query(
        'UPDATE roles SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [name, description, roleId]
      );
      if (result.rows.length === 0) {
        return next(new NotFoundError('Role not found.'));
      }
      const updatedRole = result.rows[0];
      auditLogService.recordAuditEvent('ROLE_UPDATE_SUCCESS', req.user, { resourceId: updatedRole.id }, { name, description }, req);
      res.status(200).json(updatedRole);
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'roles_name_key') {
        return next(new ConflictError(`A role with the name "${name}" already exists.`));
      }
      console.error(`Error updating role ${roleId}:`, error);
      next(new AppError('Failed to update role.', 500, error));
    }
  }
);

// PUT /api/admin/roles/:roleId/permissions - Update permissions for a role
router.put(
  '/:roleId/permissions',
  isAuthenticated,
  checkPermission('rbac:manage'),
  validateRoleIdParam,
  validatePermissionsArray,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { roleId } = req.params;
    const { permissionIds } = req.body; // Array of permission IDs

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if role exists
      const roleCheck = await client.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return next(new NotFoundError('Role not found.'));
      }

      // Check if all provided permission IDs exist
      if (permissionIds.length > 0) {
        const placeholders = permissionIds.map((_, i) => `$${i + 1}`).join(',');
        const permCheckQuery = `SELECT id FROM permissions WHERE id IN (${placeholders})`;
        const permCheckResult = await client.query(permCheckQuery, permissionIds);
        if (permCheckResult.rowCount !== permissionIds.length) {
            await client.query('ROLLBACK');
            const foundIds = permCheckResult.rows.map(r => r.id);
            const notFoundIds = permissionIds.filter(id => !foundIds.includes(id));
            return next(new BadRequestError(`One or more permission IDs not found: ${notFoundIds.join(', ')}.`));
        }
      }

      // Delete existing permissions for the role
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Insert new permissions
      if (permissionIds && permissionIds.length > 0) {
        const insertPromises = permissionIds.map(permissionId => {
          return client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, permissionId]);
        });
        await Promise.all(insertPromises);
      }

      await client.query('COMMIT');
      auditLogService.recordAuditEvent('ROLE_PERMISSIONS_UPDATE_SUCCESS', req.user, { resourceId: roleId }, { permissionIds }, req);
      res.status(200).json({ message: 'Role permissions updated successfully.' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error updating permissions for role ${roleId}:`, error);
      next(new AppError('Failed to update role permissions.', 500, error));
    } finally {
      client.release();
    }
  }
);

// DELETE /api/admin/roles/:roleId - Delete a role
router.delete(
  '/:roleId',
  isAuthenticated,
  checkPermission('rbac:manage'),
  validateRoleIdParam,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { roleId } = req.params;

    // Prevent deletion of core roles like 'Super Admin' or 'Customer' by name or ID
    // This needs IDs from seed data or a more robust check. For now, a placeholder:
    // const superAdminRoleId = 1; // Example, fetch from DB or config
    // const customerRoleId = 2; // Example
    // if (roleId === superAdminRoleId || roleId === customerRoleId) {
    //   return next(new BadRequestError('Cannot delete core system roles.'));
    // }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Check if any users are assigned this role
      const userCheck = await client.query('SELECT COUNT(*) as count FROM users WHERE role_id = $1', [roleId]);
      if (parseInt(userCheck.rows[0].count, 10) > 0) {
        await client.query('ROLLBACK');
        return next(new ConflictError(`Cannot delete role: ${userCheck.rows[0].count} user(s) are currently assigned this role. Please reassign them first.`));
      }

      // Delete associated permissions first (though ON DELETE CASCADE should handle this)
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      // Then delete the role
      const result = await client.query('DELETE FROM roles WHERE id = $1 RETURNING name', [roleId]);

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return next(new NotFoundError('Role not found.'));
      }
      await client.query('COMMIT');
      auditLogService.recordAuditEvent('ROLE_DELETE_SUCCESS', req.user, { resourceId: roleId }, { deletedRoleName: result.rows[0].name }, req);
      res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error deleting role ${roleId}:`, error);
      next(new AppError('Failed to delete role.', 500, error));
    } finally {
      client.release();
    }
  }
);

module.exports = router;
