const express = require('express');
const { isAuthenticated, checkPermission } = require('../auth'); // Updated auth import
const { body, param, validationResult } = require('express-validator');
// const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError'); // AppError types are thrown by service
const optionService = require('../services/optionService'); // Import the new service

// Router for /api/admin/options
const optionsRouter = express.Router();
// Apply permission check to all routes on this router
optionsRouter.use(isAuthenticated, checkPermission('options:manage_global'));

// Router for /api/admin/option-values
const optionValuesRouter = express.Router();
// Apply permission check to all routes on this router
optionValuesRouter.use(isAuthenticated, checkPermission('options:manage_global'));


// === Product Options (Global Types like "Color", "Size") ===

// POST /api/admin/options - Create a new global option type
optionsRouter.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Option name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Option name must be between 2 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name } = req.body;
    try {
      const newOptionType = await optionService.createOptionType(name);
      res.status(201).json(newOptionType);
    } catch (error) {
      // Errors (ConflictError, AppError) from service are passed to global error handler
      next(error);
    }
  }
);

// GET /api/admin/options - List all global option types
optionsRouter.get('/', async (req, res, next) => {
  try {
    const optionTypes = await optionService.getAllOptionTypes();
    res.json({ data: optionTypes }); // Wrap in data for consistency if other list endpoints do
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/options/:optionId - Get a specific global option type
optionsRouter.get(
  '/:optionId',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    try {
      const optionType = await optionService.getOptionTypeById(optionId);
      // Service throws NotFoundError if not found
      res.json(optionType);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/options/:optionId - Update a global option type's name
optionsRouter.put(
  '/:optionId',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.').toInt(),
    body('name').isString().trim().notEmpty().withMessage('Option name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Option name must be between 2 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    const { name } = req.body;
    try {
      const updatedOptionType = await optionService.updateOptionType(optionId, name);
      // Service throws NotFoundError or ConflictError
      res.json(updatedOptionType);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/options/:optionId - Delete a global option type
optionsRouter.delete(
  '/:optionId',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    try {
      await optionService.deleteOptionType(optionId);
      // Service throws NotFoundError or BadRequestError
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);


// === Product Option Values (Values like "Red", "Small" for a given Option Type) ===

// POST /api/admin/options/:optionId/values - Create a new value for a specific global option type
optionsRouter.post(
  '/:optionId/values',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.').toInt(),
    body('value').isString().trim().notEmpty().withMessage('Option value is required.')
      .isLength({ min: 1, max: 255 }).withMessage('Option value must be between 1 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    const { value } = req.body;
    try {
      const newOptionValue = await optionService.createOptionValue(optionId, value);
      // Service handles NotFoundError for optionId, ConflictError for value
      res.status(201).json(newOptionValue);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/options/:optionId/values - List all global values for a specific option type
optionsRouter.get(
  '/:optionId/values',
  [
    param('optionId').isInt({ gt: 0 }).withMessage('Option ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { optionId } = req.params;
    try {
      const optionValues = await optionService.getAllOptionValuesForType(optionId);
      // Service handles NotFoundError for optionId
      res.json({ data: optionValues }); // Wrap in data for consistency
    } catch (error) {
      next(error);
    }
  }
);


// === Standalone Option Value Management via /api/admin/option-values ===

// GET /api/admin/option-values/:valueId - Get a specific global option value
optionValuesRouter.get(
  '/:valueId',
  [
    param('valueId').isInt({ gt: 0 }).withMessage('Value ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { valueId } = req.params;
    try {
      const optionValue = await optionService.getOptionValueById(valueId);
      // Service throws NotFoundError
      res.json(optionValue);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/option-values/:valueId - Update a global option value
optionValuesRouter.put(
  '/:valueId',
  [
    param('valueId').isInt({ gt: 0 }).withMessage('Value ID must be a positive integer.').toInt(),
    body('value').isString().trim().notEmpty().withMessage('Option value is required.')
      .isLength({ min: 1, max: 255 }).withMessage('Option value must be between 1 and 255 characters.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { valueId } = req.params;
    const { value } = req.body;
    try {
      const updatedOptionValue = await optionService.updateOptionValue(valueId, value);
      // Service throws NotFoundError or ConflictError
      res.json(updatedOptionValue);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/option-values/:valueId - Delete a specific global option value
optionValuesRouter.delete(
  '/:valueId',
  [
    param('valueId').isInt({ gt: 0 }).withMessage('Value ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { valueId } = req.params;
    try {
      await optionService.deleteOptionValue(valueId);
      // Service throws NotFoundError or BadRequestError
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = {
  optionsRouter,      // To be mounted at /api/admin/options
  optionValuesRouter  // To be mounted at /api/admin/option-values
};
