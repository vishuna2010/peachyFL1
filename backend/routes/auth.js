const express = require('express');
const router = express.Router();
const authService = require('../auth'); // Renamed original auth.js to authService for clarity
const db = require('../db'); // For 2FA direct DB check
const { authenticator } = require('otplib');
const rateLimit = require('express-rate-limit');

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

// Rate limiter for registration attempts
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 registration requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many accounts created from this IP, please try again after an hour.' }
});

// Rate limiter for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // Limit each IP to 5 password reset requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts from this IP, please try again after 30 minutes.' }
});

// Rate limiter for change password attempts
const changePasswordLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // Limit each IP to 5 change password requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password change attempts from this IP, please try again after 30 minutes.' }
});

// Register
router.post('/register', registerLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const result = await authService.registerUser(email, password);
  if (result.success) {
    const userResponse = result.user ? (({ password, ...rest }) => rest)(result.user) : {};
    res.status(201).json({ message: 'User registered successfully.', user: userResponse });
  } else {
    res.status(400).json({ message: result.message });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const loginResult = await authService.loginUser(email, password);

  if (!loginResult.success) {
    return res.status(401).json({ message: loginResult.message });
  }

  const user = loginResult.user; // User object includes is_two_fa_enabled, id, email, role

  if (user.is_two_fa_enabled) {
    // 2FA is enabled, do not issue JWT yet.
    return res.status(200).json({
      success: true,
      twoFactorRequired: true,
      userId: user.id, // Send userId for the next step
      message: "Please enter your 2FA code."
    });
  } else {
    // 2FA is not enabled, issue JWT and log in directly.
    const token = authService.generateJwt(user);
    // Exclude sensitive fields from user object returned to client
    const { two_fa_secret: _, ...userResponse } = user;
    return res.status(200).json({
      success: true,
      twoFactorRequired: false,
      token: token,
      user: userResponse // Send back user details (id, email, role, is_two_fa_enabled)
    });
  }
});

// Request Password Reset
router.post('/request-password-reset', passwordResetLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  const result = await authService.requestPasswordReset(email);
  res.status(200).json({ message: result.message });
});

// Reset Password
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }
  const result = await authService.resetPassword(token, newPassword);
  res.status(200).json({ message: result.message });
});


// --- 2FA Setup Route ---
router.post('/2fa/setup', authService.isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Check if 2FA is already enabled for the user
    const userCheckResult = await db.query('SELECT is_two_fa_enabled FROM users WHERE id = $1', [userId]);
    if (userCheckResult.rows.length > 0 && userCheckResult.rows[0].is_two_fa_enabled) {
      return res.status(400).json({ message: '2FA is already enabled for this account. Please disable it first if you want to re-setup.' });
    }

    const secret = authenticator.generateSecret();
    const appName = process.env.APP_NAME || 'MyECommerceApp';
    const otpAuthUrl = authenticator.keyuri(userEmail, appName, secret);

    res.status(200).json({
      success: true,
      secret: secret,
      otpAuthUrl: otpAuthUrl
    });

  } catch (error) {
    console.error('Error during 2FA setup process:', error);
    res.status(500).json({ message: 'Failed to start 2FA setup process.', error: error.message });
  }
});

// POST /api/auth/2fa/verify - Verify TOTP token and enable 2FA
// This route appears duplicated below. Applying limiter to both instances as per current file structure.
router.post('/2fa/verify', authService.isAuthenticated, async (req, res) => {
  const { token, secret } = req.body;
  const userId = req.user.userId;

  // 1. Validation
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'A valid 6-digit TOTP token is required.' });
  }
  if (!secret || typeof secret !== 'string' || secret.length < 16) { // Basic check for secret presence and min length
    return res.status(400).json({ success: false, message: 'A valid 2FA secret is required for verification.' });
  }

  try {
    // 2. Verify TOTP Token
    // The secret here is the one generated during /2fa/setup and passed back by the client.
    const isValid = authenticator.verify({ token: token, secret: secret });

    if (isValid) {
      // 3. If valid, update user's record in the database
      // Note: The 'users' table schema was updated in a previous step to include two_fa_secret and is_two_fa_enabled.
      // We also conceptually noted adding 'updated_at'. If it exists, it should be updated.
      // Assuming 'users' table does NOT yet have 'updated_at' based on its last explicit schema definition.
      const updateQuery = `
        UPDATE users
        SET two_fa_secret = $1, is_two_fa_enabled = TRUE
        WHERE id = $2
        RETURNING id, email, is_two_fa_enabled;
      `;
      // If 'updated_at' existed:
      // SET two_fa_secret = $1, is_two_fa_enabled = TRUE, updated_at = CURRENT_TIMESTAMP

      const result = await db.query(updateQuery, [secret, userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'User not found for enabling 2FA.' });
      }

      return res.status(200).json({ success: true, message: '2FA enabled successfully.' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid TOTP code. Please check your authenticator app and try again.' });
    }
  } catch (error) {
    console.error('Error during 2FA verification:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA token.', error: error.message });
  }
});

