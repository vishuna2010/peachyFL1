const express = require('express');
const router = express.Router();
// const db = require('../db'); // To be removed
const { isAuthenticated, checkPermission } = require('../auth');
const { body, param, query, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError, AppError, ConflictError } = require('../utils/AppError');
const purchaseOrderService = require('../services/purchaseOrderService'); // Import the new service
const auditLogService = require('../services/auditLogService'); // For audit logging

const ALLOWED_PO_STATUSES = ['pending', 'ordered', 'partially_received', 'received', 'cancelled'];

// Validation Chains
const validatePOCreate = [
  body('supplier_id').isInt({ gt: 0 }).withMessage('Valid supplier_id is required.').toInt(),
  body('order_date').optional().isISO8601().toDate().withMessage('Invalid order_date format.'),
  body('expected_delivery_date').optional({nullable: true}).isISO8601().toDate().withMessage('Invalid expected_delivery_date format.'),
  body('notes').optional({nullable: true}).isString().trim(),
  body('items').isArray({ min: 1 }).withMessage('Purchase order must contain at least one item.'),
  body('items.*.product_id').isInt({ gt: 0 }).withMessage('Each item must have a valid product_id.').toInt(),
  body('items.*.product_variant_id').optional({nullable: true}).isInt({ gt: 0 }).withMessage('If provided, product_variant_id must be a valid positive integer.').toInt(),
  body('items.*.quantity_ordered').isInt({ gt: 0 }).withMessage('Item quantity_ordered must be a positive integer.').toInt(),
  body('items.*.unit_cost_price').isFloat({ gt: -1 }).withMessage('Item unit_cost_price must be a non-negative number.').toFloat(),
  body('items.*.currency_code').optional({nullable:true}).isString().isLength({min:3, max:3}).toUpperCase().withMessage('Item currency_code must be 3 letters if provided.')
];

const validatePOId = param('id').isInt({ gt: 0 }).withMessage('PO ID must be a positive integer.').toInt();
const validatePOItemId = param('poItemId').isInt({ gt: 0 }).withMessage('PO Item ID must be a positive integer.').toInt();

const validateReceiveStock = [
  validatePOId,
  validatePOItemId,
  body('quantity_received_now').isInt({ gt: 0 }).withMessage('quantity_received_now must be a positive integer.').toInt(),
  body('exchange_rate_to_base').optional({nullable: true}).isFloat({ gt: 0 }).withMessage('exchange_rate_to_base must be a positive number if provided.').toFloat(),
  body('batch_number').optional({nullable: true}).isString().trim().notEmpty().withMessage('batch_number must be a non-empty string if provided.'),
  body('expiry_date').optional({nullable: true}).isISO8601().toDate().withMessage('Invalid expiry_date format (YYYY-MM-DD).')
];

const validateListPOs = [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    // TODO: Add filters for supplier_id, status etc.
];

const validateUpdatePOHeader = [
    validatePOId,
    body('status').optional().trim().toLowerCase().isIn(ALLOWED_PO_STATUSES).withMessage(`Invalid status. Allowed: ${ALLOWED_PO_STATUSES.join(', ')}`),
    body('expected_delivery_date').optional({nullable: true}).isISO8601().toDate().withMessage('Invalid expected_delivery_date format.'),
    body('notes').optional({nullable: true}).isString().trim(),
    body('supplier_id').optional().isInt({ gt: 0 }).withMessage('Valid supplier_id is required if provided.').toInt(),
    body('order_date').optional().isISO8601().toDate().withMessage('Invalid order_date format.'),
    body('shipping_carrier').optional({nullable: true}).isString().trim().isLength({max: 100}),
    body('tracking_number').optional({nullable: true}).isString().trim().isLength({max: 100}),
    body('delivery_status').optional({nullable: true}).isString().trim().isLength({max: 50})
];

