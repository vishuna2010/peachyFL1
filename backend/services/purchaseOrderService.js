// backend/services/purchaseOrderService.js
const db = require('../db');
const { NotFoundError, BadRequestError, AppError } = require('../utils/AppError');

/**
 * Creates a new Purchase Order along with its items.
 * @param {object} poData - Data for the PO header.
 * @param {number} poData.supplier_id
 * @param {string} [poData.order_date] - Defaults to NOW() if not provided.
 * @param {string} [poData.expected_delivery_date]
 * @param {string} [poData.notes]
 * @param {Array<object>} itemsData - Array of item objects.
 * @param {number} itemsData[].product_id
 * @param {number} itemsData[].quantity_ordered
 * @param {number} itemsData[].unit_cost_price
 * @param {number} adminUserId - ID of the user creating the PO.
 * @returns {Promise<object>} The newly created purchase order object with items.
 * @throws {NotFoundError} If supplier or any product not found.
 * @throws {BadRequestError} If itemsData is empty or item validation fails.
 * @throws {AppError} For other database errors.
 */
async function createPurchaseOrder(poData, itemsData, adminUserId) {
  const {
    supplier_id,
    order_date,
    expected_delivery_date,
    notes
  } = poData;

  // Basic validation (route level should be more thorough with express-validator)
  if (!supplier_id) throw new BadRequestError('Supplier ID is required.');
  if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
    throw new BadRequestError('Purchase order must contain at least one item.');
  }
  for (const item of itemsData) {
    if (!item.product_id || item.quantity_ordered === undefined || item.unit_cost_price === undefined) {
      throw new BadRequestError('Each item must have product_id, quantity_ordered, and unit_cost_price.');
    }
    if (parseInt(item.quantity_ordered, 10) <= 0) {
      throw new BadRequestError(`Quantity for product ID ${item.product_id} must be positive.`);
    }
    if (parseFloat(item.unit_cost_price) < 0) {
      throw new BadRequestError(`Unit cost for product ID ${item.product_id} must be non-negative.`);
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const supplierResult = await client.query('SELECT id, currency_code FROM suppliers WHERE id = $1', [supplier_id]);
    if (supplierResult.rows.length === 0) {
      throw new NotFoundError(`Supplier with ID ${supplier_id} not found.`);
    }
    const supplierCurrencyCode = supplierResult.rows[0].currency_code;

    for (const item of itemsData) {
      const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [item.product_id]);
      if (productCheck.rows.length === 0) {
        throw new NotFoundError(`Product with ID ${item.product_id} not found.`);
      }
      
      // If product_variant_id is provided, validate it belongs to the product
      if (item.product_variant_id) {
        const variantCheck = await client.query(
          'SELECT id FROM product_variants WHERE id = $1 AND product_id = $2', 
          [item.product_variant_id, item.product_id]
        );
        if (variantCheck.rows.length === 0) {
          throw new NotFoundError(`Variant with ID ${item.product_variant_id} not found for product ${item.product_id}.`);
        }
      }
    }

    const poQuery = `
      INSERT INTO purchase_orders
        (supplier_id, order_date, expected_delivery_date, notes, created_by_user_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const poValues = [
      supplier_id,
      order_date ? new Date(order_date) : new Date(),
      expected_delivery_date ? new Date(expected_delivery_date) : null,
      notes || null,
      adminUserId
    ];
    const poResult = await client.query(poQuery, poValues);
    const newPurchaseOrder = poResult.rows[0];

    const itemInsertQuery = `
      INSERT INTO purchase_order_items
        (purchase_order_id, product_id, product_variant_id, quantity_ordered, unit_cost_price, currency_code)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const createdItems = [];
    for (const item of itemsData) {
      const itemResult = await client.query(itemInsertQuery, [
        newPurchaseOrder.id,
        item.product_id,
        item.product_variant_id || null,
        parseInt(item.quantity_ordered, 10),
        parseFloat(item.unit_cost_price),
        supplierCurrencyCode
      ]);
      createdItems.push(itemResult.rows[0]);
    }
    newPurchaseOrder.items = createdItems;

    await client.query('COMMIT');
    return newPurchaseOrder;

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error('Error in purchaseOrderService.createPurchaseOrder:', error);
    throw new AppError('Failed to create purchase order.', 500, 'PO_CREATION_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Lists all purchase orders with pagination.
 * @param {object} options - Pagination options.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * // TODO: Add filtering options (e.g., supplier_id, status)
 * @returns {Promise<object>} { data: purchaseOrders, pagination: {...} }
 */
async function listPurchaseOrders(options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  // TODO: Add WHERE clauses for filters when implemented
  const whereClauses = [];
  const queryParams = [];
  // let paramIndex = 1;

  // Example filter (to be expanded)
  // if (options.supplier_id) {
  //   whereClauses.push(`po.supplier_id = $${paramIndex++}`);
  //   queryParams.push(options.supplier_id);
  // }
  // if (options.status) {
  //   whereClauses.push(`po.status = $${paramIndex++}`);
  //   queryParams.push(options.status);
  // }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";

  try {
    const countQuery = `SELECT COUNT(*) FROM purchase_orders po ${whereString}`;
    const totalResult = await db.query(countQuery, queryParams);
    const totalPOs = parseInt(totalResult.rows[0].count, 10);

    const poQuery = `
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ${whereString}
      ORDER BY po.order_date DESC, po.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
    `;
    const dataResult = await db.query(poQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      pagination: {
        total: totalPOs,
        page,
        limit,
        totalPages: Math.ceil(totalPOs / limit),
      }
    };
  } catch (error) {
    console.error('Error in purchaseOrderService.listPurchaseOrders:', error);
    throw new AppError('Failed to retrieve purchase orders.', 500, 'PO_LIST_FAILED');
  }
}

/**
 * Retrieves a specific purchase order by its ID, including its items and related details.
 * @param {number} purchaseOrderId - The ID of the purchase order.
 * @returns {Promise<object>} The purchase order object.
 * @throws {NotFoundError} If the purchase order is not found.
 */
async function getPurchaseOrderById(purchaseOrderId) {
  try {
    const poQuery = `
      SELECT po.*, s.name as supplier_name, s.currency_code as supplier_currency_code,
             u.email as created_by_user_email
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by_user_id = u.id
      WHERE po.id = $1;
    `;
    const poResult = await db.query(poQuery, [purchaseOrderId]);
    if (poResult.rows.length === 0) {
      throw new NotFoundError(`Purchase Order with ID ${purchaseOrderId} not found.`);
    }
    const purchaseOrder = poResult.rows[0];

    const itemsQuery = `
      SELECT poi.*, p.name as product_name, p.sku as product_sku,
             pv.sku as variant_sku, pv.price_modifier as variant_price_modifier
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      LEFT JOIN product_variants pv ON poi.product_variant_id = pv.id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.id ASC;
    `;
    const itemsResult = await db.query(itemsQuery, [purchaseOrderId]);
    purchaseOrder.items = itemsResult.rows.map(item => ({
        ...item,
        display_sku: item.variant_sku || item.product_sku || 'N/A'
    }));

    return purchaseOrder;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error in purchaseOrderService.getPurchaseOrderById for ID ${purchaseOrderId}:`, error);
    throw new AppError('Failed to retrieve purchase order details.', 500, 'PO_GET_BY_ID_FAILED');
  }
}


const ALLOWED_PO_STATUSES = ['pending', 'ordered', 'partially_received', 'received', 'cancelled']; // Define if not already global

/**
 * Updates the header of a Purchase Order (e.g., status, dates, notes, supplier).
 * @param {number} purchaseOrderId - The ID of the PO to update.
 * @param {object} headerData - Data to update. Allowed fields: status, expected_delivery_date, notes, supplier_id, order_date, shipping_carrier, tracking_number, delivery_status.
 * @param {number} adminUserId - ID of the admin performing the update.
 * @returns {Promise<object>} The updated purchase order object (header only, or full with items if re-fetched).
 * @throws {NotFoundError} If PO or new supplier_id not found.
 * @throws {BadRequestError} If input data is invalid (e.g., status, date format).
 */
async function updatePurchaseOrderHeader(purchaseOrderId, headerData, adminUserId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentPOResult = await client.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [purchaseOrderId]);
    if (currentPOResult.rows.length === 0) {
      throw new NotFoundError(`Purchase Order with ID ${purchaseOrderId} not found.`);
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const fieldsToUpdate = [
        'status', 'expected_delivery_date', 'notes', 'supplier_id', 'order_date',
        'shipping_carrier', 'tracking_number', 'delivery_status'
    ];

    for (const field of fieldsToUpdate) {
        if (headerData.hasOwnProperty(field)) {
            let value = headerData[field];
            if (field === 'status') {
                if (!ALLOWED_PO_STATUSES.includes(value.toLowerCase())) {
                    throw new BadRequestError(`Invalid status. Allowed: ${ALLOWED_PO_STATUSES.join(', ')}`);
                }
                value = value.toLowerCase();
            } else if (field === 'expected_delivery_date' || field === 'order_date') {
                if (value !== null && isNaN(new Date(value).getTime())) {
                    throw new BadRequestError(`Invalid ${field} format.`);
                }
                value = value ? new Date(value) : null;
            } else if (field === 'supplier_id') {
                if(isNaN(parseInt(value))) throw new BadRequestError('Invalid supplier_id.');
                const supplierCheck = await client.query('SELECT id FROM suppliers WHERE id = $1', [value]);
                if (supplierCheck.rows.length === 0) throw new NotFoundError(`Supplier with ID ${value} not found.`);
                value = parseInt(value);
            } else if ((field === 'shipping_carrier' || field === 'tracking_number' || field === 'delivery_status') && value === '') {
                 value = null; // Allow clearing these fields with an empty string
            }

            setClauses.push(`${field} = $${paramIndex++}`);
            values.push(value);
        }
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // Release lock
      return currentPOResult.rows[0]; // No changes, return current PO header data
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(purchaseOrderId); // For WHERE id = $N

    const updateQuery = `UPDATE purchase_orders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const result = await client.query(updateQuery, values);

    await client.query('COMMIT');

    // Return the complete purchase order with items for consistency
    return await getPurchaseOrderById(purchaseOrderId);

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error(`Error in purchaseOrderService.updatePurchaseOrderHeader for PO ID ${purchaseOrderId}:`, error);
    throw new AppError('Failed to update purchase order header.', 500, 'PO_HEADER_UPDATE_FAILED');
  } finally {
    client.release();
  }
}


/**
 * Adds an item to an existing Purchase Order.
 * @param {number} purchaseOrderId - The ID of the PO.
 * @param {object} itemData - Data for the new item.
 * @param {number} itemData.product_id
 * @param {number} itemData.quantity_ordered
 * @param {number} itemData.unit_cost_price
 * @param {string} [itemData.currency_code] - Optional, defaults to PO's supplier currency or base.
 * @param {number} adminUserId - ID of the admin performing the action.
 * @returns {Promise<object>} The newly created purchase order item.
 */
async function addPurchaseOrderItem(purchaseOrderId, itemData, adminUserId) {
  const { product_id, product_variant_id, quantity_ordered, unit_cost_price, currency_code: itemCurrencyCode } = itemData;

  if (!product_id || !quantity_ordered || unit_cost_price === undefined) {
    throw new BadRequestError('product_id, quantity_ordered, and unit_cost_price are required for new item.');
  }
  if (parseInt(quantity_ordered, 10) <= 0) throw new BadRequestError('Quantity ordered must be positive.');
  if (parseFloat(unit_cost_price) < 0) throw new BadRequestError('Unit cost price must be non-negative.');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const poResult = await client.query('SELECT id, supplier_id, status FROM purchase_orders WHERE id = $1 FOR UPDATE', [purchaseOrderId]);
    if (poResult.rows.length === 0) throw new NotFoundError(`Purchase Order with ID ${purchaseOrderId} not found.`);
    if (poResult.rows[0].status !== 'pending' && poResult.rows[0].status !== 'ordered') { // Example: only allow adding to certain statuses
        throw new BadRequestError(`Items can only be added to POs with status 'pending' or 'ordered'. Current status: ${poResult.rows[0].status}`);
    }
    const supplierId = poResult.rows[0].supplier_id;

    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) throw new NotFoundError(`Product with ID ${product_id} not found.`);
    
    // If product_variant_id is provided, validate it belongs to the product
    if (product_variant_id) {
      const variantCheck = await client.query(
        'SELECT id FROM product_variants WHERE id = $1 AND product_id = $2', 
        [product_variant_id, product_id]
      );
      if (variantCheck.rows.length === 0) {
        throw new NotFoundError(`Variant with ID ${product_variant_id} not found for product ${product_id}.`);
      }
    }

    let finalCurrencyCode = itemCurrencyCode;
    if (!finalCurrencyCode) {
        const supplier = await client.query('SELECT currency_code FROM suppliers WHERE id = $1', [supplierId]);
        finalCurrencyCode = supplier.rows[0]?.currency_code; // Use supplier's currency if item doesn't specify
    }
    finalCurrencyCode = finalCurrencyCode ? finalCurrencyCode.toUpperCase() : null;


    const itemInsertQuery = `
      INSERT INTO purchase_order_items
        (purchase_order_id, product_id, product_variant_id, quantity_ordered, unit_cost_price, currency_code)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const itemResult = await client.query(itemInsertQuery, [
      purchaseOrderId, product_id, product_variant_id || null, parseInt(quantity_ordered), parseFloat(unit_cost_price), finalCurrencyCode
    ]);

    // Mark PO as updated
    await client.query('UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [purchaseOrderId]);

    await client.query('COMMIT');
    return itemResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    console.error('Error in purchaseOrderService.addPurchaseOrderItem:', error);
    throw new AppError('Failed to add item to purchase order.', 500, 'PO_ADD_ITEM_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Updates an existing Purchase Order Item.
 * @param {number} poItemId - The ID of the PO item to update.
 * @param {object} itemData - Data to update for the item.
 * @param {number} [itemData.quantity_ordered]
 * @param {number} [itemData.unit_cost_price]
 * @param {string} [itemData.currency_code]
 * @param {number} adminUserId - ID of the admin performing the action.
 * @returns {Promise<object>} The updated purchase order item.
 */
async function updatePurchaseOrderItem(poItemId, itemData, adminUserId) {
  const { quantity_ordered, unit_cost_price, currency_code, product_variant_id } = itemData;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentItemResult = await client.query('SELECT * FROM purchase_order_items WHERE id = $1 FOR UPDATE', [poItemId]);
    if (currentItemResult.rows.length === 0) throw new NotFoundError(`Purchase Order Item with ID ${poItemId} not found.`);
    const currentItem = currentItemResult.rows[0];

    // Prevent updates if item has been partially or fully received
    if (currentItem.quantity_received > 0) {
        throw new BadRequestError(`Cannot update PO item ${poItemId} as it has already been partially or fully received.`);
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (quantity_ordered !== undefined) {
      const qty = parseInt(quantity_ordered);
      if (isNaN(qty) || qty <= 0) throw new BadRequestError('Quantity ordered must be a positive integer.');
      setClauses.push(`quantity_ordered = $${paramIndex++}`); values.push(qty);
    }
    if (unit_cost_price !== undefined) {
      const cost = parseFloat(unit_cost_price);
      if (isNaN(cost) || cost < 0) throw new BadRequestError('Unit cost price must be a non-negative number.');
      setClauses.push(`unit_cost_price = $${paramIndex++}`); values.push(cost);
    }
    if (currency_code !== undefined) {
        let codeToSet = null;
        if (currency_code !== null && currency_code.trim() !== '') {
            if (typeof currency_code !== 'string' || !/^[A-Z]{3}$/.test(currency_code.toUpperCase())) {
                throw new BadRequestError('Currency code must be 3 uppercase letters or null/empty to clear.');
            }
            codeToSet = currency_code.toUpperCase();
        }
      setClauses.push(`currency_code = $${paramIndex++}`); values.push(codeToSet);
    }
    
    if (product_variant_id !== undefined) {
      // If product_variant_id is provided, validate it belongs to the product
      if (product_variant_id) {
        const variantCheck = await client.query(
          'SELECT id FROM product_variants WHERE id = $1 AND product_id = $2', 
          [product_variant_id, currentItem.product_id]
        );
        if (variantCheck.rows.length === 0) {
          throw new NotFoundError(`Variant with ID ${product_variant_id} not found for product ${currentItem.product_id}.`);
        }
      }
      setClauses.push(`product_variant_id = $${paramIndex++}`); values.push(product_variant_id);
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return currentItem; // No changes
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`); // Assuming po_items has updated_at
    values.push(poItemId);

    const updateQuery = `UPDATE purchase_order_items SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const result = await client.query(updateQuery, values);

    // Mark parent PO as updated
    await client.query('UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [currentItem.purchase_order_id]);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    console.error('Error in purchaseOrderService.updatePurchaseOrderItem:', error);
    throw new AppError('Failed to update purchase order item.', 500, 'PO_UPDATE_ITEM_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Removes an item from a Purchase Order.
 * @param {number} poItemId - The ID of the PO item to remove.
 * @param {number} adminUserId - ID of the admin performing the action.
 * @returns {Promise<object>} The deleted purchase order item data.
 */
async function removePurchaseOrderItem(poItemId, adminUserId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query('SELECT * FROM purchase_order_items WHERE id = $1 FOR UPDATE', [poItemId]);
    if (itemResult.rows.length === 0) throw new NotFoundError(`Purchase Order Item ID ${poItemId} not found.`);
    const itemToDelete = itemResult.rows[0];

    if (itemToDelete.quantity_received > 0) {
        throw new BadRequestError(`Cannot remove PO item ${poItemId} as it has already been partially or fully received.`);
    }

    await client.query('DELETE FROM purchase_order_items WHERE id = $1', [poItemId]);

    // Mark parent PO as updated
    await client.query('UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [itemToDelete.purchase_order_id]);

    await client.query('COMMIT');
    return itemToDelete; // Return the data of the item that was deleted
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    console.error('Error in purchaseOrderService.removePurchaseOrderItem:', error);
    throw new AppError('Failed to remove purchase order item.', 500, 'PO_REMOVE_ITEM_FAILED');
  } finally {
    client.release();
  }
}


const config = require('../config'); // Re-ensure config is imported if not already at top for BASE_CURRENCY_CODE

/**
 * Gets all variants for a specific product.
 * @param {number} productId - The ID of the product.
 * @returns {Promise<Array>} Array of product variants with their option values.
 * @throws {NotFoundError} If the product is not found.
 */
async function getProductVariants(productId) {
  try {
    // First check if product exists
    const productCheck = await db.query('SELECT id, name FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }

    // Get all variants for the product with their option values
    const variantsQuery = `
      SELECT 
        pv.id,
        pv.sku,
        pv.price_modifier,
        pv.stock_quantity,
        pv.image_url,
        pv.created_at,
        pv.updated_at,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'option_name', po.name,
            'option_value', pov.value
          )
        ) FILTER (WHERE po.name IS NOT NULL) as option_values
      FROM product_variants pv
      LEFT JOIN product_variant_option_values pvov ON pv.id = pvov.product_variant_id
      LEFT JOIN product_option_values pov ON pvov.product_option_value_id = pov.id
      LEFT JOIN product_options po ON pov.product_option_id = po.id
      WHERE pv.product_id = $1
      GROUP BY pv.id, pv.sku, pv.price_modifier, pv.stock_quantity, pv.image_url, pv.created_at, pv.updated_at
      ORDER BY pv.id;
    `;
    
    const variantsResult = await db.query(variantsQuery, [productId]);
    
    return {
      product: productCheck.rows[0],
      variants: variantsResult.rows
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error in purchaseOrderService.getProductVariants for product ID ${productId}:`, error);
    throw new AppError('Failed to retrieve product variants.', 500, 'GET_PRODUCT_VARIANTS_FAILED');
  }
}

