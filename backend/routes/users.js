const express = require('express');
const router = express.Router();
const authService = require('../auth'); // For isAuthenticated middleware
const userService = require('../services/userService'); // Import userService
const { body, validationResult } = require('express-validator');
// Removed db import, specific error types will be handled by global error handler via next(error)

// PUT /api/users/me/profile - Update current user's profile
router.put(
  '/me/profile',
  authService.isAuthenticated,
  [
    // Validation ensures 'name' if provided, meets criteria.
    // The service will also validate if 'name' is empty after trim if it's the only field.
    body('name').optional().isString().trim()
      .notEmpty().withMessage('Name cannot be an empty string if provided.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters if provided.'),
    // Add other updatable fields here with their own validation if needed in the future
  ],
  async (req, res, next) => { // Added next parameter
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const profileData = req.body; // Pass the whole body, service will pick relevant fields

    // A preliminary check: if body is empty or only contains non-updatable fields (currently only 'name' is updatable by user)
    // The service will perform a more specific check if 'name' is missing or invalid.
    if (Object.keys(profileData).length === 0 || (profileData.name === undefined && Object.keys(profileData).length === 1 && profileData.hasOwnProperty('name_is_not_the_only_key_check'))) {
        // A more robust check if other fields were possible:
        // const updatableFieldsInRequest = Object.keys(profileData).filter(key => ['name', 'other_field'].includes(key));
        // if (updatableFieldsInRequest.length === 0) { ... }
      if (profileData.name === undefined) { // Simplified: if 'name' is not in body and no other fields are updatable yet.
        return res.status(400).json({ message: 'No profile data provided for update.' });
      }
    }

    try {
      const updatedUser = await userService.updateUserProfile(userId, profileData);
      res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });
    } catch (error) {
      // Service function will throw AppError instances (NotFoundError, BadRequestError, etc.)
      next(error); // Pass to global error handler
    }
  }
);

module.exports = router;
