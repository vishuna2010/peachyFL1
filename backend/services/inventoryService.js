const db = require('../db');
const { NotFoundError, BadRequestError, AppError } = require('../utils/AppError');
const auditLogService = require('./auditLogService'); // Assuming path

// Define valid movement types here for consistency if needed by the service,
// though primary validation might be in routes or shared constants.
const VALID_ADJUSTMENT_MOVEMENT_TYPES = [
    'write_off', 'damage', 'inventory_loss',
    'correction_decrease', 'correction_increase', // For general positive/negative corrections
    'found_stock', // Explicitly for adding found stock
];

const VALID_PHYSICAL_COUNT_MOVEMENT_TYPES = ['stock_take_increase', 'stock_take_decrease'];


/**
 * Performs a manual stock adjustment (e.g., write-off, damage, correction).
 * @param {object} adjustmentDetails - Details of the adjustment.
 * @param {string} adjustmentDetails.itemType - 'product' or 'variant'.
 * @param {number} adjustmentDetails.itemId - ID of the product or variant.
 * @param {number} adjustmentDetails.quantity - Positive integer amount to adjust by.
 * @param {string} adjustmentDetails.reason - Reason for the adjustment.
 * @param {string} adjustmentDetails.movementType - Type of movement (e.g., 'write_off', 'correction_increase').
 * @param {number} adjustmentDetails.adminUserId - ID of the admin performing the action.
 * @param {string} [adjustmentDetails.adminUserEmail] - Email of the admin for audit log.
 * @returns {Promise<object>} Details of the performed adjustment.
 */
