const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');
const { param, body, validationResult } = require('express-validator');
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Assuming AppError exists

router.use(isAuthenticated, isAdmin);

router.post(
  '/orders/:orderId/restock-items',
  [
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt(),
    body('reason').notEmpty().isString().trim().withMessage('Reason is required.'),
    body('items').isArray({ min: 1 }).withMessage('At least one item must be provided for restock.'),
    body('items.*.order_item_id').isInt({ gt: 0 }).withMessage('Each item must have a valid order_item_id.').toInt(),
    body('items.*.product_id').isInt({ gt: 0 }).withMessage('Each item must have a valid product_id.').toInt(),
    body('items.*.variant_id').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Variant ID must be a positive integer if provided.').toInt(),
    body('items.*.quantity_to_restock').isInt({ gt: 0 }).withMessage('Quantity to restock must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params; // Now an integer due to .toInt()
    const { items, reason } = req.body; // items elements also have quantities as integers
    const userId = req.user.userId; // From isAuthenticated

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if order exists
      const orderCheck = await client.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (orderCheck.rows.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found.`);
      }

      const validatedItemsToRestock = [];
      for (const itemReq of items) { // items are from req.body, already coerced by express-validator
        const orderItemRes = await client.query(
          'SELECT product_id, product_variant_id, quantity as quantity_ordered FROM order_items WHERE id = $1 AND order_id = $2 FOR UPDATE',
          [itemReq.order_item_id, orderId]
        );

        if (orderItemRes.rows.length === 0) {
          throw new BadRequestError(`Order Item ID ${itemReq.order_item_id} not found on order ${orderId}.`);
        }
        const dbOrderItem = orderItemRes.rows[0];

        // Validate product_id and variant_id consistency (request vs DB order_item)
        if (dbOrderItem.product_id !== itemReq.product_id) {
          throw new BadRequestError(
            `Product ID mismatch for Order Item ID ${itemReq.order_item_id}. Request: ${itemReq.product_id}, Actual: ${dbOrderItem.product_id}.`
          );
        }
        // Careful with null vs undefined. variant_id from req can be null via optional({nullable:true})
        // dbOrderItem.product_variant_id will be null if not set.
        const reqVariantId = itemReq.variant_id === undefined ? null : itemReq.variant_id;
        if (dbOrderItem.product_variant_id !== reqVariantId) {
          throw new BadRequestError(
            `Variant ID mismatch for Order Item ID ${itemReq.order_item_id}. Request: ${reqVariantId}, Actual: ${dbOrderItem.product_variant_id}.`
          );
        }

        if (itemReq.quantity_to_restock > dbOrderItem.quantity_ordered) {
          throw new BadRequestError(
            `Cannot restock ${itemReq.quantity_to_restock} units for Order Item ID ${itemReq.order_item_id}. Quantity ordered was ${dbOrderItem.quantity_ordered}.`
          );
        }
        // TODO: Add check against already restocked quantity if such a field is added to order_items

        validatedItemsToRestock.push({
          order_item_id: itemReq.order_item_id,
          product_id: dbOrderItem.product_id, // Use actual product_id from DB order_item
          variant_id: dbOrderItem.product_variant_id, // Use actual variant_id from DB order_item
          quantity_to_restock: itemReq.quantity_to_restock,
        });
      }

      const restockResults = [];
      for (const item of validatedItemsToRestock) {
        let current_stock;
        let stock_target_id;
        let stock_target_table;
        let actual_product_id_for_log = item.product_id;

        if (item.variant_id) {
          stock_target_id = item.variant_id;
          stock_target_table = 'product_variants';
          const variantStockRes = await client.query(
            'SELECT stock_quantity, product_id FROM product_variants WHERE id = $1 FOR UPDATE',
            [stock_target_id]
          );
          if (variantStockRes.rows.length === 0) throw new NotFoundError(`Variant ID ${stock_target_id} not found for restocking.`);
          current_stock = variantStockRes.rows[0].stock_quantity;
          actual_product_id_for_log = variantStockRes.rows[0].product_id; // Ensure parent product_id is correct for logging
        } else {
          stock_target_id = item.product_id;
          stock_target_table = 'products';
          const productStockRes = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
            [stock_target_id]
          );
          if (productStockRes.rows.length === 0) throw new NotFoundError(`Product ID ${stock_target_id} not found for restocking.`);
          current_stock = productStockRes.rows[0].stock_quantity;
        }

        const new_quantity_on_hand = current_stock + item.quantity_to_restock;

        // Perform stock update
        await client.query(
          `UPDATE ${stock_target_table} SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [new_quantity_on_hand, stock_target_id]
        );

        // Log the movement
        const logMovementQuery = `
          INSERT INTO stock_movement_logs
            (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
        `;
        const logMovementValues = [
          actual_product_id_for_log,
          item.variant_id || null,
          userId,
          'customer_return_restock',
          item.quantity_to_restock, // Positive quantity for restock
          new_quantity_on_hand,
          reason,
          item.order_item_id.toString()
        ];
        const logResult = await client.query(logMovementQuery, logMovementValues);

        restockResults.push({
            order_item_id: item.order_item_id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity_restocked: item.quantity_to_restock,
            new_stock_on_hand: new_quantity_on_hand,
            log_id: logResult.rows[0].id
        });
      }

      // TODO: Potentially update order_item with quantity_restocked if that field is added.
      // TODO: Potentially update overall order status if all items are returned/restocked.

      await client.query('COMMIT');
      res.status(200).json({
        message: "Items restocked successfully.",
        orderId,
        reason,
        details: restockResults
      });

    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK'); }
        catch (rollError) { console.error('Error during ROLLBACK:', rollError); }
      }
      // Let specific errors (NotFoundError, BadRequestError) be handled by a global error handler if `next(error)` is used.
      // Otherwise, handle them here. For now, using next(error) for them.
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        return next(error);
      }
      // For other unexpected errors
      next(error);
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;
