// backend/services/userService.js
const db = require('../db');
const bcrypt = require('bcrypt');
const { ConflictError, NotFoundError, BadRequestError, AppError } = require('../utils/AppError');

const SALT_ROUNDS = 10; // Define salt rounds for bcrypt

/**
 * Creates a new user, typically by an admin.
 * Handles password hashing and role assignment.
 * @param {object} userData - Data for the new user.
 * @param {string} userData.email
 * @param {string} userData.password
 * @param {string} userData.name
 * @param {number} userData.role_id
 * @returns {Promise<object>} The newly created user object (without password hash).
 * @throws {ConflictError} If email already exists.
 * @throws {BadRequestError} If role_id is invalid.
 * @throws {AppError} For other database errors.
 */
async function createUserByAdmin(userData) {
  const { email, password, name, role_id } = userData;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new ConflictError('A user with this email address already exists.');
    }

    // Check if role_id is valid and get role name
    const roleCheck = await client.query('SELECT name FROM roles WHERE id = $1', [role_id]);
    if (roleCheck.rows.length === 0) {
      throw new BadRequestError(`Role with ID ${role_id} does not exist.`);
    }
    const roleName = roleCheck.rows[0].name;

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const insertQuery = `
      INSERT INTO users (name, email, password, role_id, role, is_tax_exempt, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, email, role_id, role as legacy_role, is_tax_exempt, created_at, updated_at;
    `;
    // New users default to is_tax_exempt = false
    const result = await client.query(insertQuery, [name, email, hashedPassword, role_id, roleName, false]);

    await client.query('COMMIT');

    const newUser = result.rows[0];
    // Exclude password from the returned object
    const { password: _, ...userResponseData } = newUser;
    userResponseData.role_name = roleName; // Add role_name for convenience
    return userResponseData;

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof ConflictError || error instanceof BadRequestError || error instanceof AppError) {
      throw error; // Re-throw known errors
    }
    // Handle potential DB unique constraint if pre-check somehow missed (though unlikely with transaction)
    if (error.code === '23505' && error.constraint && error.constraint.includes('users_email_key')) {
        throw new ConflictError('A user with this email address already exists (database constraint).');
    }
    console.error('Error in userService.createUserByAdmin:', error);
    throw new AppError('Failed to create user due to a server error.', 500, 'USER_CREATION_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Retrieves a paginated list of all users, optionally filtered by role.
 * @param {object} options - Filtering and pagination options.
 * @param {string} [options.role] - Role name to filter by (case-insensitive).
 * @param {string} [options.search_term] - Search term for name or email.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<object>} An object containing { data: users, pagination: {...} }.
 * @throws {AppError} If database operation fails.
 */
async function getAllUsers(options = {}) {
  const {
    role,
    search_term,
    page = 1,
    limit = 20
  } = options;
  const offset = (page - 1) * limit;

  let baseQuery = `
    SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.role as legacy_role,
           u.is_tax_exempt, u.tax_exemption_certificate_id, u.tax_exemption_notes,
           u.created_at, u.updated_at
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
  `;
  let countQueryBase = `SELECT COUNT(u.id) FROM users u LEFT JOIN roles r ON u.role_id = r.id`;

  const whereClauses = [];
  const queryParams = [];
  let paramIndex = 1;

  if (role) {
    whereClauses.push(`LOWER(r.name) = LOWER($${paramIndex++})`);
    queryParams.push(role);
  }
  if (search_term) {
    whereClauses.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
    queryParams.push(`%${search_term}%`);
    paramIndex++;
  }

  if (whereClauses.length > 0) {
    const whereString = ` WHERE ${whereClauses.join(' AND ')}`;
    baseQuery += whereString;
    countQueryBase += whereString;
  }

  baseQuery += ` ORDER BY u.id ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  const dataParams = [...queryParams, limit, offset];
  // Count query uses only filter params
  const countParams = [...queryParams];


  try {
    const usersResult = await db.query(baseQuery, dataParams);
    const totalResult = await db.query(countQueryBase, countParams);

    const totalUsers = parseInt(totalResult.rows[0].count);

    return {
      data: usersResult.rows,
      pagination: {
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit),
      }
    };
  } catch (error) {
    console.error('Error in userService.getAllUsers:', error);
    throw new AppError('Failed to retrieve users.', 500, 'USER_FETCH_ALL_FAILED');
  }
}


/**
 * Retrieves a single user by their ID, including role name.
 * @param {number} userId - The ID of the user to retrieve.
 * @returns {Promise<object>} The user object.
 * @throws {NotFoundError} If the user is not found.
 * @throws {AppError} If database operation fails.
 */
async function getUserById(userId) {
  const query = `
    SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.role as legacy_role,
           u.is_tax_exempt, u.tax_exemption_certificate_id, u.tax_exemption_notes,
           u.created_at, u.updated_at
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1`;
  try {
    const result = await db.query(query, [userId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`User with ID ${userId} not found.`);
    }
    // Exclude password if it were ever fetched (it's not in this query)
    const { password: _, ...userWithoutPassword } = result.rows[0];
    return userWithoutPassword;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in userService.getUserById for ID ${userId}:`, error);
    throw new AppError(`Failed to retrieve user ID ${userId}.`, 500, 'USER_FETCH_BY_ID_FAILED');
  }
}


