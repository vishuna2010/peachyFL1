const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const config = require('./config'); // Import the centralized config
const emailService = require('./services/emailService'); // Import EmailService

const saltRounds = 10; // This could also be moved to config if desired
const jwtSecret = config.jwtSecret; // Use jwtSecret from config

const permissionService = require('./services/permissionService'); // Import the permission service
const { AppError } = require('./utils/AppError'); // For sending 403/500 errors consistently

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
      // console.log('[Auth] isAuthenticated: req.user populated:', JSON.stringify(req.user)); // Removed log
      next();
    });
  } else {
    // No token provided
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }
};

// Middleware to try to authenticate user, but doesn't fail if no token
const tryAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (!err) {
        req.user = decoded; // Populate req.user if token is valid
      }
      // Always call next, even if token is invalid or not present
      // The route handler will then check req.user if it needs to differentiate
      next();
    });
  } else {
    // No token, just proceed
    next();
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
    const user = result.rows[0]; // Contains id, email, role, created_at

    // Generate verification token
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Token expires in 15 minutes

    // Store token and expiry in the users table
    // Assumes columns: email_verification_token, email_verification_token_expires_at, is_email_verified (defaults to FALSE)
    await db.query(
      'UPDATE users SET email_verification_token = $1, email_verification_token_expires_at = $2 WHERE id = $3',
      [verificationToken, expiresAt, user.id]
    );

    // REMOVED: Welcome email sending. This will now happen after verification.
    // The route handler for /register will now be responsible for calling
    // a new emailService function to send the verification code.

    const { password: _, ...userWithoutPassword } = user;
    // Add token to response for now, for immediate use by email sending in route handler.
    // In a more robust scenario, the route handler might fetch this if needed, or the service returns it.
    userWithoutPassword.email_verification_token = verificationToken;

    return { success: true, user: userWithoutPassword };
  } catch (error) {
    console.error('Error registering user or setting verification token:', error);
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
      // Password matches. Now check email verification status.
      // The 'users' table schema is assumed to have 'is_email_verified' (BOOLEAN NOT NULL DEFAULT FALSE).
      // This field should have been selected in the initial query: 'SELECT * FROM users WHERE email = $1'
      if (!user.is_email_verified) {
        return {
          success: false,
          message: 'Email not verified. Please check your email for a verification code.',
          errorCode: 'EMAIL_NOT_VERIFIED', // Custom error code for frontend to handle
          userId: user.id // Optionally return userId to help frontend direct to verification page
        };
      }

      // Email is verified, proceed with returning user object for 2FA check or JWT generation
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

// Real Password Recovery Implementation
async function requestPasswordReset(email) {
  try {
    // Check if user exists
    const userResult = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return { success: true, message: 'If an account with that email exists, password reset instructions have been sent.' };
    }

    const user = userResult.rows[0];
    
    // Generate a secure random token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Store the token in the database
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    // Send password reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    emailService.sendPasswordResetEmail(user.email, user.email.split('@')[0], resetLink)
      .then(emailRes => {
        if (emailRes.success) {
          console.log(`Password reset email sent to ${user.email}`);
        } else {
          console.error(`Failed to send password reset email to ${user.email}: ${emailRes.error}`);
        }
      })
      .catch(err => {
        console.error(`Error sending password reset email to ${user.email}:`, err);
      });
    
    return { success: true, message: 'If an account with that email exists, password reset instructions have been sent.' };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return { success: false, message: 'Error processing password reset request.' };
  }
}

async function resetPassword(token, newPassword) {
  try {
    // Validate password
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }
    
    // Find the token and check if it's valid and not expired
    const tokenResult = await db.query(
      `SELECT prt.user_id, prt.used_at, u.email 
       FROM password_reset_tokens prt 
       JOIN users u ON prt.user_id = u.id 
       WHERE prt.token = $1 AND prt.expires_at > NOW()`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return { success: false, message: 'Invalid or expired reset token.' };
    }
    
    const resetToken = tokenResult.rows[0];
    
    // Check if token has already been used
    if (resetToken.used_at) {
      return { success: false, message: 'This reset token has already been used.' };
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the user's password
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetToken.user_id]);
    
    // Mark the token as used
    await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1', [token]);
    
    // Clean up expired tokens for this user
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND expires_at < NOW()', [resetToken.user_id]);
    
    return { success: true, message: 'Password has been reset successfully. You can now log in with your new password.' };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, message: 'Error resetting password. Please try again.' };
  }
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

// Middleware to check if the user has a specific permission (moved here, before module.exports)
function checkPermission(requiredPermission) {
  return async (req, res, next) => {
    if (!req.user || !req.user.userId) {
      // console.warn(`[checkPermission Middleware] Authentication issue: req.user or req.user.userId missing.`); // Keep minimal if needed
      return next(new AppError('Authentication required for permission check.', 401));
    }
    try {
      const hasPerm = await permissionService.userHasPermission(req.user.userId, requiredPermission);
      if (hasPerm) {
        next();
      } else {
        console.warn(`User ID ${req.user.userId} (Email: ${req.user.email || 'N/A'}) lacks permission: "${requiredPermission}" for ${req.method} ${req.originalUrl}`); // Retain this important warning
        return next(new AppError(`Forbidden: You do not have the required permission ("${requiredPermission}") to perform this action.`, 403));
      }
    } catch (error) {
      console.error(`Error in checkPermission middleware for '${requiredPermission}', user ID ${req.user.userId}:`, error); // Retain error log
      return next(new AppError('An error occurred while verifying permissions.', 500));
    }
  };
}

module.exports = {
  registerUser,
  loginUser, // Now returns user object on success
  generateJwt, // New exported function
  requestPasswordReset,
  resetPassword,
  jwtSecret,
  isAuthenticated,
  tryAuthenticate,    // Export tryAuthenticate
  changeUserPassword, // Export the new function
  checkPermission,    // Export the new permission checking middleware

  // isAdmin middleware - Refactored to use checkPermission
  isAdmin: (req, res, next) => {
    // This middleware must run AFTER isAuthenticated.
    // It now checks for a general admin access permission.
    // Note: This makes `isAdmin` asynchronous because `checkPermission` returns an async handler.
    // If any route was using `router.use(isAdmin)` directly without `await` or it wasn't part of an async chain,
    // this could be an issue. However, Express handles arrays of middleware including async ones.
    return checkPermission('admin:access_dashboard')(req, res, next);
  }
};
