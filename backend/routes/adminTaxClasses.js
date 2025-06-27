const express = require('express');
const router = express.Router();
const taxService = require('../services/taxService'); // Import taxService
const { isAuthenticated, isAdmin } = require('../auth');
const { body, query, param, validationResult } = require('express-validator');
// Removed db import as it's no longer directly used here
// AppError types are thrown by service, handled by global error handler

router.use(isAuthenticated, isAdmin);

// POST / - Create a new tax class
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Tax class name is required.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('description').optional({ nullable: true }).trim().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const newTaxClass = await taxService.createTaxClass(req.body);
      res.status(201).json(newTaxClass);
    } catch (error) {
      next(error);
    }
  }
);

// POST /:classId/rates - Link a tax rate to a tax class
router.post(
  '/:classId/rates',
  [
    param('classId').isInt({ gt: 0 }).toInt(),
    body('tax_rate_id').isInt({ gt: 0 }).toInt().withMessage('A valid tax_rate_id is required.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { classId } = req.params;
    const { tax_rate_id } = req.body;
    try {
      const linkedRate = await taxService.linkRateToClass(classId, tax_rate_id);
      res.status(201).json(linkedRate);
    } catch (error) {
      next(error);
    }
  }
);

// GET /:classId/rates - List tax rates for a tax class
router.get(
  '/:classId/rates',
  [param('classId').isInt({ gt: 0 }).toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { classId } = req.params;
    try {
      const rates = await taxService.getRatesForClass(classId);
      res.status(200).json(rates);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:classId/rates/:rateId - Unlink a tax rate from a tax class
router.delete(
  '/:classId/rates/:rateId',
  [
    param('classId').isInt({ gt: 0 }).toInt(),
    param('rateId').isInt({ gt: 0 }).toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { classId, rateId } = req.params;
    try {
      const unlinkedRelation = await taxService.unlinkRateFromClass(classId, rateId);
      res.status(200).json({ message: 'Tax rate unlinked from tax class successfully.', unlinked_relation: unlinkedRelation });
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get a specific tax class
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      const taxClass = await taxService.getTaxClassById(id);
      res.status(200).json(taxClass);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update an existing tax class
router.put(
  '/:id',
  [
    param('id').isInt({ gt: 0 }).toInt(),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty if provided.')
      .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters.'),
    body('description').optional({ nullable: true }).trim().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { name, description } = req.body;

    // The service function will handle the "no fields provided" check.
    // if (name === undefined && description === undefined) {
    //   return next(new BadRequestError('No fields provided for update. Please provide name or description.'));
    // }

    try {
      const updatedTaxClass = await taxService.updateTaxClass(id, { name, description });
      res.status(200).json(updatedTaxClass);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id - Delete a tax class
router.delete(
  '/:id',
  [param('id').isInt({ gt: 0 }).toInt()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      const deletedClass = await taxService.deleteTaxClass(id);
      res.status(200).json({ message: 'Tax class deleted successfully.', deletedClass: deletedClass });
    } catch (error) {
      next(error);
    }
  }
);

// GET / - List all tax classes (paginated)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt().default(10)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { page, limit } = req.query; // These are already validated and defaulted by express-validator
    try {
      const result = await taxService.getAllTaxClasses({ page, limit });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
