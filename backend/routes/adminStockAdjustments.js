const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { body, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Assuming AppError exists

router.use(isAuthenticated, isAdmin);

const VALID_MOVEMENT_TYPES = ['write_off', 'damage', 'inventory_loss', 'correction_decrease', 'stock_take_increase', 'stock_take_decrease'];

router.post(
  '/write-off', // Or a more generic path like '/adjust' and use movement_type to differentiate
  [
    body('item_type').isIn(['product', 'variant']).withMessage("Item type must be 'product' or 'variant'."),
    body('item_id').isInt({ gt: 0 }).withMessage('Item ID must be a positive integer.').toInt(),
    body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer.').toInt(),
    body('reason').notEmpty().isString().trim().withMessage('Reason is required.'),
    body('movement_type').optional().trim().isIn(VALID_MOVEMENT_TYPES).withMessage(`Movement type must be one of: ${VALID_MOVEMENT_TYPES.join(', ')}`)
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // quantity is already an int due to .toInt() in validator
    const { item_type, item_id, quantity, reason } = req.body;
    const movement_type = req.body.movement_type || 'write_off'; // Default
    const userId = req.user.userId;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      let current_stock;
      let product_id_for_log;
      let variant_id_for_log = null;
      let update_query_table;
      let target_table_name;


      if (item_type === 'product') {
        target_table_name = 'products';
        const productResult = await client.query('SELECT stock_quantity, has_variants FROM products WHERE id = $1 FOR UPDATE', [item_id]);
        if (productResult.rows.length === 0) throw new NotFoundError(`Product with ID ${item_id} not found.`);
        // Optional: Disallow direct stock changes on base product if it has variants
        // if (productResult.rows[0].has_variants) {
        //   throw new BadRequestError('This product has variants. Stock adjustments should be made at the variant level for accuracy.');
        // }
        current_stock = productResult.rows[0].stock_quantity;
        product_id_for_log = item_id;
        update_query_table = 'products';
      } else { // item_type === 'variant'
        target_table_name = 'product_variants';
        const variantResult = await client.query('SELECT product_id, stock_quantity FROM product_variants WHERE id = $1 FOR UPDATE', [item_id]);
        if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${item_id} not found.`);
        current_stock = variantResult.rows[0].stock_quantity;
        product_id_for_log = variantResult.rows[0].product_id;
        variant_id_for_log = item_id;
        update_query_table = 'product_variants';
      }

      if (current_stock < quantity) {
        throw new BadRequestError(`Cannot ${movement_type} ${quantity} units. Only ${current_stock} available for ${item_type} ID ${item_id}.`);
      }

      const new_quantity_on_hand = current_stock - quantity;

      // Perform stock update
      const stockUpdateQuery = `UPDATE ${update_query_table} SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`;
      await client.query(stockUpdateQuery, [new_quantity_on_hand, item_id]);

      // Log the movement
      const logMovementQuery = `
        INSERT INTO stock_movement_logs
          (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
      `;
      const logMovementValues = [
        product_id_for_log,
        variant_id_for_log,
        userId,
        movement_type,
        -quantity, // Negative as it's a deduction
        new_quantity_on_hand,
        reason,
        null // No specific reference for write-off unless a batch ID or adjustment document ID is introduced later
      ];
      const logResult = await client.query(logMovementQuery, logMovementValues);

      await client.query('COMMIT');
      res.status(200).json({
        message: `${movement_type} successful for ${item_type} ID ${item_id}.`,
        item_type,
        item_id,
        quantity_adjusted: quantity,
        new_stock_on_hand,
        reason,
        movement_type,
        log_id: logResult.rows[0].id
      });

    } catch (error) {
      // Ensure rollback is attempted only if client is still valid
      if (client && !client._hadError && client._queryable) {
          try { await client.query('ROLLBACK'); } catch (rbError) { console.error("Rollback error:", rbError); }
      }
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
          return next(error); // Let global error handler manage these
      }
      next(error); // For other unexpected errors
    } finally {
      if(client) client.release();
    }
  }
);

router.post(
  '/physical-count',
  [
    body('item_type').isIn(['product', 'variant']).withMessage("Item type must be 'product' or 'variant'."),
    body('item_id').isInt({ gt: 0 }).toInt().withMessage('Item ID must be a positive integer.'),
    body('counted_quantity').isInt({ min: 0 }).toInt().withMessage('Counted quantity must be a non-negative integer.'),
    body('reason').notEmpty().isString().trim().withMessage('Reason for count/adjustment is required.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { item_type, item_id, counted_quantity, reason } = req.body;
    const userId = req.user.userId;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      let current_stock;
      let product_id_for_log;
      let variant_id_for_log = null;
      let stock_target_table;
      let item_name_for_response = ''; // For clearer response message

      if (item_type === 'product') {
        const productResult = await client.query('SELECT name, stock_quantity, has_variants FROM products WHERE id = $1 FOR UPDATE', [item_id]);
        if (productResult.rows.length === 0) throw new NotFoundError(`Product with ID ${item_id} not found.`);
        // Optional: Disallow if product has variants and user should adjust variants instead.
        // if (productResult.rows[0].has_variants) {
        //   throw new BadRequestError('This product has variants. Physical counts should adjust variant stock levels.');
        // }
        current_stock = productResult.rows[0].stock_quantity;
        item_name_for_response = productResult.rows[0].name;
        product_id_for_log = item_id;
        stock_target_table = 'products';
      } else { // item_type === 'variant'
        const variantResult = await client.query(
            `SELECT pv.stock_quantity, pv.product_id, p.name as base_product_name
             FROM product_variants pv
             JOIN products p ON pv.product_id = p.id
             WHERE pv.id = $1 FOR UPDATE`, [item_id]);
        if (variantResult.rows.length === 0) throw new NotFoundError(`Variant with ID ${item_id} not found.`);
        current_stock = variantResult.rows[0].stock_quantity;
        item_name_for_response = `${variantResult.rows[0].base_product_name} (Variant ID: ${item_id})`;
        product_id_for_log = variantResult.rows[0].product_id;
        variant_id_for_log = item_id;
        stock_target_table = 'product_variants';
      }

      const difference = counted_quantity - current_stock;

      if (difference === 0) {
        await client.query('COMMIT'); // Or ROLLBACK, as no changes made. Commit is fine.
        return res.status(200).json({
          message: `Counted quantity for ${item_type} '${item_name_for_response}' (ID: ${item_id}) matches current stock (${current_stock}). No adjustment made.`,
          item_type,
          item_id,
          item_name: item_name_for_response,
          current_stock,
          counted_quantity,
          difference
        });
      }

      const movement_type = difference > 0 ? 'stock_take_increase' : 'stock_take_decrease';

      // Perform stock update to the new counted_quantity
      await client.query(
        `UPDATE ${stock_target_table} SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [counted_quantity, item_id]
      );

      // Log the movement
      const logMovementQuery = `
        INSERT INTO stock_movement_logs
          (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
      `;
      const logMovementValues = [
        product_id_for_log,
        variant_id_for_log,
        userId,
        movement_type,
        difference, // This is the actual change (can be positive or negative)
        counted_quantity, // The new stock on hand is the counted quantity
        reason,
        null // No specific reference for physical count unless a batch ID is used
      ];
      const logResult = await client.query(logMovementQuery, logMovementValues);

      await client.query('COMMIT');
      res.status(200).json({
        message: `Stock count adjustment successful for ${item_type} '${item_name_for_response}' (ID: ${item_id}).`,
        item_type,
        item_id,
        item_name: item_name_for_response,
        old_stock: current_stock,
        counted_quantity,
        quantity_changed: difference,
        new_stock_on_hand: counted_quantity,
        reason,
        movement_type,
        log_id: logResult.rows[0].id
      });

    } catch (error) {
      if (client && !client._hadError && client._queryable) {
          try { await client.query('ROLLBACK'); } catch (rbError) { console.error("Rollback error on physical count:", rbError); }
      }
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        return next(error);
      }
      next(error);
    } finally {
      if(client) client.release();
    }
  }
);

module.exports = router;