// POST /api/auth/2fa/verify - Verify TOTP token and enable 2FA (Duplicate route)
router.post('/2fa/verify', authService.isAuthenticated, async (req, res) => {
  const { token, secret } = req.body;
  const userId = req.user.userId;

  // 1. Validation
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'A valid 6-digit TOTP token is required.' });
  }
  if (!secret || typeof secret !== 'string' || secret.length < 16) { // Basic check for secret presence and min length
    return res.status(400).json({ success: false, message: 'A valid 2FA secret is required for verification.' });
  }

  try {
    // 2. Verify TOTP Token
    const isValid = authenticator.verify({ token: token, secret: secret });

    if (isValid) {
      const updateQuery = `
        UPDATE users
        SET two_fa_secret = $1, is_two_fa_enabled = TRUE
        WHERE id = $2
        RETURNING id, email, is_two_fa_enabled;
      `;
      // If 'users.updated_at' existed: SET two_fa_secret = $1, is_two_fa_enabled = TRUE, updated_at = CURRENT_TIMESTAMP

      const result = await db.query(updateQuery, [secret, userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'User not found for enabling 2FA.' });
      }

      return res.status(200).json({ success: true, message: '2FA enabled successfully.' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid TOTP code. Please check your authenticator app and try again.' });
    }
  } catch (error) {
    console.error('Error during 2FA verification:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA token.', error: error.message });
  }
});

// POST /api/auth/2fa/login-verify - Verify TOTP for login
router.post('/2fa/login-verify', loginLimiter, async (req, res) => {
  const { userId, token } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required.' });
  }
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'A valid 6-digit TOTP token is required.' });
  }

  try {
    const userResult = await db.query(
      'SELECT id, email, role, is_two_fa_enabled, two_fa_secret FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult.rows[0];

    if (!user.is_two_fa_enabled || !user.two_fa_secret) {
      // This case implies an issue or an attempt to bypass 2FA for a user not fully set up.
      return res.status(400).json({ success: false, message: '2FA is not enabled or configured for this user.' });
    }

    const isValid = authenticator.verify({ token: token, secret: user.two_fa_secret });

    if (isValid) {
      const jwtToken = authService.generateJwt(user); // user object contains id, email, role
      // Exclude sensitive fields from user object returned to client
      const { two_fa_secret: _, password: __, ...userResponse } = user;
      return res.status(200).json({
        success: true,
        token: jwtToken,
        user: userResponse
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid 2FA code.' });
    }
  } catch (error) {
    console.error('Error during 2FA login verification:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA login token.', error: error.message });
  }
});

// Change Password
router.post('/change-password', authService.isAuthenticated, changePasswordLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }

  if (newPassword.length < 8) { // Example: Enforce minimum password length
    return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
  }

  try {
    const result = await authService.changeUserPassword(userId, currentPassword, newPassword);

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      // Determine appropriate status code based on the message
      if (result.message === 'User not found.') {
        return res.status(404).json({ message: result.message });
      } else if (result.message === 'Incorrect current password.') {
        return res.status(401).json({ message: result.message });
      }
      // Generic error for other cases from authService.changeUserPassword
      return res.status(400).json({ message: result.message });
    }
  } catch (error) {
    // This catch block is for unexpected errors in the route handler itself,
    // or if authService.changeUserPassword throws an unhandled exception (which it shouldn't based on its design).
    console.error('Error in /change-password route:', error);
    res.status(500).json({ message: 'An unexpected error occurred while changing password.' });
  }
});

// GET /api/auth/me - Get current authenticated user's details
router.get('/me', authService.isAuthenticated, async (req, res) => {
  // authService.isAuthenticated populates req.user with the JWT payload
  // The payload should contain id (as userId), email, and role, as set during JWT generation.
  if (!req.user) {
    // This case should ideally not be reached if isAuthenticated middleware works correctly
    return res.status(401).json({ message: 'Authentication error: User not found in request.' });
  }

  // Construct user details to return.
  // Ensure we only pick necessary and safe fields.
  // The JWT payload from generateJwt(user) in authService.js would contain:
  // { userId: user.id, email: user.email, role: user.role }
  // So, req.user will reflect these.
  const userDetails = {
    id: req.user.userId, // map userId from token to id
    email: req.user.email,
    role: req.user.role
    // Add any other safe fields that are in the JWT payload and needed by the frontend
    // e.g., is_two_fa_enabled, if that's part of the JWT payload.
    // For now, let's assume the JWT has what's needed for basic authUser state.
  };

  // Example: If you also put is_two_fa_enabled into the JWT payload (e.g. in authService.generateJwt)
  // if (typeof req.user.is_two_fa_enabled !== 'undefined') {
  //   userDetails.is_two_fa_enabled = req.user.is_two_fa_enabled;
  // }

  res.status(200).json({ user: userDetails });
});

module.exports = router;
