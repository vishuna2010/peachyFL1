const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

// Apply auth middleware to all routes in this router
router.use(isAuthenticated, isAdmin);

const ALLOWED_PO_STATUSES = ['pending', 'ordered', 'partially_received', 'received', 'cancelled'];

// POST /api/admin/purchase-orders - Create a new Purchase Order
router.post('/', async (req, res) => {
  const { supplier_id, order_date, expected_delivery_date, notes, items } = req.body;
  const created_by_user_id = req.user.userId;

  // --- Validation ---
  if (!supplier_id || isNaN(parseInt(supplier_id))) {
    return res.status(400).json({ message: 'Valid supplier_id is required.' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Purchase order must contain at least one item.' });
  }
  for (const item of items) {
    if (!item.product_id || isNaN(parseInt(item.product_id))) {
      return res.status(400).json({ message: 'Each item must have a valid product_id.' });
    }
    if (!item.quantity_ordered || isNaN(parseInt(item.quantity_ordered)) || parseInt(item.quantity_ordered) <= 0) {
      return res.status(400).json({ message: `Quantity for product ID ${item.product_id} must be a positive integer.` });
    }
    if (item.unit_cost_price === undefined || isNaN(parseFloat(item.unit_cost_price)) || parseFloat(item.unit_cost_price) < 0) {
      return res.status(400).json({ message: `Unit cost price for product ID ${item.product_id} must be a non-negative number.` });
    }
  }
  if (order_date && isNaN(new Date(order_date).getTime())) {
    return res.status(400).json({ message: 'Invalid order_date format.' });
  }
  if (expected_delivery_date && isNaN(new Date(expected_delivery_date).getTime())) {
    return res.status(400).json({ message: 'Invalid expected_delivery_date format.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if supplier exists AND GET CURRENCY CODE
    const supplierResult = await client.query('SELECT id, currency_code FROM suppliers WHERE id = $1', [supplier_id]);
    if (supplierResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Supplier with ID ${supplier_id} not found.` });
    }
    const supplierCurrencyCode = supplierResult.rows[0].currency_code; // Can be null if supplier doesn't have one

    // Check if all products exist (can be done in loop or with IN clause)
    for (const item of items) {
        const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [item.product_id]);
        if (productCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Product with ID ${item.product_id} not found.` });
        }
    }

    const poQuery = `
      INSERT INTO purchase_orders
        (supplier_id, order_date, expected_delivery_date, notes, created_by_user_id, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const poValues = [
      parseInt(supplier_id),
      order_date ? new Date(order_date) : new Date(), // Default to today
      expected_delivery_date ? new Date(expected_delivery_date) : null,
      notes || null,
      created_by_user_id,
      'pending' // Default status
    ];
    const poResult = await client.query(poQuery, poValues);
    const newPurchaseOrder = poResult.rows[0];

    const itemInsertQuery = `
      INSERT INTO purchase_order_items
        (purchase_order_id, product_id, quantity_ordered, unit_cost_price, currency_code)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const createdItems = [];
    for (const item of items) {
      const itemResult = await client.query(itemInsertQuery, [
        newPurchaseOrder.id,
        parseInt(item.product_id),
        parseInt(item.quantity_ordered),
        parseFloat(item.unit_cost_price),
        supplierCurrencyCode // Add the fetched currency code here
      ]);
      createdItems.push(itemResult.rows[0]);
    }
    newPurchaseOrder.items = createdItems;

    await client.query('COMMIT');
    res.status(201).json(newPurchaseOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ message: 'Failed to create purchase order.' });
  } finally {
    client.release();
  }
});

