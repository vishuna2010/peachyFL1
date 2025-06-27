const express = require('express');
const router = express.Router();
// const db = require('../db'); // No longer directly needed
const { isAuthenticated, checkPermission } = require('../auth');
const { body, param, query, validationResult } = require('express-validator');
const { ConflictError, NotFoundError, BadRequestError, AppError } = require('../utils/AppError');
const supplierService = require('../services/supplierService');

// Validation chains
const commonSupplierValidations = [
  body('name').trim().notEmpty().withMessage('Supplier name is required.').isString().isLength({ min: 2, max: 255 }).withMessage('Supplier name must be between 2 and 255 characters.'),
  body('contact_person').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email format.').toLowerCase().trim(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('address_line1').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('address_line2').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
  body('city').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('postal_code').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('country').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('notes').optional({ nullable: true }).isString().trim(),
  body('currency_code').optional({ nullable: true }).isString().isLength({ min: 3, max: 3 }).withMessage('Currency code must be 3 letters.').toUpperCase()
];

const validateSupplierIdParam = [
  param('id').isInt({ gt: 0 }).withMessage('Supplier ID must be a positive integer.').toInt()
];

const validatePaginationParams = [
  query('page').optional().isInt({ min: 1 }).toInt().default(1),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20)
];


// POST /api/admin/suppliers - Create a new supplier
router.post('/',
  isAuthenticated,
  checkPermission('suppliers:manage'),
  commonSupplierValidations, // Apply validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // req.body will contain validated and sanitized data
      const newSupplier = await supplierService.createSupplier(req.body);
      res.status(201).json(newSupplier);
    } catch (error) {
      // Errors from service (ConflictError, AppError, etc.) are passed to global handler
      next(error);
    }
});

// GET /api/admin/suppliers - List all suppliers
router.get('/',
  isAuthenticated,
  checkPermission('suppliers:manage'),
  validatePaginationParams, // Apply validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // page and limit are validated and defaulted by express-validator
    const { page, limit } = req.query;

    try {
      const result = await supplierService.getAllSuppliers({ page, limit });
      res.status(200).json({
          data: result.suppliers,
          pagination: {
              total: result.totalSuppliers,
              page: result.page,
              limit: result.limit,
              totalPages: result.totalPages,
          }
      });
    } catch (error) {
      next(error);
    }
});

// GET /api/admin/suppliers/:id - Get a specific supplier
router.get('/:id',
  isAuthenticated,
  checkPermission('suppliers:manage'),
  validateSupplierIdParam, // Apply validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params; // id is validated and sanitized by toInt()

    try {
      const supplier = await supplierService.getSupplierById(id);
      // Service throws NotFoundError if not found
      res.status(200).json(supplier);
    } catch (error) {
      next(error);
    }
});

// PUT /api/admin/suppliers/:id - Update a supplier
router.put('/:id',
  isAuthenticated,
  checkPermission('suppliers:manage'),
  validateSupplierIdParam, // Validate ID from param
  commonSupplierValidations, // Apply common validations to body (all fields optional for PUT)
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params; // Validated id
    const updateData = req.body; // Validated and sanitized fields

    // Construct an object with only the fields that are actually present in the request body
    const fieldsToUpdate = {};
    const updatableFields = [
      'name', 'contact_person', 'email', 'phone', 'address_line1',
      'address_line2', 'city', 'postal_code', 'country', 'notes', 'currency_code'
    ];

    let hasUpdate = false;
    for (const field of updatableFields) {
      if (updateData.hasOwnProperty(field)) {
        fieldsToUpdate[field] = updateData[field];
        hasUpdate = true;
      }
    }

    if (!hasUpdate) {
      return next(new BadRequestError('No valid fields provided for update.'));
    }

    try {
      const updatedSupplier = await supplierService.updateSupplier(id, fieldsToUpdate);
      res.status(200).json(updatedSupplier);
    } catch (error) {
      // Service layer handles NotFoundError, ConflictError, BadRequestError, AppError
      next(error);
    }
});

// DELETE /api/admin/suppliers/:id - Delete a supplier
router.delete('/:id',
  isAuthenticated,
  checkPermission('suppliers:manage'),
  validateSupplierIdParam, // Apply validation
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params; // Validated id

    try {
      const deletedSupplier = await supplierService.deleteSupplier(id);
      // Service throws NotFoundError or BadRequestError (if dependencies exist)
      res.status(200).json({ message: 'Supplier deleted successfully.', supplier: deletedSupplier });
      // Consider res.status(204).send() for DELETE operations if no content is returned.
      // However, returning the deleted object can be useful for client-side state updates.
    } catch (error) {
      next(error);
    }
});

module.exports = router;