/**
 * Updates a user's role based on role name (legacy).
 * @param {number} userId - The ID of the user to update.
 * @param {string} roleName - The name of the new role.
 * @returns {Promise<object>} The updated user object with new role name.
 * @throws {NotFoundError} If user or role not found.
 * @throws {BadRequestError} If roleName is invalid.
 * @throws {AppError} For other DB errors.
 */
async function updateUserRoleLegacy(userId, roleName) {
  if (!roleName || typeof roleName !== 'string' || roleName.trim() === '') {
    throw new BadRequestError("Role name must be a non-empty string.");
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userCheck = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userCheck.rows.length === 0) {
      throw new NotFoundError(`User with ID ${userId} not found.`);
    }

    const roleResult = await client.query('SELECT id FROM roles WHERE LOWER(name) = LOWER($1)', [roleName.trim()]);
    if (roleResult.rows.length === 0) {
      throw new BadRequestError(`Role '${roleName}' not found.`);
    }
    const roleIdToUpdate = roleResult.rows[0].id;

    // Update both role_id and the legacy role text column
    const result = await client.query(
      'UPDATE users SET role_id = $1, role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, email, role_id, role',
      [roleIdToUpdate, roleName.trim(), userId] // Store the provided roleName (trimmed) in legacy role field
    );

    // No need to check result.rows.length again due to FOR UPDATE

    await client.query('COMMIT');

    const updatedUser = result.rows[0];
    // Fetch full user details including the role_name for the response
    const finalUser = await getUserById(updatedUser.id); // Re-use existing service method
    return finalUser;

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error(`Error in userService.updateUserRoleLegacy for user ID ${userId}:`, error);
    throw new AppError('Error updating user role.', 500, 'USER_ROLE_UPDATE_LEGACY_FAILED');
  } finally {
    client.release();
  }
}


/**
 * Updates user details by an admin.
 * Handles updates to name, email, role_id, and tax exemption status.
 * Includes checks for email conflicts and admin self-demotion.
 * @param {number} userId - The ID of the user to update.
 * @param {object} updateData - Data to update. Can include name, email, role_id, is_tax_exempt, etc.
 * @param {number} requestingUserId - The ID of the admin performing the update (for self-update checks).
 * @returns {Promise<object>} The updated user object.
 */