// POST /api/admin/purchase-orders/:poId/items/:poItemId/receive - Receive stock for a PO item
router.post('/:poId/items/:poItemId/receive', async (req, res) => {
  const { poId, poItemId } = req.params;
  const { quantity_received_now } = req.body;

  // 1. Validate Inputs
  if (isNaN(parseInt(poId)) || isNaN(parseInt(poItemId))) {
    return res.status(400).json({ message: 'Invalid PO ID or PO Item ID format.' });
  }
  if (quantity_received_now === undefined || isNaN(parseInt(quantity_received_now)) || parseInt(quantity_received_now) <= 0) {
    return res.status(400).json({ message: 'quantity_received_now must be a positive integer.' });
  }
  const qtyReceivedNow = parseInt(quantity_received_now);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Fetch Purchase Order Item (and lock)
    const poItemResult = await client.query(
      'SELECT * FROM purchase_order_items WHERE id = $1 AND purchase_order_id = $2 FOR UPDATE',
      [poItemId, poId]
    );
    if (poItemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Purchase order item with ID ${poItemId} not found on PO #${poId}.` });
    }
    const poItem = poItemResult.rows[0];

    // 3. Fetch Product or Variant (and lock)
    // The poItem now has product_id and potentially product_variant_id
    if (poItem.product_variant_id) {
        const variantResult = await client.query(
            'SELECT id, stock_quantity FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE',
            [poItem.product_variant_id, poItem.product_id]
        );
        if (variantResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `Product Variant with ID ${poItem.product_variant_id} for Product ID ${poItem.product_id} not found.` });
        }
    } else {
        const productResult = await client.query(
            'SELECT id, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
            [poItem.product_id]
        );
        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `Base Product with ID ${poItem.product_id} not found.` });
        }
    }


    // 4. Fetch Purchase Order (to check status and lock)
    const poResult = await client.query(
      'SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE',
      [poId]
    );
    // PO existence is implicitly checked by poItemResult, but explicit check is fine
    if (poResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Purchase Order with ID ${poId} not found.`});
    }
    const currentPOStatus = poResult.rows[0].status;
    if (!['ordered', 'partially_received'].includes(currentPOStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Cannot receive stock for a PO with status "${currentPOStatus}". Must be 'ordered' or 'partially_received'.` });
    }

    // 5. Validate quantity_received_now
    const totalReceivable = poItem.quantity_ordered - poItem.quantity_received;
    if (qtyReceivedNow > totalReceivable) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Quantity received now (${qtyReceivedNow}) exceeds remaining receivable quantity (${totalReceivable}).` });
    }

    // Fetch current stock *before* update to calculate new_quantity_on_hand later
    let old_stock_quantity = 0;
    if (poItem.product_variant_id) {
        const variantStockResult = await client.query(
            'SELECT stock_quantity FROM product_variants WHERE id = $1 FOR UPDATE',
            [poItem.product_variant_id]
        );
        if (variantStockResult.rows.length > 0) { // Should always find if previous checks passed
            old_stock_quantity = variantStockResult.rows[0].stock_quantity;
        } else {
            // This case should ideally be prevented by earlier checks ensuring variant exists
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `Product Variant with ID ${poItem.product_variant_id} not found unexpectedly during stock fetch.` });
        }
    } else {
        const productStockResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
            [poItem.product_id]
        );
        if (productStockResult.rows.length > 0) { // Should always find
            old_stock_quantity = productStockResult.rows[0].stock_quantity;
        } else {
            // This case should ideally be prevented by earlier checks ensuring product exists
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `Product with ID ${poItem.product_id} not found unexpectedly during stock fetch.` });
        }
    }
    const new_stock_quantity_on_hand = old_stock_quantity + qtyReceivedNow;

    // 6. Update purchase_order_items
    const updatedPoItemResult = await client.query(
      'UPDATE purchase_order_items SET quantity_received = quantity_received + $1 WHERE id = $2 RETURNING *',
      [qtyReceivedNow, poItemId]
    );

    // 7. Update products or product_variants stock
    if (poItem.product_variant_id) {
        await client.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [qtyReceivedNow, poItem.product_variant_id]
        );
    } else {
        await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [qtyReceivedNow, poItem.product_id]
        );
    }

    // Log the stock movement
    const logMovementQuery = `
        INSERT INTO stock_movement_logs
            (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const logMovementValues = [
        poItem.product_id,
        poItem.product_variant_id || null,
        req.user.userId, // Assumes isAuthenticated middleware populates req.user
        'po_receipt',
        qtyReceivedNow,
        new_stock_quantity_on_hand,
        `Received against PO #${poId}, Item #${poItemId}`,
        poItemId.toString()
    ];
    await client.query(logMovementQuery, logMovementValues);

    // 8. Update purchase_orders.status and updated_at
    const allItemsForPOResult = await client.query(
      'SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1',
      [poId]
    );

    let totalOrderedOnPO = 0;
    let totalReceivedOnPO = 0;
    allItemsForPOResult.rows.forEach(item => {
      totalOrderedOnPO += item.quantity_ordered;
      totalReceivedOnPO += item.quantity_received;
    });

    let newPOStatus = currentPOStatus; // Default to current
    if (totalReceivedOnPO >= totalOrderedOnPO) {
      newPOStatus = 'received';
    } else if (totalReceivedOnPO > 0) {
      newPOStatus = 'partially_received';
    }
    // If newPOStatus changed or if it's 'partially_received' (could be multiple partial receipts)
    if (newPOStatus !== currentPOStatus || newPOStatus === 'partially_received') {
        await client.query(
            'UPDATE purchase_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPOStatus, poId]
        );
    } else { // Still update updated_at even if status name doesn't change (e.g. another partial receipt)
        await client.query(
            'UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [poId]
        );
    }


    // 9. Commit Transaction
    await client.query('COMMIT');

    // 10. Response: Fetch the updated PO to return full details
    const finalPoQuery = `
      SELECT po.*, s.name as supplier_name, u.email as created_by_user_email
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by_user_id = u.id
      WHERE po.id = $1;
    `;
    const finalPoResult = await db.query(finalPoQuery, [poId]); // Use db.query for fresh client after commit
    const updatedPurchaseOrder = finalPoResult.rows[0];

    const finalItemsQuery = `
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.id ASC;
    `;
    const finalItemsResult = await db.query(finalItemsQuery, [poId]);
    updatedPurchaseOrder.items = finalItemsResult.rows;

    res.status(200).json({
        message: `Successfully received ${qtyReceivedNow} unit(s) for item ${poItemId} on PO #${poId}.`,
        purchaseOrder: updatedPurchaseOrder,
        updatedItem: updatedPoItemResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error receiving stock for PO Item ID ${poItemId} on PO ID ${poId}:`, error);
    res.status(500).json({ message: 'Failed to receive stock.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/purchase-orders - List all Purchase Orders
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM purchase_orders');
    const totalPOs = parseInt(countResult.rows[0].count);

    const poQuery = `
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.order_date DESC, po.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await db.query(poQuery, [limit, offset]);

    res.status(200).json({
        data: result.rows,
        pagination: {
            total: totalPOs,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalPOs / limit)
        }
    });
  } catch (error) {
    console.error('Error listing purchase orders:', error);
    res.status(500).json({ message: 'Failed to retrieve purchase orders.' });
  }
});

