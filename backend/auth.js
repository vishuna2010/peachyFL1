const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-key'; // Use environment variable

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length); // Extract token from "Bearer TOKEN"
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        // Token is not valid or expired
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
      }
      // Token is valid, attach decoded payload to request
      req.user = decoded; // Contains userId, email (based on loginUser JWT signing)
      next();
    });
  } else {
    // No token provided
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }
};

async function registerUser(email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Role defaults to 'customer' due to table DDL, but explicit is fine too.
    const result = await db.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, hashedPassword, 'customer'] // Explicitly set role
    );
    const { password: _, ...userWithoutPassword } = result.rows[0];
    return { success: true, user: userWithoutPassword };
  } catch (error) {
    console.error('Error registering user:', error);
    if (error.code === '23505') { // Unique violation (email already exists)
      return { success: false, message: 'Email already in use.' };
    }
    return { success: false, message: 'Error registering user.' };
  }
}

async function loginUser(email, password) {
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return { success: false, message: 'User not found.' };
    }

    const user = result.rows[0]; // Contains id, email, role, password, is_two_fa_enabled, two_fa_secret
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      // Password matches. Return user object for further processing (2FA check or JWT generation)
      // Exclude password from returned user object
      const { password: _, ...userWithoutPassword } = user;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Incorrect password.' };
    }
  } catch (error) {
    console.error('Error logging in user:', error);
    return { success: false, message: 'Error logging in user.' };
  }
}

// Function to generate JWT
function generateJwt(user) {
  // User object should contain id, email, role
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role }, // Add role to JWT payload
    jwtSecret,
    { expiresIn: '1h' }
  );
}

// Conceptual Password Recovery
async function requestPasswordReset(email) {
  // In a real system:
  // 1. Generate a unique, secure token.
  // 2. Store the token with an expiry and user ID in a new table (e.g., password_resets).
  // 3. Send an email to the user with a link containing the token.
  console.log(`Password reset requested for email: ${email}. Token generation and email sending would happen here.`);
  // For this example, we'll simulate finding a user to acknowledge the request.
  const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (result.rows.length > 0) {
    return { success: true, message: `Password reset instructions would be sent to ${email} if it's a registered account.` };
  }
  // Even if email not found, show a generic message to prevent user enumeration
  return { success: true, message: `Password reset instructions would be sent to ${email} if it's a registered account.` };
}

async function resetPassword(token, newPassword) {
  // In a real system:
  // 1. Validate the token (check if it exists in password_resets table, is not expired, etc.).
  // 2. If valid, retrieve the user ID associated with the token.
  // 3. Hash the newPassword.
  // 4. Update the user's password in the 'users' table.
  // 5. Invalidate/delete the token from password_resets table.
  console.log(`Password reset attempt with token: ${token} and new password.`);
  // For this example, we just log.
  // A conceptual check could be:
  // if (isValidToken(token)) {
  //   const userId = getUserIdFromToken(token);
  //   const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  //   await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
  //   return { success: true, message: 'Password has been reset successfully.' };
  // }
  return { success: true, message: 'If the token was valid, the password would have been reset.' };
}

async function changeUserPassword(userId, currentPassword, newPassword) {
  try {
    // Fetch the current hashed password
    const userQuery = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userQuery.rows.length === 0) {
      return { success: false, message: 'User not found.' };
    }
    const storedPasswordHash = userQuery.rows[0].password;

    // Compare currentPassword with the stored hash
    const isMatch = await bcrypt.compare(currentPassword, storedPasswordHash);
    if (!isMatch) {
      return { success: false, message: 'Incorrect current password.' };
    }

    // Hash the newPassword (using saltRounds defined in this file)
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password in the database
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [newPasswordHash, userId]);

    return { success: true, message: 'Password changed successfully.' };
  } catch (error) {
    console.error('Error changing password in authService:', error);
    return { success: false, message: 'Error changing password.' };
  }
}

module.exports = {
  registerUser,
  loginUser, // Now returns user object on success
  generateJwt, // New exported function
  requestPasswordReset,
  resetPassword,
  jwtSecret,
  isAuthenticated,
  changeUserPassword, // Export the new function
  checkPermission,    // Export the new permission checking middleware

  // isAdmin middleware - now checks role from DB
  isAdmin: async (req, res, next) => {
    // This middleware must run AFTER isAuthenticated, so req.user should be populated.
    if (!req.user || !req.user.userId) {
      // This case should ideally be caught by isAuthenticated
      return res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
    }

    try {
      // Ensure role_id is being used if the migration is complete, or adapt as needed.
      // For now, assuming the old 'role' column is still being used by this specific isAdmin.
      // This isAdmin should eventually be replaced by checkPermission('some_super_admin_permission')
      // or checkPermission('admin:access_dashboard') based on the new RBAC.
      const result = await db.query('SELECT role, role_id FROM users WHERE id = $1', [req.user.userId]);
      if (result.rows.length === 0) {
        return res.status(403).json({ message: 'Forbidden: User not found.' });
      }
      // Prefer new role_id system if available and matches a 'Super Admin' concept,
      // otherwise fall back to string role for current isAdmin logic.
      // This part needs careful handling during transition.
      // For now, let's keep it simple and assume 'admin' string role.
      const userRoleString = result.rows[0].role;
      if (userRoleString === 'admin') { // This will need to align with how 'Super Admin' is identified
        next(); // User is admin, proceed
      } else {
        return res.status(403).json({ message: 'Forbidden: Requires admin role.' });
      }
    } catch (error) {
      console.error('isAdmin check error:', error);
      return res.status(500).json({ message: 'Error checking admin status.' });
    }
  }
};

const permissionService = require('./services/permissionService'); // Import the new service
const { AppError } = require('./utils/AppError'); // For sending 403/500 error

// Middleware to check if the user has a specific permission
function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    if (!req.user || !req.user.userId) {
      // This should ideally be caught by isAuthenticated first, but as a safeguard
      return next(new AppError('Authentication required.', 401));
    }

    try {
      // It's good practice to fetch permissions using a DB client from a pool if in a transaction,
      // but for a middleware check, using the default db import is usually fine unless high contention.
      const hasPerm = await permissionService.userHasPermission(req.user.userId, requiredPermission);

      if (hasPerm) {
        next(); // User has the permission, proceed
      } else {
        // User does not have the permission
        console.warn(`User ID ${req.user.userId} (Email: ${req.user.email || 'N/A'}) attempted action without required permission: "${requiredPermission}" on route ${req.originalUrl}`);
        return next(new AppError(`Forbidden: You do not have the required permission ("${requiredPermission}") to perform this action.`, 403));
      }
    } catch (error) {
      // This catches errors from userHasPermission (e.g., database issues in permissionService)
      console.error(`Error checking permission '${requiredPermission}' for user ID ${req.user.userId}:`, error);
      return next(new AppError('An error occurred while verifying permissions.', 500));
    }
  };
}