async function updateUserByAdmin(userId, updateData, requestingUserId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentUserResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (currentUserResult.rows.length === 0) {
      throw new NotFoundError(`User with ID ${userId} not found.`);
    }
    const currentUser = currentUserResult.rows[0];

    const updatesToApply = { ...updateData }; // Clone to avoid modifying original

    // If role_id is being updated, validate it and get the new role name
    if (updatesToApply.role_id !== undefined) {
      const newRoleId = parseInt(updatesToApply.role_id, 10);
      if (isNaN(newRoleId) || newRoleId <= 0) {
        throw new BadRequestError('Invalid Role ID provided for update.');
      }
      updatesToApply.role_id = newRoleId; // Ensure it's an integer

      const targetRoleResult = await client.query('SELECT name FROM roles WHERE id = $1', [updatesToApply.role_id]);
      if (targetRoleResult.rows.length === 0) {
        throw new BadRequestError(`Role with ID ${updatesToApply.role_id} not found.`);
      }
      const newRoleName = targetRoleResult.rows[0].name;
      updatesToApply.role = newRoleName; // Also update the legacy 'role' column

      // Prevent admin self-demotion
      if (currentUser.id === requestingUserId) {
        // Fetch current role name of the admin making the request
        const adminUserRoleResult = await client.query('SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [requestingUserId]);
        const adminCurrentRoleName = adminUserRoleResult.rows.length > 0 ? adminUserRoleResult.rows[0].name.toLowerCase() : '';

        if ((adminCurrentRoleName === 'super admin' || adminCurrentRoleName === 'admin') &&
            (newRoleName.toLowerCase() !== 'super admin' && newRoleName.toLowerCase() !== 'admin')) {
          throw new BadRequestError("Administrators cannot change their own role to a non-administrator role.");
        }
      }
    }

    // Email conflict check if email is being changed
    if (updatesToApply.email && updatesToApply.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [updatesToApply.email, userId]);
      if (existingUser.rows.length > 0) {
        throw new ConflictError('This email address is already in use by another account.');
      }
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'email', 'role_id', 'role', 'is_tax_exempt', 'tax_exemption_certificate_id', 'tax_exemption_notes'];
    for (const field of allowedFields) {
      if (updatesToApply.hasOwnProperty(field)) {
        let valueToSet = updatesToApply[field];
        // Handle empty strings for nullable text fields by converting them to null
        if ((field === 'tax_exemption_certificate_id' || field === 'tax_exemption_notes') && valueToSet === '') {
          valueToSet = null;
        }
        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(valueToSet);
      }
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // Release lock
      return getUserById(userId); // No changes, return current user data
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId); // For WHERE id = $N

    const updateQuery = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id;`;
    await client.query(updateQuery, values);

    await client.query('COMMIT');

    return getUserById(userId); // Fetch and return the fully updated user details

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof AppError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof BadRequestError) {
      throw error;
    }
    if (error.code === '23505' && error.constraint && error.constraint.includes('users_email_key') && updatesToApply.email) {
        throw new ConflictError(`This email address "${updatesToApply.email}" is already in use (database constraint).`);
    }
    console.error(`Error in userService.updateUserByAdmin for user ID ${userId}:`, error);
    throw new AppError('Failed to update user.', 500, 'USER_UPDATE_ADMIN_FAILED');
  } finally {
    client.release();
  }
}


/**
 * Deletes a user. Prevents self-deletion by an admin.
 * @param {number} userIdToDelete - The ID of the user to delete.
 * @param {number} currentUserId - The ID of the admin performing the action.
 * @returns {Promise<object>} The data of the deleted user.
 * @throws {NotFoundError} If user to delete is not found.
 * @throws {BadRequestError} If admin attempts to delete themselves.
 * @throws {ConflictError} If user cannot be deleted due to foreign key constraints.
 * @throws {AppError} For other DB errors.
 */
async function deleteUser(userIdToDelete, currentUserId) {
  if (parseInt(userIdToDelete, 10) === parseInt(currentUserId, 10)) {
    throw new BadRequestError("Administrators cannot delete their own account.");
  }

  // No explicit transaction needed for a single DELETE, but can be added if pre-checks become complex.
  try {
    // Check if user exists (and to get email for audit log, though RETURNING * also gives it)
    const userCheck = await db.query('SELECT email FROM users WHERE id = $1', [userIdToDelete]);
    if (userCheck.rows.length === 0) {
        throw new NotFoundError(`User with ID ${userIdToDelete} not found.`);
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, email, name', [userIdToDelete]);
    // rowCount check is redundant due to the check above, but good for safety
    if (result.rowCount === 0) {
      throw new NotFoundError(`User with ID ${userIdToDelete} not found (unexpected after initial check).`);
    }
    return result.rows[0]; // Return deleted user's id, email, name
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    if (error.code === '23503') { // foreign_key_violation
      // This means the user is referenced in other tables (e.g., orders, reviews)
      // and the DB schema prevents deletion (e.g., ON DELETE RESTRICT).
      throw new ConflictError('Cannot delete user: They are referenced in other records (e.g., orders, reviews). Please reassign or address these records first.');
    }
    console.error(`Error in userService.deleteUser for ID ${userIdToDelete}:`, error);
    throw new AppError(`Failed to delete user ID ${userIdToDelete}.`, 500, 'USER_DELETE_FAILED');
  }
}


module.exports = {
  createUserByAdmin,
  getAllUsers,
  getUserById,
  updateUserRoleLegacy,
  updateUserByAdmin,
  deleteUser,
  updateUserProfile, // Added new function
};

/**
 * Updates specified profile fields for a given user ID.
 * Intended for the authenticated user to update their own profile.
 * @param {number} userId - The ID of the user.
 * @param {object} profileData - An object containing fields to update. e.g., { name: string }.
 * @returns {Promise<object>} The updated user object (selected fields).
 * @throws {NotFoundError} If the user is not found or not updated.
 * @throws {BadRequestError} If profileData is empty or invalid.
 * @throws {AppError} For other database errors.
 */
async function updateUserProfile(userId, profileData) {
  const { name } = profileData; // Currently only 'name' is updatable by this function

  if (!name || typeof name !== 'string' || name.trim() === '') {
    // This validation can also be enforced by express-validator in the route,
    // but a service-level check is good for direct calls or future reuse.
    throw new BadRequestError('Name must be a non-empty string.');
  }
  if (name.trim().length < 2 || name.trim().length > 255) {
    throw new BadRequestError('Name must be between 2 and 255 characters.');
  }

  // Check if any actual updatable data was provided beyond just empty object
  const updatableFields = Object.keys(profileData).filter(key => key === 'name'); // Extend if more fields become updatable
  if (updatableFields.length === 0) {
      throw new BadRequestError('No updatable profile data provided.');
  }

  const client = await db.pool.connect();
  try {
    // Although the user is authenticated, a check for existence before update is robust.
    // However, the UPDATE query itself with RETURNING will indicate if a row was affected.
    // Let's rely on the UPDATE's rowCount or RETURNING result.

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (profileData.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(profileData.name.trim());
    }
    // Add other updatable fields here if they become available
    // e.g., if (profileData.bio !== undefined) { setClauses.push(`bio = $${paramIndex++}`); values.push(profileData.bio); }

    if (setClauses.length === 0) {
      // Should be caught by the initial check, but as a safeguard
      throw new BadRequestError('No valid fields provided for profile update.');
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId); // For WHERE id = $N

    const updateQuery = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, role_id, is_two_fa_enabled, created_at, updated_at;
    `;

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      // This implies the userId did not exist, or no row was updated for some reason.
      throw new NotFoundError('User not found or profile not updated.');
    }

    // Ensure role_name is included if role_id is present, similar to other user fetching functions
    const updatedUser = result.rows[0];
    if (updatedUser.role_id) {
        const roleResult = await client.query('SELECT name FROM roles WHERE id = $1', [updatedUser.role_id]);
        if (roleResult.rows.length > 0) {
            updatedUser.role_name = roleResult.rows[0].name;
        } else {
            updatedUser.role_name = null; // Or some default/indicator of missing role
        }
    }


    return updatedUser;

  } catch (error) {
    if (error instanceof AppError) throw error; // Re-throw known errors
    console.error(`[userService.updateUserProfile] Error for user ID ${userId}:`, error);
    // Check for specific DB errors if necessary, e.g., unique constraint if 'name' had to be unique
    // and was not pre-checked.
    throw new AppError('Failed to update user profile.', 500, 'USER_PROFILE_UPDATE_FAILED');
  } finally {
    client.release();
  }
}
