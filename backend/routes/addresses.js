const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../auth');
const { body, param, validationResult } = require('express-validator');
const { BadRequestError } = require('../utils/AppError');
const addressService = require('../services/addressService');

// Validation chains
const addressValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required.').isLength({ min: 1, max: 255 }).withMessage('First name must be between 1 and 255 characters.'),
  body('last_name').trim().notEmpty().withMessage('Last name is required.').isLength({ min: 1, max: 255 }).withMessage('Last name must be between 1 and 255 characters.'),
  body('address_line1').trim().notEmpty().withMessage('Address line 1 is required.').isLength({ min: 1, max: 255 }).withMessage('Address line 1 must be between 1 and 255 characters.'),
  body('city').trim().notEmpty().withMessage('City is required.').isLength({ min: 1, max: 100 }).withMessage('City must be between 1 and 100 characters.'),
  body('state_province').trim().notEmpty().withMessage('State/province is required.').isLength({ min: 1, max: 100 }).withMessage('State/province must be between 1 and 100 characters.'),
  body('postal_code').trim().notEmpty().withMessage('Postal code is required.').isLength({ min: 1, max: 20 }).withMessage('Postal code must be between 1 and 20 characters.'),
  body('country').trim().notEmpty().withMessage('Country is required.').isLength({ min: 2, max: 2 }).withMessage('Country must be a 2-letter country code.'),
  body('company').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Company must be 255 characters or less.'),
  body('address_line2').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Address line 2 must be 255 characters or less.'),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less.'),
  body('address_type').optional().isIn(['shipping', 'billing']).withMessage('Address type must be either "shipping" or "billing".'),
  body('is_default').optional().isBoolean().withMessage('is_default must be a boolean.')
];

const addressIdValidation = [
  param('id').isInt({ gt: 0 }).withMessage('Address ID must be a positive integer.').toInt()
];

// GET /api/addresses - Get all addresses for the authenticated user
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const addresses = await addressService.getUserAddresses(req.user.userId);
    res.status(200).json({ addresses });
  } catch (error) {
    next(error);
  }
});

// GET /api/addresses/default-shipping - Get default shipping address
router.get('/default-shipping', isAuthenticated, async (req, res, next) => {
  try {
    const address = await addressService.getDefaultShippingAddress(req.user.userId);
    res.status(200).json({ address });
  } catch (error) {
    next(error);
  }
});

// GET /api/addresses/:id - Get a specific address
router.get('/:id', isAuthenticated, addressIdValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const address = await addressService.getAddressById(req.params.id, req.user.userId);
    res.status(200).json({ address });
  } catch (error) {
    next(error);
  }
});

// POST /api/addresses - Create a new address
router.post('/', isAuthenticated, addressValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const address = await addressService.createAddress(req.user.userId, req.body);
    res.status(201).json({ address });
  } catch (error) {
    next(error);
  }
});

// PUT /api/addresses/:id - Update an address
router.put('/:id', isAuthenticated, [...addressIdValidation, ...addressValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const address = await addressService.updateAddress(req.params.id, req.user.userId, req.body);
    res.status(200).json({ address });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/addresses/:id - Delete an address
router.delete('/:id', isAuthenticated, addressIdValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const address = await addressService.deleteAddress(req.params.id, req.user.userId);
    res.status(200).json({ message: 'Address deleted successfully.', address });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 