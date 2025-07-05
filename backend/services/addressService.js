const db = require('../db');
const { NotFoundError, BadRequestError, AppError, ConflictError } = require('../utils/AppError');

/**
 * Creates a new address for a user
 * @param {number} userId - The ID of the user
 * @param {object} addressData - The address data
 * @returns {Promise<object>} The created address
 */
async function createAddress(userId, addressData) {
  const {
    address_type = 'shipping',
    is_default = false,
    first_name,
    last_name,
    company,
    address_line1,
    address_line2,
    city,
    state_province,
    postal_code,
    country,
    phone
  } = addressData;

  // Validate required fields
  if (!first_name || !last_name || !address_line1 || !city || !state_province || !postal_code || !country) {
    throw new BadRequestError('First name, last name, address line 1, city, state/province, postal code, and country are required.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // If this is a default address, unset other default addresses of the same type
    if (is_default) {
      await client.query(`
        UPDATE addresses 
        SET is_default = FALSE 
        WHERE user_id = $1 AND address_type = $2 AND is_default = TRUE
      `, [userId, address_type]);
    }

    // Create the new address
    const result = await client.query(`
      INSERT INTO addresses (
        user_id, address_type, is_default, first_name, last_name, company,
        address_line1, address_line2, city, state_province, postal_code, country, phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      userId, address_type, is_default, first_name, last_name, company,
      address_line1, address_line2, city, state_province, postal_code, country, phone
    ]);

    const newAddress = result.rows[0];

    // If this is a default shipping address, update the user's default_shipping_address_id
    if (is_default && address_type === 'shipping') {
      await client.query(`
        UPDATE users 
        SET default_shipping_address_id = $1 
        WHERE id = $2
      `, [newAddress.id, userId]);
    }

    await client.query('COMMIT');
    return newAddress;

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof AppError) throw error;
    if (error.code === '23505') { // Unique constraint violation
      throw new ConflictError('A default address of this type already exists for this user.');
    }
    console.error('Error in addressService.createAddress:', error);
    throw new AppError('Failed to create address.', 500, 'ADDRESS_CREATION_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Gets all addresses for a user
 * @param {number} userId - The ID of the user
 * @returns {Promise<Array>} Array of addresses
 */
async function getUserAddresses(userId) {
  try {
    const result = await db.query(`
      SELECT * FROM addresses 
      WHERE user_id = $1 
      ORDER BY is_default DESC, address_type, created_at DESC
    `, [userId]);
    
    return result.rows;
  } catch (error) {
    console.error('Error in addressService.getUserAddresses:', error);
    throw new AppError('Failed to retrieve addresses.', 500, 'ADDRESS_RETRIEVAL_FAILED');
  }
}

/**
 * Gets a specific address by ID
 * @param {number} addressId - The ID of the address
 * @param {number} userId - The ID of the user (for security)
 * @returns {Promise<object>} The address
 */
async function getAddressById(addressId, userId) {
  try {
    const result = await db.query(`
      SELECT * FROM addresses 
      WHERE id = $1 AND user_id = $2
    `, [addressId, userId]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Address not found.');
    }
    
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Error in addressService.getAddressById:', error);
    throw new AppError('Failed to retrieve address.', 500, 'ADDRESS_RETRIEVAL_FAILED');
  }
}

/**
 * Updates an address
 * @param {number} addressId - The ID of the address
 * @param {number} userId - The ID of the user
 * @param {object} updateData - The data to update
 * @returns {Promise<object>} The updated address
 */
async function updateAddress(addressId, userId, updateData) {
  const {
    address_type,
    is_default,
    first_name,
    last_name,
    company,
    address_line1,
    address_line2,
    city,
    state_province,
    postal_code,
    country,
    phone
  } = updateData;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if address exists and belongs to user
    const existingAddress = await client.query(`
      SELECT * FROM addresses WHERE id = $1 AND user_id = $2
    `, [addressId, userId]);

    if (existingAddress.rows.length === 0) {
      throw new NotFoundError('Address not found.');
    }

    const currentAddress = existingAddress.rows[0];

    // If setting as default, unset other default addresses of the same type
    if (is_default && !currentAddress.is_default) {
      await client.query(`
        UPDATE addresses 
        SET is_default = FALSE 
        WHERE user_id = $1 AND address_type = $2 AND is_default = TRUE
      `, [userId, address_type || currentAddress.address_type]);
    }

    // Build update query
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'address_type', 'is_default', 'first_name', 'last_name', 'company',
      'address_line1', 'address_line2', 'city', 'state_province', 'postal_code', 'country', 'phone'
    ];

    for (const field of allowedFields) {
      if (updateData.hasOwnProperty(field)) {
        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(updateData[field]);
      }
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return currentAddress; // No changes
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(addressId, userId);

    const updateQuery = `
      UPDATE addresses 
      SET ${setClauses.join(', ')} 
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      throw new NotFoundError('Address not found or update failed.');
    }

    const updatedAddress = result.rows[0];

    // Update user's default_shipping_address_id if this is now the default shipping address
    if (updatedAddress.is_default && updatedAddress.address_type === 'shipping') {
      await client.query(`
        UPDATE users 
        SET default_shipping_address_id = $1 
        WHERE id = $2
      `, [updatedAddress.id, userId]);
    } else if (!updatedAddress.is_default && updatedAddress.address_type === 'shipping') {
      // If this is no longer the default shipping address, clear the user's default_shipping_address_id
      await client.query(`
        UPDATE users 
        SET default_shipping_address_id = NULL 
        WHERE id = $2 AND default_shipping_address_id = $1
      `, [updatedAddress.id, userId]);
    }

    await client.query('COMMIT');
    return updatedAddress;

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    if (error.code === '23505') {
      throw new ConflictError('A default address of this type already exists for this user.');
    }
    console.error('Error in addressService.updateAddress:', error);
    throw new AppError('Failed to update address.', 500, 'ADDRESS_UPDATE_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Deletes an address
 * @param {number} addressId - The ID of the address
 * @param {number} userId - The ID of the user
 * @returns {Promise<object>} The deleted address
 */
async function deleteAddress(addressId, userId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if address exists and belongs to user
    const existingAddress = await client.query(`
      SELECT * FROM addresses WHERE id = $1 AND user_id = $2
    `, [addressId, userId]);

    if (existingAddress.rows.length === 0) {
      throw new NotFoundError('Address not found.');
    }

    const addressToDelete = existingAddress.rows[0];

    // Delete the address
    const result = await client.query(`
      DELETE FROM addresses 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [addressId, userId]);

    // If this was the default shipping address, clear the user's default_shipping_address_id
    if (addressToDelete.is_default && addressToDelete.address_type === 'shipping') {
      await client.query(`
        UPDATE users 
        SET default_shipping_address_id = NULL 
        WHERE id = $1
      `, [userId]);
    }

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError) throw error;
    console.error('Error in addressService.deleteAddress:', error);
    throw new AppError('Failed to delete address.', 500, 'ADDRESS_DELETION_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Gets the default shipping address for a user
 * @param {number} userId - The ID of the user
 * @returns {Promise<object|null>} The default shipping address or null
 */
async function getDefaultShippingAddress(userId) {
  try {
    const result = await db.query(`
      SELECT * FROM addresses 
      WHERE user_id = $1 AND address_type = 'shipping' AND is_default = TRUE
      LIMIT 1
    `, [userId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error in addressService.getDefaultShippingAddress:', error);
    throw new AppError('Failed to retrieve default shipping address.', 500, 'ADDRESS_RETRIEVAL_FAILED');
  }
}

module.exports = {
  createAddress,
  getUserAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  getDefaultShippingAddress
}; 