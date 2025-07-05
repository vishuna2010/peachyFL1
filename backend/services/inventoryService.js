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
  VALID_PHYSICAL_COUNT_MOVEMENT_TYPES,
  updateInventoryBatch, // Added new function
};

/**
 * Updates an existing inventory batch and handles related stock adjustments.
 * @param {number} batchId - The ID of the inventory batch to update.
 * @param {object} updateData - An object containing the data to update.
 * @param {number} [updateData.quantity_remaining] - The new quantity remaining.
 * @param {string} [updateData.expiry_date] - The new expiry date (YYYY-MM-DD or null).
 * @param {string} [updateData.batch_number] - The new batch number.
 * @param {string} updateData.reason_for_change - The reason for the update.
 * @param {number} adminUserId - The ID of the admin user performing the update.
 * @returns {Promise<object>} The updated inventory batch object, possibly enriched with product/variant names.
 * @throws {NotFoundError} If the batch is not found.
 * @throws {BadRequestError} If the update data is invalid (e.g., quantity > initial, empty batch number).
 * @throws {ConflictError} If the new batch number conflicts with an existing one for the same product/variant.
 * @throws {AppError} For other internal errors.
 */
async function updateInventoryBatch(batchId, updateData, adminUserId) {
  const { quantity_remaining, expiry_date, batch_number, reason_for_change } = updateData;

  // reason_for_change is validated at route level for existence.
  // Here, we ensure it's not accidentally empty if passed.
  if (!reason_for_change || reason_for_change.trim() === '') {
    throw new BadRequestError('Reason for change is required and cannot be empty.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const batchResult = await client.query('SELECT * FROM inventory_batches WHERE id = $1 FOR UPDATE', [batchId]);
    if (batchResult.rows.length === 0) {
      throw new NotFoundError(`Inventory batch with ID ${batchId} not found.`);
    }
    const currentBatch = batchResult.rows[0];
    const old_quantity_remaining_for_this_batch = currentBatch.quantity_remaining;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    let new_quantity_remaining_value_for_this_batch = quantity_remaining; // For logging logic later

    if (quantity_remaining !== undefined) {
      const num_quantity_remaining = parseInt(quantity_remaining, 10);
      if (isNaN(num_quantity_remaining) || num_quantity_remaining < 0) {
        throw new BadRequestError('Quantity remaining must be a non-negative integer.');
      }
      if (num_quantity_remaining > currentBatch.quantity_received) {
        throw new BadRequestError(`New quantity remaining (${num_quantity_remaining}) cannot exceed received quantity (${currentBatch.quantity_received}).`);
      }
      if (num_quantity_remaining !== old_quantity_remaining_for_this_batch) { // Only add to setClauses if it's different
        setClauses.push(`quantity_remaining = $${paramIndex++}`);
        values.push(num_quantity_remaining);
      }
      new_quantity_remaining_value_for_this_batch = num_quantity_remaining; // Use the validated numeric value
    } else {
      new_quantity_remaining_value_for_this_batch = old_quantity_remaining_for_this_batch; // No change intended for quantity
    }

    if (expiry_date !== undefined) {
      // Route level validation ensures it's a date string or null.
      const finalExpiryDate = (expiry_date === '' || expiry_date === null) ? null : expiry_date;
      if (finalExpiryDate !== currentBatch.expiry_date) {
         setClauses.push(`expiry_date = $${paramIndex++}`);
         values.push(finalExpiryDate);
      }
    }

    if (batch_number !== undefined) {
      const trimmedBatchNumber = batch_number.trim();
      if (trimmedBatchNumber === '') {
        throw new BadRequestError('Batch number cannot be an empty string if provided.');
      }
      if (trimmedBatchNumber !== currentBatch.batch_number) {
        const conflictCheckQuery = `
          SELECT id FROM inventory_batches
          WHERE product_id = $1
            AND CASE WHEN $2::INT IS NULL THEN variant_id IS NULL ELSE variant_id = $2::INT END
            AND batch_number = $3
            AND id != $4`;
        const conflictCheck = await client.query(conflictCheckQuery,
          [currentBatch.product_id, currentBatch.variant_id, trimmedBatchNumber, batchId]
        );
        if (conflictCheck.rows.length > 0) {
          throw new ConflictError(`Batch number "${trimmedBatchNumber}" already exists for this product/variant.`);
        }
        setClauses.push(`batch_number = $${paramIndex++}`);
        values.push(trimmedBatchNumber);
      }
    }

    let updatedBatchEntity = currentBatch;

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(batchId); // The ID for the WHERE clause
      const updateQuery = `UPDATE inventory_batches SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
      const updateResult = await client.query(updateQuery, values);
      updatedBatchEntity = updateResult.rows[0];
    } else {
      // No actual data fields were changed that are different from current values.
      await client.query('ROLLBACK'); // Release lock
      throw new BadRequestError('No updatable data fields provided or values are the same as current. Update not performed.');
    }

    // After batch update, recalculate and update aggregate stock on product/variant
    // This uses the product_id and variant_id from the potentially updated batch (updatedBatchEntity)
    const sumBatchStockQuery = await client.query(
      `SELECT COALESCE(SUM(quantity_remaining), 0) AS total_stock
       FROM inventory_batches
       WHERE product_id = $1 AND ${updatedBatchEntity.variant_id ? `variant_id = $2` : 'variant_id IS NULL'}`,
      updatedBatchEntity.variant_id ? [updatedBatchEntity.product_id, updatedBatchEntity.variant_id] : [updatedBatchEntity.product_id]
    );
    const newTotalAggregateStockForProductOrVariant = parseInt(sumBatchStockQuery.rows[0].total_stock, 10);

    if (updatedBatchEntity.variant_id) {
      await client.query(
        'UPDATE product_variants SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newTotalAggregateStockForProductOrVariant, updatedBatchEntity.variant_id]
      );
    } else {
      await client.query(
        'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newTotalAggregateStockForProductOrVariant, updatedBatchEntity.product_id]
      );
    }

    // Log quantity change if it actually happened for this specific batch
    // Compare the final quantity in the updated batch with its original quantity
    if (updatedBatchEntity.quantity_remaining !== old_quantity_remaining_for_this_batch) {
      const quantity_difference_for_this_batch = updatedBatchEntity.quantity_remaining - old_quantity_remaining_for_this_batch;
      // quantity_difference_for_this_batch will be non-zero because setClauses.length > 0 check passed
      // and quantity_remaining was part of setClauses only if it was different.

      const logMovementQuery = `
        INSERT INTO stock_movement_logs
          (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `;
      await client.query(logMovementQuery, [
        updatedBatchEntity.product_id,
        updatedBatchEntity.variant_id,
        adminUserId,
        'batch_adjustment', // Movement type for direct batch update
        quantity_difference_for_this_batch, // Change in this specific batch
        newTotalAggregateStockForProductOrVariant, // New total aggregate stock for the product/variant
        reason_for_change,
        `batch_id:${batchId}`
      ]);
    }

    await client.query('COMMIT');

    // Fetch the batch again to include product/variant names for the response, similar to GET route
    const finalBatchDataResult = await db.query( // Use db.query for a fresh client connection after commit
       `SELECT ib.*, p.name as product_name, p.sku as product_sku, pv.sku as variant_sku
        FROM inventory_batches ib
        LEFT JOIN products p ON ib.product_id = p.id
        LEFT JOIN product_variants pv ON ib.variant_id = pv.id
        WHERE ib.id = $1`, [updatedBatchEntity.id]
    );

    if (finalBatchDataResult.rows.length === 0) {
        // Should not happen if commit was successful and batchId is correct
        throw new AppError('Failed to re-fetch updated batch details.', 500, 'BATCH_REFETCH_FAILED');
    }

    return finalBatchDataResult.rows[0];

  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError || error instanceof AppError) {
      throw error;
    }
    console.error(`[InventoryService.updateInventoryBatch] Error for batch ID ${batchId}:`, error);
    throw new AppError('Failed to update inventory batch.', 500, 'BATCH_UPDATE_FAILED', { originalError: error.message });
  } finally {
    if(client) client.release();
  }
}