/**
 * Receives stock for a specific purchase order item.
 * Updates PO item, product/variant stock & cost, creates inventory batch, logs movements.
 * @param {number} poItemId - The ID of the Purchase Order Item.
 * @param {object} receiveData - Data for receiving stock.
 * @param {number} receiveData.quantity_received_now
 * @param {number} [receiveData.exchange_rate_to_base] - Required if PO item currency differs from base.
 * @param {string} [receiveData.batch_number] - Optional batch number for the received stock.
 * @param {string} [receiveData.expiry_date] - Optional expiry date for the batch.
 * @param {number} adminUserId - ID of the admin performing the action.
 * @returns {Promise<object>} Object containing the updated PO, updated PO item, and new batch ID if created.
 */
async function receiveStockForPurchaseOrderItem(poItemId, receiveData, adminUserId) {
  const { quantity_received_now, exchange_rate_to_base, batch_number, expiry_date } = receiveData;
  const BASE_CURRENCY_CODE = config.currency.defaultStoreCurrency || 'USD'; // Get from config

  const qtyReceivedNow = parseInt(quantity_received_now, 10);
  if (isNaN(qtyReceivedNow) || qtyReceivedNow <= 0) {
    throw new BadRequestError('quantity_received_now must be a positive integer.');
  }
  // Further validation for batch_number, expiry_date can be done here or rely on route validation

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const poItemResult = await client.query(
      'SELECT poi.*, po.supplier_id, po.id as purchase_order_id_header FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE poi.id = $1 FOR UPDATE',
      [poItemId]
    );
    if (poItemResult.rows.length === 0) {
      throw new NotFoundError(`Purchase order item with ID ${poItemId} not found.`);
    }
    const poItem = poItemResult.rows[0];
    const purchaseOrderId = poItem.purchase_order_id_header; // from JOIN
    const supplierIdForCostHistory = poItem.supplier_id; // from JOIN

    // Check PO status
    const poStatusResult = await client.query('SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE', [purchaseOrderId]);
    const currentPOStatus = poStatusResult.rows[0].status;
    if (!['ordered', 'partially_received'].includes(currentPOStatus)) {
      throw new BadRequestError(`Cannot receive stock for a PO with status "${currentPOStatus}". Must be 'ordered' or 'partially_received'.`);
    }

    const totalReceivable = poItem.quantity_ordered - poItem.quantity_received;
    if (qtyReceivedNow > totalReceivable) {
      throw new BadRequestError(`Quantity received now (${qtyReceivedNow}) exceeds remaining receivable quantity (${totalReceivable}).`);
    }

    // Calculate base_currency_cost_price
    let baseCostPrice = null;
    let exchangeRateForStorage = null;
    const poItemCurrency = poItem.currency_code ? poItem.currency_code.toUpperCase() : null;

    if (poItemCurrency === BASE_CURRENCY_CODE) {
        baseCostPrice = poItem.unit_cost_price;
        exchangeRateForStorage = 1;
    } else if (poItemCurrency && exchange_rate_to_base !== undefined && exchange_rate_to_base !== null) {
        const parsedExchangeRate = parseFloat(exchange_rate_to_base);
        if (!isNaN(parsedExchangeRate) && parsedExchangeRate > 0) {
            baseCostPrice = parseFloat((parseFloat(poItem.unit_cost_price) * parsedExchangeRate).toFixed(2)); // Ensure poItem.unit_cost_price is float
            exchangeRateForStorage = parsedExchangeRate;
        } else {
            throw new BadRequestError('Invalid exchange_rate_to_base provided. Must be a positive number.');
        }
    } // If currencies differ and no rate, baseCostPrice remains null, logged as such.


    // Update PO Item: quantity_received, base_currency_cost_price, exchange_rate_at_receipt
    const updatedPoItemResult = await client.query(
      `UPDATE purchase_order_items
       SET quantity_received = quantity_received + $1,
           base_currency_cost_price = COALESCE($3, base_currency_cost_price),
           exchange_rate_at_receipt = COALESCE($4, exchange_rate_at_receipt),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *;`,
      [qtyReceivedNow, poItemId, baseCostPrice, exchangeRateForStorage]
    );
    const updatedPoItem = updatedPoItemResult.rows[0];

    // Update Product/Variant Stock and Cost Price
    let old_stock_quantity = 0;
    const productOrVariantTable = poItem.product_variant_id ? 'product_variants' : 'products';
    const productOrVariantId = poItem.product_variant_id || poItem.product_id;

    const stockFetchQuery = `SELECT stock_quantity FROM ${productOrVariantTable} WHERE id = $1 FOR UPDATE`;
    const stockFetchResult = await client.query(stockFetchQuery, [productOrVariantId]);
    if (stockFetchResult.rows.length > 0) old_stock_quantity = stockFetchResult.rows[0].stock_quantity;
    else throw new NotFoundError(`${productOrVariantTable.slice(0,-1)} ID ${productOrVariantId} linked to PO item not found.`);

    const new_stock_on_product_table = old_stock_quantity + qtyReceivedNow; // This is the aggregate for product/variant table

    let updateStockCostQuery = `UPDATE ${productOrVariantTable} SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP`;
    const updateStockCostParams = [qtyReceivedNow];
    let currentUpdateParamIndex = 2;
    if (baseCostPrice !== null) {
        updateStockCostQuery += `, cost_price = $${currentUpdateParamIndex++}`;
        updateStockCostParams.push(baseCostPrice);
    }
    updateStockCostQuery += ` WHERE id = $${currentUpdateParamIndex++} RETURNING stock_quantity;`;
    updateStockCostParams.push(productOrVariantId);
    await client.query(updateStockCostQuery, updateStockCostParams);

    // Log Stock Movement (based on aggregate product/variant table, not batch)
    await client.query(
      `INSERT INTO stock_movement_logs (product_id, variant_id, user_id, movement_type, quantity_changed, new_quantity_on_hand, reason, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [poItem.product_id, poItem.product_variant_id || null, adminUserId, 'po_receipt', qtyReceivedNow, new_stock_on_product_table, `Received PO #${purchaseOrderId}, Item #${poItemId}`, poItemId.toString()]
    );

    // Create Inventory Batch
    const finalBatchNumber = batch_number ? batch_number.trim() : `PO${purchaseOrderId}-ITM${poItemId}-${Date.now()}`;
    let finalExpiryDateFormatted = null;
    if (expiry_date) { // Already validated as date string or null by route
        finalExpiryDateFormatted = new Date(expiry_date).toISOString().split('T')[0];
    }
    const batchInsertQuery = `
      INSERT INTO inventory_batches
        (product_id, variant_id, batch_number, expiry_date, quantity_received, quantity_remaining,
         cost_price_at_receipt, currency_code_at_receipt, base_currency_cost_price_at_receipt,
         exchange_rate_used, purchase_order_item_id, received_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING id;`;
    const batchResult = await client.query(batchInsertQuery, [
      poItem.product_id, poItem.product_variant_id || null, finalBatchNumber, finalExpiryDateFormatted,
      qtyReceivedNow, qtyReceivedNow, poItem.unit_cost_price, poItem.currency_code || null,
      baseCostPrice, exchangeRateForStorage, poItemId
    ]);
    const newBatchId = batchResult.rows[0].id;

    // Create Product Cost History
    await client.query(
      `INSERT INTO product_cost_history
          (product_id, variant_id, supplier_id, currency_code, cost_price, quantity_received,
           purchase_order_item_id, effective_date, base_currency_cost_price, exchange_rate_at_receipt, inventory_batch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10)`,
      [poItem.product_id, poItem.product_variant_id || null, supplierIdForCostHistory, poItem.currency_code || null,
       poItem.unit_cost_price, qtyReceivedNow, poItemId, baseCostPrice, exchangeRateForStorage, newBatchId]
    );

    // Update Overall PO Status
    const allItemsForPOResult = await client.query(
      'SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1',
      [purchaseOrderId]
    );
    let totalOrderedOnPO = 0;
    let totalReceivedOnPO = 0;
    allItemsForPOResult.rows.forEach(item => {
      totalOrderedOnPO += item.quantity_ordered;
      totalReceivedOnPO += item.quantity_received;
    });
    let newPOStatus = currentPOStatus;
    if (totalReceivedOnPO >= totalOrderedOnPO) newPOStatus = 'received';
    else if (totalReceivedOnPO > 0) newPOStatus = 'partially_received';

    if (newPOStatus !== currentPOStatus || newPOStatus === 'partially_received') {
      await client.query('UPDATE purchase_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newPOStatus, purchaseOrderId]);
    } else {
      await client.query('UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [purchaseOrderId]);
    }

    await client.query('COMMIT');

    // Fetch updated PO for response
    const finalPo = await getPurchaseOrderById(purchaseOrderId); // Uses its own client
    return {
      message: `Successfully received ${qtyReceivedNow} unit(s) for item ${poItemId} on PO #${purchaseOrderId}.`,
      purchaseOrder: finalPo,
      updatedItem: updatedPoItem, // from RETURNING of po_item update
      new_batch_id: newBatchId
    };

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    if (error.code === '23505' && error.constraint && error.constraint.includes('inventory_batches_product_id_variant_id_batch_number_key')) {
        throw new ConflictError(`Batch number "${batch_number}" already exists for this product/variant.`);
    }
    console.error(`Error in purchaseOrderService.receiveStock for PO Item ID ${poItemId}:`, error);
    throw new AppError('Failed to receive stock.', 500, 'PO_RECEIVE_STOCK_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Deletes a purchase order and all its associated items.
 * Only allows deletion of POs with status 'pending' or 'cancelled'.
 * @param {number} purchaseOrderId - The ID of the purchase order to delete.
 * @param {number} adminUserId - ID of the admin performing the deletion.
 * @returns {Promise<object>} Object containing deletion confirmation.
 * @throws {NotFoundError} If the purchase order is not found.
 * @throws {BadRequestError} If the PO cannot be deleted due to its status.
 */
async function deletePurchaseOrder(purchaseOrderId, adminUserId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if PO exists and get its status
    const poResult = await client.query(
      'SELECT id, status FROM purchase_orders WHERE id = $1 FOR UPDATE',
      [purchaseOrderId]
    );
    
    if (poResult.rows.length === 0) {
      throw new NotFoundError(`Purchase order with ID ${purchaseOrderId} not found.`);
    }

    const po = poResult.rows[0];
    
    // Only allow deletion of pending or cancelled POs
    if (!['pending', 'cancelled'].includes(po.status)) {
      throw new BadRequestError(`Cannot delete purchase order with status "${po.status}". Only 'pending' or 'cancelled' purchase orders can be deleted.`);
    }

    // Check if any items have been received (safety check)
    const receivedItemsResult = await client.query(
      'SELECT COUNT(*) as received_count FROM purchase_order_items WHERE purchase_order_id = $1 AND quantity_received > 0',
      [purchaseOrderId]
    );
    
    const receivedCount = parseInt(receivedItemsResult.rows[0].received_count, 10);
    if (receivedCount > 0) {
      throw new BadRequestError(`Cannot delete purchase order #${purchaseOrderId} because ${receivedCount} item(s) have already been received.`);
    }

    // Delete all PO items first (cascade should handle this, but being explicit)
    await client.query(
      'DELETE FROM purchase_order_items WHERE purchase_order_id = $1',
      [purchaseOrderId]
    );

    // Delete the purchase order
    const deleteResult = await client.query(
      'DELETE FROM purchase_orders WHERE id = $1 RETURNING id, supplier_id, order_date',
      [purchaseOrderId]
    );

    if (deleteResult.rows.length === 0) {
      throw new NotFoundError(`Purchase order with ID ${purchaseOrderId} not found during deletion.`);
    }

    await client.query('COMMIT');

    return {
      message: `Purchase order #${purchaseOrderId} has been successfully deleted.`,
      deletedPO: deleteResult.rows[0]
    };

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error(`Error in purchaseOrderService.deletePurchaseOrder for PO ID ${purchaseOrderId}:`, error);
    throw new AppError('Failed to delete purchase order.', 500, 'PO_DELETION_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderHeader,
  addPurchaseOrderItem,
  updatePurchaseOrderItem,
  removePurchaseOrderItem,
  receiveStockForPurchaseOrderItem,
  getProductVariants,
  deletePurchaseOrder,
};
