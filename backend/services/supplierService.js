// backend/services/supplierService.js
const db = require('../db');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

/**
 * Creates a new supplier.
 * @param {object} supplierData - Data for the new supplier.
 * @param {string} supplierData.name
 * @param {string} [supplierData.contact_person]
 * @param {string} [supplierData.email]
 * @param {string} [supplierData.phone]
 * @param {string} [supplierData.address_line1]
 * @param {string} [supplierData.address_line2]
 * @param {string} [supplierData.city]
 * @param {string} [supplierData.postal_code]
 * @param {string} [supplierData.country]
 * @param {string} [supplierData.notes]
 * @param {string} [supplierData.currency_code] - Expected as 3 uppercase letters.
 * @returns {Promise<object>} The newly created supplier object.
 * @throws {ConflictError} If a supplier with the same name or email already exists.
 * @throws {AppError} If database operation fails.
 */
async function createSupplier(supplierData) {
  const {
    name, contact_person, email, phone,
    address_line1, address_line2, city, postal_code, country, notes,
    currency_code
  } = supplierData;

  // Basic validation for required fields (though route level validation should be primary)
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new BadRequestError('Supplier name is required and must be a non-empty string.');
  }

  let final_currency_code = null;
  if (currency_code !== undefined && currency_code !== null) {
    if (typeof currency_code !== 'string' || !/^[A-Z]{3}$/.test(currency_code.toUpperCase())) {
      // This validation ideally belongs at the route level with express-validator
      throw new BadRequestError('Currency code must be 3 uppercase letters if provided.');
    }
    final_currency_code = currency_code.toUpperCase();
  }

  const query = `
    INSERT INTO suppliers
      (name, contact_person, email, phone, address_line1, address_line2, city, postal_code, country, notes, currency_code, updated_at, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [
    name.trim(),
    contact_person || null,
    email ? email.trim().toLowerCase() : null, // Store email in lowercase for consistency
    phone || null,
    address_line1 || null,
    address_line2 || null,
    city || null,
    postal_code || null,
    country || null,
    notes || null,
    final_currency_code
  ];

  try {
    const result = await db.query(query, values);
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    throw new AppError('Supplier creation succeeded but failed to return data.', 500, 'SUPPLIER_CREATION_NO_DATA');
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'suppliers_name_key') {
        throw new ConflictError(`Supplier name "${name.trim()}" already exists.`);
      }
      if (error.constraint === 'suppliers_email_key') {
        throw new ConflictError(`Supplier email "${email.trim().toLowerCase()}" already exists.`);
      }
    }
    console.error('Error in supplierService.createSupplier:', error);
    throw new AppError('Failed to create supplier due to a server error.', 500, 'SUPPLIER_CREATION_FAILED');
  }
}

/**
 * Retrieves a paginated list of all suppliers.
 * @param {object} options - Pagination options.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<object>} An object containing the list of suppliers and pagination details.
 * @throws {AppError} If database operation fails.
 */
async function getAllSuppliers(options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20; // Default limit
  const offset = (page - 1) * limit;

  try {
    const countQuery = 'SELECT COUNT(*) FROM suppliers';
    const suppliersQuery = 'SELECT * FROM suppliers ORDER BY name ASC LIMIT $1 OFFSET $2';

    const countResult = await db.query(countQuery);
    const totalSuppliers = parseInt(countResult.rows[0].count);

    const suppliersResult = await db.query(suppliersQuery, [limit, offset]);

    return {
      suppliers: suppliersResult.rows,
      totalSuppliers,
      page,
      limit,
      totalPages: Math.ceil(totalSuppliers / limit),
    };
  } catch (error) {
    console.error('Error in supplierService.getAllSuppliers:', error);
    throw new AppError('Failed to retrieve suppliers due to a server error.', 500, 'SUPPLIER_FETCH_ALL_FAILED');
  }
}

/**
 * Retrieves a single supplier by its ID.
 * @param {number} supplierId - The ID of the supplier.
 * @returns {Promise<object>} The supplier object.
 * @throws {NotFoundError} If the supplier is not found.
 * @throws {AppError} If database operation fails.
 */
async function getSupplierById(supplierId) {
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplierId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Supplier with ID ${supplierId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in supplierService.getSupplierById for ID ${supplierId}:`, error);
    throw new AppError(`Failed to retrieve supplier ID ${supplierId}.`, 500, 'SUPPLIER_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates an existing supplier.
 * @param {number} supplierId - The ID of the supplier to update.
 * @param {object} updateData - An object containing the fields to update.
 * @returns {Promise<object>} The updated supplier object.
 * @throws {NotFoundError} If the supplier is not found.
 * @throws {ConflictError} If the new name or email conflicts with an existing supplier.
 * @throws {BadRequestError} If input data is invalid (e.g. currency_code format).
 * @throws {AppError} If database operation fails.
 */
async function updateSupplier(supplierId, updateData) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentSupplierResult = await client.query('SELECT * FROM suppliers WHERE id = $1 FOR UPDATE', [supplierId]);
    if (currentSupplierResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Supplier with ID ${supplierId} not found.`);
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const fields = [
      'name', 'contact_person', 'email', 'phone', 'address_line1',
      'address_line2', 'city', 'postal_code', 'country', 'notes', 'currency_code'
    ];

    for (const field of fields) {
      if (updateData.hasOwnProperty(field)) {
        let value = updateData[field];
        if (field === 'name') {
          if (!value || typeof value !== 'string' || value.trim() === '') {
            await client.query('ROLLBACK');
            throw new BadRequestError('Supplier name must be a non-empty string.');
          }
          value = value.trim();
        }
        if (field === 'email' && value) {
          value = value.trim().toLowerCase();
        }
        if (field === 'currency_code' && value) {
          if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value.toUpperCase())) {
            await client.query('ROLLBACK');
            throw new BadRequestError('Currency code must be 3 uppercase letters if provided.');
          }
          value = value.toUpperCase();
        }

        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(value === undefined || value === '' ? null : value); // Treat empty string as null for optional fields
      }
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // Release lock
      return currentSupplierResult.rows[0]; // No actual updates, return current state
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(supplierId); // For WHERE id = $N

    const updateQuery = `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const result = await client.query(updateQuery, values);

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint === 'suppliers_name_key') {
        throw new ConflictError(`Supplier name "${updateData.name.trim()}" already exists.`);
      }
      if (error.constraint === 'suppliers_email_key' && updateData.email) {
        throw new ConflictError(`Supplier email "${updateData.email.trim().toLowerCase()}" already exists.`);
      }
    }
    console.error(`Error in supplierService.updateSupplier for ID ${supplierId}:`, error);
    throw new AppError(`Failed to update supplier ID ${supplierId}.`, 500, 'SUPPLIER_UPDATE_FAILED');
  } finally {
    client.release();
  }
}