// GET /api/admin/purchase-orders/:id - Get a specific Purchase Order
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid Purchase Order ID format.' });
  }
  try {
    const poQuery = `
      SELECT po.*, s.name as supplier_name, u.email as created_by_user_email
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by_user_id = u.id
      WHERE po.id = $1;
    `;
    const poResult = await db.query(poQuery, [id]);
    if (poResult.rows.length === 0) {
      return res.status(404).json({ message: `Purchase Order with ID ${id} not found.` });
    }
    const purchaseOrder = poResult.rows[0];

    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [id]);
    purchaseOrder.items = itemsResult.rows;

    res.status(200).json(purchaseOrder);
  } catch (error) {
    console.error(`Error fetching purchase order ${id}:`, error);
    res.status(500).json({ message: 'Failed to retrieve purchase order.' });
  }
});

// PUT /api/admin/purchase-orders/:id - Update PO Header
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'Invalid Purchase Order ID format.' });
  }

  const { status, expected_delivery_date, notes, supplier_id, order_date } = req.body;
  // Item updates are not handled in this endpoint.

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const currentPO = await client.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
    if (currentPO.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Purchase Order with ID ${id} not found.` });
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) {
      if (!ALLOWED_PO_STATUSES.includes(status.toLowerCase())) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED_PO_STATUSES.join(', ')}` });
      }
      setClauses.push(`status = $${paramIndex++}`); values.push(status.toLowerCase());
    }
    if (expected_delivery_date !== undefined) {
      if (expected_delivery_date !== null && isNaN(new Date(expected_delivery_date).getTime())) {
        await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid expected_delivery_date format.' });
      }
      setClauses.push(`expected_delivery_date = $${paramIndex++}`); values.push(expected_delivery_date);
    }
    if (notes !== undefined) { setClauses.push(`notes = $${paramIndex++}`); values.push(notes); }
    if (supplier_id !== undefined) {
        if(isNaN(parseInt(supplier_id))) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid supplier_id.'}); }
        const supplierCheck = await client.query('SELECT id FROM suppliers WHERE id = $1', [supplier_id]);
        if (supplierCheck.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: `Supplier with ID ${supplier_id} not found.` });}
        setClauses.push(`supplier_id = $${paramIndex++}`); values.push(parseInt(supplier_id));
    }
    if (order_date !== undefined) {
        if (isNaN(new Date(order_date).getTime())) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid order_date format.' });}
        setClauses.push(`order_date = $${paramIndex++}`); values.push(new Date(order_date));
    }


    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    const updateQuery = `UPDATE purchase_orders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    values.push(id);

    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');

    // Re-fetch with joins for consistent response structure
    const finalPoQuery = `
      SELECT po.*, s.name as supplier_name, u.email as created_by_user_email
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by_user_id = u.id
      WHERE po.id = $1;
    `;
    const finalResult = await db.query(finalPoQuery, [id]); // Use db.query for fresh client

    res.status(200).json(finalResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error updating purchase order ${id}:`, error);
    res.status(500).json({ message: 'Failed to update purchase order.' });
  } finally {
    client.release();
  }
});


module.exports = router;
