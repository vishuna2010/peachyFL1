const express = require('express');
const router = express.Router();
const authService = require('../auth'); // Renamed original auth.js to authService for clarity
const db = require('../db'); // For 2FA direct DB check
const { authenticator } = require('otplib');

// Register
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  const result = await authService.requestPasswordReset(email);
  res.status(200).json({ message: result.message });
});

// Reset Password
router.post('/reset-password', async (req, res) => {
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

// POST /api/auth/2fa/verify - Verify TOTP token and enable 2FA
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
router.post('/2fa/login-verify', async (req, res) => {
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


module.exports = router;
