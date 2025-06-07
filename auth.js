const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assuming db.js is in the same directory

const saltRounds = 10; // For bcrypt hashing
const jwtSecret = 'your-super-secret-key'; // IMPORTANT: Use an environment variable in production!

async function registerUser(email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashedPassword]
    );
    return { success: true, user: result.rows[0] };
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

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '1h' });
      return { success: true, token: token };
    } else {
      return { success: false, message: 'Incorrect password.' };
    }
  } catch (error) {
    console.error('Error logging in user:', error);
    return { success: false, message: 'Error logging in user.' };
  }
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
  loginUser,
  requestPasswordReset,
  resetPassword,
  jwtSecret, // Exporting for potential middleware usage if needed later

  // Placeholder isAdmin middleware
  isAdmin: (req, res, next) => {
    // In a real application, you would verify admin privileges here.
    // For example, decode JWT, check user role from DB, etc.
    console.log('isAdmin middleware called (placeholder - allowing request)');
    next();
  }
};