/**
 * Deletes a supplier by its ID.
 * Checks if the supplier is linked to any purchase orders.
 * @param {number} supplierId - The ID of the supplier to delete.
 * @returns {Promise<object>} The deleted supplier object.
 * @throws {NotFoundError} If the supplier is not found.
 * @throws {BadRequestError} If the supplier is linked to purchase orders.
 * @throws {AppError} If database operation fails.
 */
async function deleteSupplier(supplierId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if supplier exists
    const supplierCheck = await client.query('SELECT id FROM suppliers WHERE id = $1 FOR UPDATE', [supplierId]);
    if (supplierCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Supplier with ID ${supplierId} not found.`);
    }

    // Check if supplier is linked to any purchase orders
    const poCheck = await client.query('SELECT id FROM purchase_orders WHERE supplier_id = $1 LIMIT 1', [supplierId]);
    if (poCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new BadRequestError(`Cannot delete supplier: They are linked to existing purchase order(s) (e.g., PO ID ${poCheck.rows[0].id}). Please reassign or delete those records first.`);
    }

    // Products.supplier_id is ON DELETE SET NULL, so no explicit check needed here for products,
    // but good to be aware of this behavior.

    const result = await client.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [supplierId]);
    // No need to check result.rowCount === 0 again due to the FOR UPDATE check above.

    await client.query('COMMIT');
    return result.rows[0]; // Return the deleted supplier data
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    // The route handler catches '23503' for general FK violations, but we've made it more specific.
    console.error(`Error in supplierService.deleteSupplier for ID ${supplierId}:`, error);
    throw new AppError(`Failed to delete supplier ID ${supplierId}.`, 500, 'SUPPLIER_DELETE_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};