async function performManualAdjustment(adjustmentDetails) {
  const {
    itemType,
    itemId,
    quantity,
    reason,
    movementType,
    adminUserId,
    adminUserEmail
  } = adjustmentDetails;

  if (!VALID_ADJUSTMENT_MOVEMENT_TYPES.includes(movementType)) {
    throw new BadRequestError(`Invalid movement type: ${movementType}. Valid types are: ${VALID_ADJUSTMENT_MOVEMENT_TYPES.join(', ')}`);
  }
  if (quantity <= 0) {
    throw new BadRequestError('Adjustment quantity must be a positive integer.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let currentStock;
    let productIdForLog;
    let variantIdForLog = null;
    let stockUpdateTable;
    let itemNameForResponse = '';

    if (itemType === 'product') {
      const productResult = await client.query('SELECT name, stock_quantity, has_variants FROM products WHERE id = $1 FOR UPDATE', [itemId]);
      if (productResult.rows.length === 0) throw new NotFoundError(`Product with ID ${itemId} not found.`);
      if (productResult.rows[0].has_variants && (movementType !== 'correction_increase' && movementType !== 'found_stock')) { // Allow increase for parent for now, but typically variant specific
         // More nuanced logic might be needed if parent stock is purely aggregate of variants
         // For now, if it has variants, most adjustments should be on variants.
         console.warn(`Adjusting stock for product ID ${itemId} which has variants. Consider adjusting variant stock directly.`);
      }
      currentStock = productResult.rows[0].stock_quantity;
      itemNameForResponse = productResult.rows[0].name;
      productIdForLog = itemId;
      stockUpdateTable = 'products';
    } else { // itemType === 'variant'
      const variantResult = await client.query(
        `SELECT pv.stock_quantity, pv.product_id, p.name as base_product_name, pv.sku as variant_sku
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE pv.id = $1 FOR UPDATE`, [itemId]);
      if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${itemId} not found.`);
      currentStock = variantResult.rows[0].stock_quantity;
      itemNameForResponse = `${variantResult.rows[0].base_product_name} (Variant SKU: ${variantResult.rows[0].variant_sku || itemId})`;
      productIdForLog = variantResult.rows[0].product_id;
      variantIdForLog = itemId;
      stockUpdateTable = 'product_variants';
    }

    let quantityChangedForLog;
    let newQuantityOnHand;

    if (['write_off', 'damage', 'inventory_loss', 'correction_decrease'].includes(movementType)) {
      if (currentStock < quantity) {
        throw new BadRequestError(`Cannot ${movementType} ${quantity} units. Only ${currentStock} available for ${itemType} '${itemNameForResponse}' (ID: ${itemId}).`);
      }
      newQuantityOnHand = currentStock - quantity;
      quantityChangedForLog = -quantity;
    } else if (['correction_increase', 'found_stock'].includes(movementType)) {
      newQuantityOnHand = currentStock + quantity;
      quantityChangedForLog = quantity;
    } else {
      // Should be caught by initial VALID_ADJUSTMENT_MOVEMENT_TYPES check
      throw new BadRequestError(`Unhandled movement type for quantity calculation: ${movementType}`);
    }

    await client.query(
      `UPDATE ${stockUpdateTable} SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newQuantityOnHand, itemId]
    );

    const logMovementResult = await client.query(
      `INSERT INTO stock_movement_logs
        (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [productIdForLog, variantIdForLog, adminUserId, movementType, quantityChangedForLog, newQuantityOnHand, reason]
    );
    const logId = logMovementResult.rows[0].id;

    await client.query('COMMIT');

    // Audit Log
    auditLogService.recordAuditEvent(
      'STOCK_MANUAL_ADJUSTMENT',
      { userId: adminUserId, userEmail: adminUserEmail || 'N/A' },
      { resourceType: itemType.toUpperCase(), resourceId: itemId },
      { movementType, quantity: quantityChangedForLog, newStock: newQuantityOnHand, reason, itemName: itemNameForResponse, stockMovementLogId: logId }
    ).catch(err => console.error(`[InventoryService] Audit log failed for STOCK_MANUAL_ADJUSTMENT (Item ID: ${itemId}):`, err));

    return {
      message: `${movementType} successful for ${itemType} '${itemNameForResponse}' (ID: ${itemId}).`,
      itemType,
      itemId,
      itemName: itemNameForResponse,
      quantityAdjusted: Math.abs(quantityChangedForLog),
      adjustmentDirection: quantityChangedForLog > 0 ? 'increase' : 'decrease',
      newStockOnHand: newQuantityOnHand,
      reason,
      movementType,
      logId
    };

  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("[InventoryService] Rollback error:", rbErr));
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) throw error;
    console.error(`[InventoryService.performManualAdjustment] Error for item ${itemType} ID ${itemId}:`, error);
    throw new AppError('Failed to perform manual stock adjustment.', 500, 'STOCK_ADJUSTMENT_FAILED', { originalError: error.message });
  } finally {
    if (client) client.release();
  }
}

/**
 * Records a physical stock count and makes necessary adjustments.
 * @param {object} countDetails - Details of the physical count.
 * @param {string} countDetails.itemType - 'product' or 'variant'.
 * @param {number} countDetails.itemId - ID of the product or variant.
 * @param {number} countDetails.countedQuantity - Non-negative integer.
 * @param {string} countDetails.reason - Reason for the count/adjustment.
 * @param {number} countDetails.adminUserId - ID of the admin performing the action.
 * @param {string} [countDetails.adminUserEmail] - Email of the admin for audit log.
 * @returns {Promise<object>} Details of the physical count adjustment.
 */
async function recordPhysicalCount(countDetails) {
  const {
    itemType,
    itemId,
    countedQuantity,
    reason,
    adminUserId,
    adminUserEmail
  } = countDetails;

  if (countedQuantity < 0) {
    throw new BadRequestError('Counted quantity must be a non-negative integer.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let currentStock;
    let productIdForLog;
    let variantIdForLog = null;
    let stockUpdateTable;
    let itemNameForResponse = '';

    if (itemType === 'product') {
      const productResult = await client.query('SELECT name, stock_quantity, has_variants FROM products WHERE id = $1 FOR UPDATE', [itemId]);
      if (productResult.rows.length === 0) throw new NotFoundError(`Product with ID ${itemId} not found.`);
      if (productResult.rows[0].has_variants) {
        throw new BadRequestError('Physical counts for products with variants must be performed at the variant level.');
      }
      currentStock = productResult.rows[0].stock_quantity;
      itemNameForResponse = productResult.rows[0].name;
      productIdForLog = itemId;
      stockUpdateTable = 'products';
    } else { // itemType === 'variant'
      const variantResult = await client.query(
        `SELECT pv.stock_quantity, pv.product_id, p.name as base_product_name, pv.sku as variant_sku
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE pv.id = $1 FOR UPDATE`, [itemId]);
      if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${itemId} not found.`);
      currentStock = variantResult.rows[0].stock_quantity;
      itemNameForResponse = `${variantResult.rows[0].base_product_name} (Variant SKU: ${variantResult.rows[0].variant_sku || itemId})`;
      productIdForLog = variantResult.rows[0].product_id;
      variantIdForLog = itemId;
      stockUpdateTable = 'product_variants';
    }

    const difference = countedQuantity - currentStock;

    if (difference === 0) {
      await client.query('COMMIT'); // No actual change, but commit to release lock.
      // Optionally, still log the "count event" itself in audit or a separate log if needed.
      // For now, just returning a message.
      return {
        message: `Counted quantity for ${itemType} '${itemNameForResponse}' (ID: ${itemId}) matches current stock (${currentStock}). No adjustment made.`,
        itemType,
        itemId,
        itemName: itemNameForResponse,
        currentStock,
        countedQuantity,
        difference
      };
    }

    const movementType = difference > 0 ? 'stock_take_increase' : 'stock_take_decrease';

    await client.query(
      `UPDATE ${stockUpdateTable} SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [countedQuantity, itemId]
    );

    const logMovementResult = await client.query(
      `INSERT INTO stock_movement_logs
        (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [productIdForLog, variantIdForLog, adminUserId, movementType, difference, countedQuantity, reason]
    );
    const logId = logMovementResult.rows[0].id;

    await client.query('COMMIT');

    // Audit Log
    auditLogService.recordAuditEvent(
      'STOCK_PHYSICAL_COUNT',
      { userId: adminUserId, userEmail: adminUserEmail || 'N/A' },
      { resourceType: itemType.toUpperCase(), resourceId: itemId },
      { oldStock: currentStock, newStock: countedQuantity, difference, reason, itemName: itemNameForResponse, stockMovementLogId: logId }
    ).catch(err => console.error(`[InventoryService] Audit log failed for STOCK_PHYSICAL_COUNT (Item ID: ${itemId}):`, err));

    return {
      message: `Stock count adjustment successful for ${itemType} '${itemNameForResponse}' (ID: ${itemId}).`,
      itemType,
      itemId,
      itemName: itemNameForResponse,
      oldStock: currentStock,
      countedQuantity,
      quantityChanged: difference,
      newStockOnHand: countedQuantity,
      reason,
      movementType,
      logId
    };

  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(rbErr => console.error("[InventoryService] Rollback error:", rbErr));
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) throw error;
    console.error(`[InventoryService.recordPhysicalCount] Error for item ${itemType} ID ${itemId}:`, error);
    throw new AppError('Failed to record physical stock count.', 500, 'PHYSICAL_COUNT_FAILED', { originalError: error.message });
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  performManualAdjustment,
  recordPhysicalCount,
  VALID_ADJUSTMENT_MOVEMENT_TYPES, // Exporting for potential use in route validation
  VALID_PHYSICAL_COUNT_MOVEMENT_TYPES
};
