const express = require('express');
const { body, query, validationResult } = require('express-validator');
const shippingService = require('../services/shippingService');
const { isAuthenticated, checkPermission } = require('../auth');

const router = express.Router();

// List all couriers
router.get('/couriers', async (req, res, next) => {
  try {
    const couriers = await shippingService.listCouriers();
    res.json({ couriers });
  } catch (err) { next(err); }
});

// Create a courier
router.post('/couriers', [
  isAuthenticated,
  checkPermission('shipping:manage_couriers'),
  body('name').isString().notEmpty(),
  body('contact_info').optional().isString(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const courier = await shippingService.createCourier(req.body);
    res.status(201).json({ courier });
  } catch (err) { next(err); }
});

// Update a courier
router.put('/couriers/:id', [
  isAuthenticated,
  checkPermission('shipping:manage_couriers'),
  body('name').isString().notEmpty(),
  body('contact_info').optional().isString(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const courier = await shippingService.updateCourier(req.params.id, req.body);
    res.json({ courier });
  } catch (err) { next(err); }
});

// Delete a courier
router.delete('/couriers/:id', [
  isAuthenticated,
  checkPermission('shipping:manage_couriers'),
], async (req, res, next) => {
  try {
    await shippingService.deleteCourier(req.params.id);
    res.json({ message: 'Courier deleted successfully' });
  } catch (err) { next(err); }
});

// List all shipping methods
router.get('/methods', async (req, res, next) => {
  try {
    const methods = await shippingService.listShippingMethods();
    res.json({ methods });
  } catch (err) { next(err); }
});

// Create a shipping method
router.post('/methods', [
  isAuthenticated,
  checkPermission('shipping:manage_methods'),
  body('name').isString().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('courier_id').optional().isInt(),
  body('description').optional().isString(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const method = await shippingService.createShippingMethod(req.body);
    res.status(201).json({ method });
  } catch (err) { next(err); }
});

// Update a shipping method
router.put('/methods/:id', [
  isAuthenticated,
  checkPermission('shipping:manage_methods'),
  body('name').isString().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('courier_id').optional().isInt(),
  body('description').optional().isString(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const method = await shippingService.updateShippingMethod(req.params.id, req.body);
    res.json({ method });
  } catch (err) { next(err); }
});

// Delete a shipping method
router.delete('/methods/:id', [
  isAuthenticated,
  checkPermission('shipping:manage_methods'),
], async (req, res, next) => {
  try {
    await shippingService.deleteShippingMethod(req.params.id);
    res.json({ message: 'Shipping method deleted successfully' });
  } catch (err) { next(err); }
});

// Get available shipping options (for checkout)
router.get('/options', async (req, res, next) => {
  try {
    // In a real system, pass cart/address info from query/body
    const options = await shippingService.getAvailableShippingOptions();
    res.json({ options });
  } catch (err) { next(err); }
});

module.exports = router; 