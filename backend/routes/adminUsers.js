const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth');
const permissionService = require('../services/permissionService');
const auditLogService = require('../services/auditLogService');
const { query, body, param, validationResult } = require('express-validator');
const { ConflictError, NotFoundError, BadRequestError, AppError } = require('../utils/AppError'); // AppError might still be needed for route-level logic if any
// const bcrypt = require('bcrypt'); // No longer needed directly in routes if hashing is in service
const userService = require('../services/userService'); // Import the new service

// Validation Chains
const validateCreateUserParams = [
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('role_id').isInt({ gt: 0 }).withMessage('Valid Role ID is required.').toInt()
];

const validateListUsersParams = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  query('role_id').optional().isInt({ gt: 0 }).toInt().withMessage('Role ID must be a positive integer if provided.'), // Changed from 'role' (name) to 'role_id' (integer)
  query('search_term').optional().isString().trim()
  // Add status filter validation if you implement status filtering
  // query('status').optional().isString().trim().isIn(['active', 'inactive', 'verified', 'unverified'])
];

const validateUserIdParam = [
  param('id').isInt({ gt: 0 }).withMessage('User ID must be a positive integer.').toInt()
];

const validateUpdateUserRoleLegacyParams = [
  param('id').isInt({ gt: 0 }).withMessage('User ID must be a positive integer.').toInt(),
  body('role').isString().trim().notEmpty().withMessage('Role name is required.')
    .toLowerCase()
    .isLength({ min: 2, max: 50 }).withMessage('Role name is invalid.')
];

const validateUpdateUserParams = [ // Renamed from validateUpdateUser for consistency
  param('id').isInt({ gt: 0 }).toInt().withMessage('User ID must be a positive integer.'),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 chars.'),
  body('email').optional().isEmail().withMessage('Must be a valid email.').normalizeEmail(),
  body('role_id').optional().isInt({ gt: 0 }).withMessage('Role ID must be a positive integer.').toInt(),
  body('is_tax_exempt').optional().isBoolean().toBoolean(),
  body('tax_exemption_certificate_id').optional({ nullable: true }).isString().trim()
    .isLength({ max: 100 }).withMessage('Tax exemption certificate ID cannot exceed 100 characters.'),
  body('tax_exemption_notes').optional({ nullable: true }).isString().trim()
];


// POST /api/admin/users - Create a new user by an admin
router.post(
  '/',
  isAuthenticated,
  checkPermission('users:create'),
  validateCreateUserParams, // Applied validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userData = req.body; // Contains validated: email, password, name, role_id

    try {
      const newUser = await userService.createUserByAdmin(userData);
      // newUser from service already excludes password and includes role_name

      auditLogService.recordAuditEvent(
        'ADMIN_USER_CREATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: newUser.id },
        { createdUserEmail: newUser.email, createdUserRoleId: newUser.role_id, createdUserRoleName: newUser.role_name },
        req
      ).catch(err => console.error('Audit log failed for ADMIN_USER_CREATE_SUCCESS:', err));

      res.status(201).json(newUser);
    } catch (error) {
      // Service layer errors (ConflictError, BadRequestError, AppError) are passed on
      next(error);
    }
  }
);

// GET /api/admin/users - List all users
router.get(
  '/',
  isAuthenticated,
  checkPermission('users:view'),
  // [  // This was the original validation, now replaced by validateListUsersParams
  //   query('role_group').optional().isString().trim().isIn(['all', 'customer', 'administrator']).withMessage('Invalid role_group specified.')
  // ],
  validateListUsersParams, // Applied new validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // All query params (page, limit, role, search_term) are validated and have defaults
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      role_id: req.query.role_id, // Pass role_id to the service
      search_term: req.query.search_term,
      // status: req.query.status // If implementing status filter
    };

    try {
      const result = await userService.getAllUsers(options);
      // Service returns { data: users, pagination: {...} }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/users/:id - View a specific user
router.get(
  '/:id',
  isAuthenticated,
  checkPermission('users:view'),
  validateUserIdParam, // Applied validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params; // id is a validated integer from validateUserIdParam

    try {
      const user = await userService.getUserById(id);
      // userService.getUserById throws NotFoundError if not found
      res.status(200).json(user);
    } catch (error) {
      next(error); // Pass errors (including NotFoundError) to global handler
    }
  }
);

// PUT /api/admin/users/:id/role - Update a user's role (Legacy - consider removing or aligning with PUT /:id)
router.put(
  '/:id/role',
  isAuthenticated,
  checkPermission('users:assign_roles'), // Added specific permission check
  validateUpdateUserRoleLegacyParams, // Applied validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params; // Validated integer
    const { role } = req.body; // Validated string, trimmed, lowercased

    console.warn(`[PUT /api/admin/users/:${id}/role] Legacy role update endpoint hit. Consider migrating to main PUT /:id endpoint with role_id.`);

    try {
      const updatedUserWithRoleName = await userService.updateUserRoleLegacy(id, role);
      // Service method handles transaction, role lookup, user update, and fetching final user details.

      auditLogService.recordAuditEvent(
        'USER_ROLE_UPDATE_SUCCESS', // Consider a more specific audit event if needed
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: updatedUserWithRoleName.id },
        { message: `User ID ${updatedUserWithRoleName.id} legacy role endpoint updated to role_id ${updatedUserWithRoleName.role_id} (name: ${updatedUserWithRoleName.role_name}).`},
        req
      ).catch(err => console.error('Audit log failed for USER_ROLE_UPDATE_SUCCESS (legacy):', err));

      res.status(200).json({ message: 'User role updated successfully.', user: updatedUserWithRoleName });
    } catch (error) {
      // Service layer errors (NotFoundError, BadRequestError, AppError) passed on.
      next(error);
    }
  }
);

