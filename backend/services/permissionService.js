const db = require('../db');

/**
 * Retrieves all permission names for a given user ID.
 * This implementation assumes a user has only one role.
 * If multiple roles per user are implemented later, this query will need adjustment.
 * @param {number} userId - The ID of the user.
 * @param {object} [client=db] - Optional database client for transactions.
 * @returns {Promise<string[]>} A promise that resolves to an array of permission names.
 */
async function getUserPermissions(userId, client = db) {
  console.log(`[PermissionService] getUserPermissions called for userId: ${userId}`);
  // Check if userId is provided and is a number
  if (!userId || isNaN(parseInt(userId))) {
    console.warn(`[PermissionService] getUserPermissions: Invalid userId '${userId}'. Returning empty permissions.`);
    return []; // Return empty permissions for invalid userId
  }

  const query = `
    SELECT DISTINCT p.name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = $1;
  `;
  try {
    console.log(`[PermissionService] getUserPermissions: Executing query for userId ${userId}: ${query}`);
    const { rows } = await client.query(query, [userId]);
    const permissionNames = rows.map(row => row.name);
    console.log(`[PermissionService] getUserPermissions: Found permissions for userId ${userId}:`, permissionNames);
    return permissionNames;
  } catch (error) {
    console.error(`[PermissionService] getUserPermissions: Error fetching permissions for user ID ${userId}:`, error);
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Checks if a user has a specific permission.
 * @param {number} userId - The ID of the user.
 * @param {string} requiredPermission - The name of the permission to check for.
 * @param {object} [client=db] - Optional database client for transactions.
 * @returns {Promise<boolean>} A promise that resolves to true if the user has the permission, false otherwise.
 */
async function userHasPermission(userId, requiredPermission, client = db) {
  console.log(`[PermissionService] userHasPermission called for userId: ${userId}, requiredPermission: '${requiredPermission}'`);
  if (!requiredPermission) {
    console.warn('[PermissionService] userHasPermission: No requiredPermission provided.');
    return false;
  }
  try {
    const userPermissions = await getUserPermissions(userId, client);
    console.log(`[PermissionService] userHasPermission: User permissions for userId ${userId}:`, userPermissions);
    const hasPermission = userPermissions.includes(requiredPermission);
    console.log(`[PermissionService] userHasPermission: Does userId ${userId} have '${requiredPermission}'? Result: ${hasPermission}`);
    return hasPermission;
  } catch (error) {
    // Error already logged by getUserPermissions
    console.error(`[PermissionService] userHasPermission: Error during permission check for userId ${userId}, permission '${requiredPermission}':`, error);
    return false; // Default to no permission if there's an error fetching them
  }
}

module.exports = {
  getUserPermissions,
  userHasPermission,
};
