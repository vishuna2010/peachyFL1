const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, checkPermission } = require('../auth');
const { AppError } = require('../utils/AppError');

// GET /api/admin/permissions - List all available permissions
router.get(
  '/',
  isAuthenticated,
  checkPermission('rbac:manage'), // Only users who can manage RBAC should see all permissions
  async (req, res, next) => {
    try {
      const result = await db.query(
        'SELECT id, name, description, group_name FROM permissions ORDER BY group_name, name ASC'
      );

      // Optional: Group permissions by group_name for easier UI consumption
      const groupedPermissions = result.rows.reduce((acc, perm) => {
        const group = perm.group_name || 'General';
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push({
          id: perm.id,
          name: perm.name,
          description: perm.description,
        });
        return acc;
      }, {});

      // Send as an array of groups, each with a name and its permissions
      const responseData = Object.keys(groupedPermissions).map(groupName => ({
        groupName: groupName,
        permissions: groupedPermissions[groupName]
      })).sort((a,b) => a.groupName.localeCompare(b.groupName));


      res.status(200).json(responseData);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      next(new AppError('Failed to retrieve permissions.', 500, error));
    }
  }
);

module.exports = router;