const validateAddPOItem = [
    validatePOId,
    body('product_id').isInt({ gt: 0 }).withMessage('Valid product_id is required.').toInt(),
    body('product_variant_id').optional({nullable: true}).isInt({ gt: 0 }).withMessage('If provided, product_variant_id must be a valid positive integer.').toInt(),
    body('quantity_ordered').isInt({ gt: 0 }).withMessage('Item quantity_ordered must be a positive integer.').toInt(),
    body('unit_cost_price').isFloat({ gt: -1 }).withMessage('Item unit_cost_price must be a non-negative number.').toFloat(),
    body('currency_code').optional({nullable:true}).isString().isLength({min:3, max:3}).toUpperCase().withMessage('Item currency_code must be 3 letters if provided.')
];

const validateUpdatePOItem = [
    validatePOId,
    validatePOItemId,
    body('quantity_ordered').optional().isInt({ gt: 0 }).withMessage('Item quantity_ordered must be a positive integer.').toInt(),
    body('unit_cost_price').optional().isFloat({ gt: -1 }).withMessage('Item unit_cost_price must be a non-negative number.').toFloat(),
    body('currency_code').optional({nullable:true}).isString().isLength({min:3, max:3}).toUpperCase().withMessage('Item currency_code must be 3 letters if provided.'),
    body('product_variant_id').optional({nullable: true}).isInt({ gt: 0 }).withMessage('If provided, product_variant_id must be a valid positive integer.').toInt()
];


// POST /api/admin/purchase-orders - Create a new Purchase Order
router.post('/',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validatePOCreate,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const poData = { // Explicitly map to avoid passing unwanted fields from req.body
        supplier_id: req.body.supplier_id,
        order_date: req.body.order_date,
        expected_delivery_date: req.body.expected_delivery_date,
        notes: req.body.notes,
    };
    const itemsData = req.body.items;
    const adminUserId = req.user.userId;

    try {
      const newPurchaseOrder = await purchaseOrderService.createPurchaseOrder(poData, itemsData, adminUserId);
      // Audit logging for PO creation
      auditLogService.recordAuditEvent('PURCHASE_ORDER_CREATE', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER', resourceId: newPurchaseOrder.id }, { po_data: poData, items_count: itemsData.length }, req)
        .catch(err => console.error('Audit log failed for PURCHASE_ORDER_CREATE:', err));
      res.status(201).json(newPurchaseOrder);
    } catch (error) {
      next(error);
    }
});

// POST /api/admin/purchase-orders/:poId/items/:poItemId/receive - Receive stock for a PO item
router.post('/:poId/items/:poItemId/receive',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validateReceiveStock,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { poId, poItemId } = req.params; // Validated
    const receiveData = req.body; // Validated
    const adminUserId = req.user.userId;

    try {
      const result = await purchaseOrderService.receiveStockForPurchaseOrderItem(poItemId, receiveData, adminUserId);

      auditLogService.recordAuditEvent('PO_ITEM_RECEIVE_STOCK', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER_ITEM', resourceId: poItemId }, { purchase_order_id: poId, received_qty: receiveData.quantity_received_now, batch_id: result.new_batch_id }, req)
        .catch(err => console.error('Audit log failed for PO_ITEM_RECEIVE_STOCK:', err));

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
});

// GET /api/admin/purchase-orders - List all Purchase Orders
router.get('/',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validateListPOs,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const result = await purchaseOrderService.listPurchaseOrders(req.query);
       // Add hasNextPage and hasPrevPage for consistency if frontend expects it
      const responsePagination = {
        ...result.pagination,
        hasNextPage: result.pagination.page < result.pagination.totalPages,
        hasPrevPage: result.pagination.page > 1,
      };
      res.status(200).json({
          data: result.data,
          pagination: responsePagination
      });
    } catch (error) {
      next(error);
    }
});

// GET /api/admin/purchase-orders/:id - Get a specific Purchase Order
router.get('/:id',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validatePOId,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    try {
      const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(id);
      res.status(200).json(purchaseOrder);
    } catch (error) {
      next(error);
    }
});

