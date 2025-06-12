const express = require('express');
const router = express.Router();
const db = require('../db');
const authService = require('../auth'); // For isAuthenticated middleware
const { body, validationResult } = require('express-validator');

// PUT /api/users/me/profile - Update current user's profile
router.put(
  '/me/profile',
  authService.isAuthenticated,
  [
    body('name').optional().isString().trim().notEmpty().withMessage('Name must be a non-empty string.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    // Add other updatable fields here with their own validation if needed in the future
    // For example: body('bio').optional().isString().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId; // Assuming userId is on req.user from isAuthenticated middleware
    const { name } = req.body;

    if (!name) {
      // If only 'name' is updatable for now and it's not provided (though optional() allows it)
      // you might want to return early or handle it based on product requirements.
      // If other fields were present, this check might be different.
      return res.status(400).json({ message: 'No updateable fields provided or name is empty.' });
    }

    try {
      const result = await db.query(
        'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name, role, created_at, updated_at, is_two_fa_enabled',
        [name, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Exclude sensitive data if any were accidentally returned (password is not selected here)
      const updatedUser = result.rows[0];

      res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });
    } catch (error) {
      console.error('Error updating user profile:', error);
      // Check for specific DB errors if necessary, e.g., unique constraint violations if 'name' had to be unique
      res.status(500).json({ message: 'Error updating profile.' });
    }
  }
);

module.exports = router;
