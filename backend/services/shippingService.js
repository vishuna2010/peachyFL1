const db = require('../db');

/**
 * Create a new shipping method.
 */
async function createShippingMethod({ name, price, courier_id, description }) {
  const result = await db.query(
    `INSERT INTO shipping_methods (name, price, courier_id, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, price, courier_id, description]
  );
  return result.rows[0];
}

/**
 * Update a shipping method.
 */
async function updateShippingMethod(id, { name, price, courier_id, description }) {
  const result = await db.query(
    `UPDATE shipping_methods SET name = $1, price = $2, courier_id = $3, description = $4 WHERE id = $5 RETURNING *`,
    [name, price, courier_id, description, id]
  );
  if (result.rows.length === 0) {
    throw new Error('Shipping method not found');
  }
  return result.rows[0];
}

/**
 * Delete a shipping method.
 */
async function deleteShippingMethod(id) {
  const result = await db.query(
    `DELETE FROM shipping_methods WHERE id = $1 RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new Error('Shipping method not found');
  }
  return result.rows[0];
}

/**
 * List all shipping methods.
 */
async function listShippingMethods() {
  const result = await db.query(
    `SELECT sm.*, c.name as courier_name FROM shipping_methods sm LEFT JOIN couriers c ON sm.courier_id = c.id`
  );
  return result.rows;
}

/**
 * Create a new courier.
 */
async function createCourier({ name, contact_info }) {
  const result = await db.query(
    `INSERT INTO couriers (name, contact_info) VALUES ($1, $2) RETURNING *`,
    [name, contact_info]
  );
  return result.rows[0];
}

/**
 * Update a courier.
 */
async function updateCourier(id, { name, contact_info }) {
  const result = await db.query(
    `UPDATE couriers SET name = $1, contact_info = $2 WHERE id = $3 RETURNING *`,
    [name, contact_info, id]
  );
  if (result.rows.length === 0) {
    throw new Error('Courier not found');
  }
  return result.rows[0];
}

/**
 * Delete a courier.
 */
async function deleteCourier(id) {
  const result = await db.query(
    `DELETE FROM couriers WHERE id = $1 RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new Error('Courier not found');
  }
  return result.rows[0];
}

/**
 * List all couriers.
 */
async function listCouriers() {
  const result = await db.query(`SELECT * FROM couriers`);
  return result.rows;
}

/**
 * Get available shipping options for a cart/order (basic version: just list all methods).
 */
async function getAvailableShippingOptions(/* cart, address, etc. */) {
  // In a real system, filter by address, weight, etc.
  return await listShippingMethods();
}

module.exports = {
  createShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
  listShippingMethods,
  createCourier,
  updateCourier,
  deleteCourier,
  listCouriers,
  getAvailableShippingOptions,
}; 