// PUT /api/admin/users/:id - Update user details
router.put(
  '/:id',
  isAuthenticated,
  checkPermission('users:edit'),
  // [ // This was the original validation, now replaced by validateUpdateUserParams
  //   param('id').isInt({ gt: 0 }).toInt(),
  //   body('name').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('Name must be between 1 and 255 chars.'),
  //   body('email').optional().isEmail().withMessage('Must be a valid email.').normalizeEmail(),
  //   body('role_id').optional().isInt({ gt: 0 }).withMessage('Role ID must be a positive integer.').toInt(),
  //   body('is_tax_exempt').optional().isBoolean().toBoolean(),
  //   body('tax_exemption_certificate_id').optional({ nullable: true }).isString().trim()
  //     .isLength({ max: 100 }).withMessage('Tax exemption certificate ID cannot exceed 100 characters.'),
  //   body('tax_exemption_notes').optional({ nullable: true }).isString().trim()
  // ],
  validateUpdateUserParams, // Applied validation
  async (req, res, next) => {
    const { id } = req.params; // Validated integer
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = req.body; // Validated and sanitized data
    if (Object.keys(updateData).length === 0) {
      // If no actual fields to update were provided in the body after validation (e.g. only extraneous fields sent)
      // It's good practice to fetch and return current user data or a specific message.
      // For now, let's assume `userService.updateUserByAdmin` handles this by returning current if no changes.
      // Or we can explicitly check:
      const updatableFields = ['name', 'email', 'role_id', 'is_tax_exempt', 'tax_exemption_certificate_id', 'tax_exemption_notes'];
      const hasActualUpdate = updatableFields.some(field => updateData.hasOwnProperty(field));
      if (!hasActualUpdate) {
          try {
            const currentUserData = await userService.getUserById(id);
            return res.status(200).json(currentUserData);
          } catch(err) { return next(err); }
      }
    }

    // Permission check for role_id update MUST happen BEFORE calling service if service doesn't handle it.
    // The service's updateUserByAdmin will handle the logic of fetching role name, admin self-demotion.
    // However, the permission to *initiate* a role change should be checked here.
    if (updateData.role_id !== undefined) {
        try {
            const hasAssignRolesPermission = await permissionService.userHasPermission(req.user.userId, 'users:assign_roles');
            if (!hasAssignRolesPermission) {
               throw new AppError("Forbidden: You do not have permission to assign roles.", 403, "FORBIDDEN_ROLE_ASSIGNMENT");
            }
        } catch (permError) {
            return next(permError);
        }
    }

    try {
      const updatedUser = await userService.updateUserByAdmin(id, updateData, req.user.userId);

      auditLogService.recordAuditEvent(
        'USER_UPDATE_SUCCESS',
        { userId: req.user.userId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: updatedUser.id },
        {
          message: `User ID ${updatedUser.id} details updated by admin.`,
          inputData: updateData, // Log the actual updates sent
          updatedSnapshot: { // Log key fields from the result
              name: updatedUser.name,
              email: updatedUser.email,
              role_id: updatedUser.role_id,
              role_name: updatedUser.role_name,
              is_tax_exempt: updatedUser.is_tax_exempt
          }
        },
        req
      ).catch(err => console.error('Audit log failed for USER_UPDATE_SUCCESS:', err));

      res.status(200).json(updatedUser);

    } catch (error) {
      // Service layer errors (NotFoundError, ConflictError, BadRequestError, AppError) passed on.
      next(error);
    }
  }
);

// DELETE /api/admin/users/:id - Delete a user
router.delete(
  '/:id',
  isAuthenticated,
  checkPermission('users:delete'),
  validateUserIdParam, // Applied validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id: userIdToDelete } = req.params; // Validated integer
    const currentUserId = req.user.userId;

    try {
      const deletedUser = await userService.deleteUser(userIdToDelete, currentUserId);
      // Service method handles self-deletion check, not found, and FK conflicts.

      auditLogService.recordAuditEvent(
        'USER_DELETE_SUCCESS',
        { userId: currentUserId, userEmail: req.user.email },
        { resourceType: 'USER', resourceId: deletedUser.id }, // Use ID from returned deletedUser
        { deletedUserEmail: deletedUser.email, deletedUserName: deletedUser.name },
        req
      ).catch(err => console.error('Audit log failed for USER_DELETE_SUCCESS:', err));

      res.status(200).json({ message: 'User deleted successfully.', user: deletedUser });
    } catch (error) {
      // Service layer errors (NotFoundError, BadRequestError, ConflictError, AppError) passed on.
      next(error);
    }
  }
);

module.exports = router;
