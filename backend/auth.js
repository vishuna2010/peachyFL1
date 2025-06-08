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

module.exports = {
  registerUser,
  loginUser, // Now returns user object on success
  generateJwt, // New exported function
  requestPasswordReset,
  resetPassword,
  jwtSecret,
  isAuthenticated,

  // isAdmin middleware - now checks role from DB
  isAdmin: async (req, res, next) => {
    // This middleware must run AFTER isAuthenticated, so req.user should be populated.
    if (!req.user || !req.user.userId) {
      // This case should ideally be caught by isAuthenticated
      return res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
    }

    try {
      const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.userId]);
      if (result.rows.length === 0) {
        return res.status(403).json({ message: 'Forbidden: User not found.' });
      }
      const userRole = result.rows[0].role;
      if (userRole === 'admin') {
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