// PUT /api/admin/purchase-orders/:id - Update PO Header
router.put('/:id',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validateUpdatePOHeader,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const headerData = req.body;
    const adminUserId = req.user.userId;

    // Ensure at least one field is being updated
    const updatableFields = ['status', 'expected_delivery_date', 'notes', 'supplier_id', 'order_date', 'shipping_carrier', 'tracking_number', 'delivery_status'];
    const hasUpdate = updatableFields.some(field => headerData.hasOwnProperty(field));
    if (!hasUpdate) {
        try { // If no fields to update, just return current PO data
            const currentPO = await purchaseOrderService.getPurchaseOrderById(id);
            return res.status(200).json(currentPO);
        } catch (error) { return next(error); }
    }

    try {
      const updatedPO = await purchaseOrderService.updatePurchaseOrderHeader(id, headerData, adminUserId);
      auditLogService.recordAuditEvent('PURCHASE_ORDER_UPDATE', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER', resourceId: id }, { updated_fields: Object.keys(headerData) }, req)
        .catch(err => console.error('Audit log failed for PURCHASE_ORDER_UPDATE:', err));
      res.status(200).json(updatedPO);
    } catch (error) {
      next(error);
    }
});

// POST /api/admin/purchase-orders/:id/items - Add item to PO
router.post('/:id/items',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validateAddPOItem,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const itemData = req.body;
    const adminUserId = req.user.userId;

    try {
      const newItem = await purchaseOrderService.addPurchaseOrderItem(id, itemData, adminUserId);
      auditLogService.recordAuditEvent('PO_ITEM_ADD', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER_ITEM', resourceId: newItem.id }, { purchase_order_id: id, item_data: itemData }, req)
        .catch(err => console.error('Audit log failed for PO_ITEM_ADD:', err));
      res.status(201).json(newItem);
    } catch (error) {
      next(error);
    }
});

// PUT /api/admin/purchase-orders/:id/items/:poItemId - Update PO item
router.put('/:id/items/:poItemId',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validateUpdatePOItem,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id, poItemId } = req.params;
    const itemData = req.body;
    const adminUserId = req.user.userId;

    try {
      const updatedItem = await purchaseOrderService.updatePurchaseOrderItem(poItemId, itemData, adminUserId);
      auditLogService.recordAuditEvent('PO_ITEM_UPDATE', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER_ITEM', resourceId: poItemId }, { purchase_order_id: id, updated_fields: Object.keys(itemData) }, req)
        .catch(err => console.error('Audit log failed for PO_ITEM_UPDATE:', err));
      res.status(200).json(updatedItem);
    } catch (error) {
      next(error);
    }
});

// DELETE /api/admin/purchase-orders/:id/items/:poItemId - Remove PO item
router.delete('/:id/items/:poItemId',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  validatePOId,
  validatePOItemId,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id, poItemId } = req.params;
    const adminUserId = req.user.userId;

    try {
      const deletedItem = await purchaseOrderService.removePurchaseOrderItem(poItemId, adminUserId);
      auditLogService.recordAuditEvent('PO_ITEM_DELETE', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER_ITEM', resourceId: poItemId }, { purchase_order_id: id, deleted_item: deletedItem }, req)
        .catch(err => console.error('Audit log failed for PO_ITEM_DELETE:', err));
      res.status(200).json({ message: 'Item removed successfully', deletedItem });
    } catch (error) {
      next(error);
    }
});

// GET /api/admin/purchase-orders/product/:productId/variants - Get variants for a product
router.get('/product/:productId/variants',
  isAuthenticated,
  checkPermission('purchase_orders:manage'),
  param('productId').isInt({ gt: 0 }).withMessage('Valid product_id is required.').toInt(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { productId } = req.params;

    try {
      const variants = await purchaseOrderService.getProductVariants(productId);
      res.status(200).json(variants);
    } catch (error) {
      next(error);
    }
});

// DELETE /api/admin/purchase-orders/:id - Delete a Purchase Order
router.delete('/:id',
  isAuthenticated,
  checkPermission('purchase_orders:delete'),
  validatePOId,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const adminUserId = req.user.userId;

    try {
      const result = await purchaseOrderService.deletePurchaseOrder(id, adminUserId);
      
      // Audit logging for PO deletion
      auditLogService.recordAuditEvent('PURCHASE_ORDER_DELETE', { userId: adminUserId, userEmail: req.user.email }, { resourceType: 'PURCHASE_ORDER', resourceId: id }, { deleted_po: result.deletedPO }, req)
        .catch(err => console.error('Audit log failed for PURCHASE_ORDER_DELETE:', err));
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
});

module.exports = router;
