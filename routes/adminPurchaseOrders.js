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

    // Check if supplier exists
    const supplierCheck = await client.query('SELECT id FROM suppliers WHERE id = $1', [supplier_id]);
    if (supplierCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Supplier with ID ${supplier_id} not found.` });
    }

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
        (purchase_order_id, product_id, quantity_ordered, unit_cost_price)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const createdItems = [];
    for (const item of items) {
      const itemResult = await client.query(itemInsertQuery, [
        newPurchaseOrder.id,
        parseInt(item.product_id),
        parseInt(item.quantity_ordered),
        parseFloat(item.unit_cost_price)
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
