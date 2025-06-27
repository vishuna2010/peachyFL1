// backend/services/discountService.js
const db = require('../db');
const { AppError, BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

/**
 * Creates a new discount.
 * @param {object} discountData - Data for the new discount.
 * @param {string} discountData.code
 * @param {string} discountData.type - 'percentage' or 'fixed_amount'
 * @param {number} discountData.value
 * @param {string} [discountData.description]
 * @param {boolean} [discountData.is_active=true]
 * @param {Date} [discountData.valid_from]
 * @param {Date} [discountData.valid_until]
 * @param {number} [discountData.usage_limit]
 * @param {number} [discountData.min_order_amount]
 * @returns {Promise<object>} The newly created discount object.
 * @throws {ConflictError} If a discount code already exists.
 * @throws {AppError} If database operation fails.
 */
async function createDiscount(discountData) {
  const {
    code,
    type,
    value,
    description,
    is_active = true, // Default is_active to true if not provided
    valid_from,
    valid_until,
    usage_limit,
    min_order_amount,
  } = discountData;

  // Validate type-specific value constraints (though validator should also catch this)
  if (type === 'percentage' && (value < 0.01 || value > 100)) {
    throw new BadRequestError('Percentage discount value must be between 0.01 and 100.');
  }
  if (valid_from && valid_until && new Date(valid_until) < new Date(valid_from)) {
    throw new BadRequestError('valid_until must be after or the same as valid_from.');
  }

  const query = `
    INSERT INTO discounts
      (code, type, value, description, is_active, valid_from, valid_until, usage_limit, min_order_amount, updated_at, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [
    code.toUpperCase(), // Store codes in uppercase
    type,
    value,
    description,
    is_active,
    valid_from || null,
    valid_until || null,
    usage_limit === undefined ? null : usage_limit, // Ensure undefined becomes null
    min_order_amount === undefined ? null : min_order_amount, // Ensure undefined becomes null
  ];

  try {
    const result = await db.query(query, values);
    // The route handler used to do a pre-check for existing code.
    // The DB unique constraint on 'code' is the ultimate source of truth.
    // If this INSERT fails due to unique constraint, the catch block will handle it.
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    // This path should not be reached if RETURNING * works and no error is thrown.
    throw new AppError('Discount creation succeeded but failed to return data.', 500, 'DISCOUNT_CREATION_NO_DATA');
  } catch (error) {
    if (error.code === '23505' && error.constraint && error.constraint.includes('discounts_code_key')) { // Check constraint name if available
      throw new ConflictError(`Discount code "${code.toUpperCase()}" already exists.`);
    }
    console.error('Error in discountService.createDiscount:', error);
    throw new AppError('Failed to create discount due to a server error.', 500, 'DISCOUNT_CREATION_FAILED');
  }
}

/**
 * Retrieves a paginated list of all discounts.
 * @param {object} options - Pagination options.
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<object>} An object containing the list of discounts and pagination details.
 * @throws {AppError} If database operation fails.
 */
async function getAllDiscounts(options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  try {
    const countQuery = 'SELECT COUNT(*) FROM discounts';
    const discountsQuery = 'SELECT * FROM discounts ORDER BY created_at DESC LIMIT $1 OFFSET $2';

    const countResult = await db.query(countQuery);
    const totalDiscounts = parseInt(countResult.rows[0].count);

    const discountsResult = await db.query(discountsQuery, [limit, offset]);

    return {
      discounts: discountsResult.rows,
      totalDiscounts,
      page,
      limit,
      totalPages: Math.ceil(totalDiscounts / limit),
    };
  } catch (error) {
    console.error('Error in discountService.getAllDiscounts:', error);
    throw new AppError('Failed to retrieve discounts due to a server error.', 500, 'DISCOUNT_FETCH_ALL_FAILED');
  }
}


/**
 * Retrieves a single discount by its ID.
 * @param {number} discountId - The ID of the discount.
 * @returns {Promise<object>} The discount object.
 * @throws {NotFoundError} If the discount is not found.
 * @throws {AppError} If database operation fails.
 */
async function getDiscountById(discountId) {
  try {
    const result = await db.query('SELECT * FROM discounts WHERE id = $1', [discountId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Discount with ID ${discountId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in discountService.getDiscountById for ID ${discountId}:`, error);
    throw new AppError(`Failed to retrieve discount ID ${discountId}.`, 500, 'DISCOUNT_FETCH_BY_ID_FAILED');
  }
}

/**
 * Retrieves a single discount by its code.
 * @param {string} discountCode - The code of the discount (case-insensitive).
 * @returns {Promise<object|null>} The discount object, or null if not found.
 * @throws {AppError} If database operation fails.
 */
async function getDiscountByCode(discountCode) {
  try {
    // Assuming codes are stored in uppercase in DB for consistent lookup
    const result = await db.query('SELECT * FROM discounts WHERE code = $1', [discountCode.toUpperCase()]);
    if (result.rows.length === 0) {
      // For getByCode, returning null might be preferred over NotFoundError in some contexts,
      // e.g., when checking if a code exists without it being an error condition.
      // However, if the expectation is that it *should* exist, NotFoundError is appropriate.
      // Let's be consistent with getDiscountById for now.
      throw new NotFoundError(`Discount with code "${discountCode}" not found.`);
    }
    return result.rows[0];
  } catch (error) {
     if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in discountService.getDiscountByCode for code ${discountCode}:`, error);
    throw new AppError(`Failed to retrieve discount code ${discountCode}.`, 500, 'DISCOUNT_FETCH_BY_CODE_FAILED');
  }
}

/**
 * Updates an existing discount.
 * @param {number} discountId - The ID of the discount to update.
 * @param {object} updateData - An object containing the fields to update.
 *                                Fields like 'code' are not updatable.
 * @returns {Promise<object>} The updated discount object.
 * @throws {NotFoundError} If the discount is not found.
 * @throws {BadRequestError} If validation fails (e.g., date logic, percentage value).
 * @throws {AppError} If database operation fails.
 */
async function updateDiscount(discountId, updateData) {
  const updatableFields = [
    'type', 'value', 'description', 'is_active',
    'valid_from', 'valid_until', 'usage_limit', 'min_order_amount'
  ];
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  // Fetch current discount to validate against, especially for conditional logic
  // This also serves as a check for existence and locks the row.
  const client = await db.pool.connect();
  let currentDiscount;
  try {
    await client.query('BEGIN');
    const currentDiscountResult = await client.query('SELECT * FROM discounts WHERE id = $1 FOR UPDATE', [discountId]);
    if (currentDiscountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(`Discount with ID ${discountId} not found.`);
    }
    currentDiscount = currentDiscountResult.rows[0];

    for (const field of updatableFields) {
      if (updateData.hasOwnProperty(field)) {
        // Specific validations before adding to clause
        if (field === 'value') {
          const typeToCheck = updateData.type || currentDiscount.type;
          if (typeToCheck === 'percentage' && (updateData.value < 0.01 || updateData.value > 100)) {
            await client.query('ROLLBACK');
            throw new BadRequestError('Percentage discount value must be between 0.01 and 100.');
          }
        }
        if (field === 'valid_until') {
          const vFrom = updateData.valid_from !== undefined ? new Date(updateData.valid_from) : (currentDiscount.valid_from ? new Date(currentDiscount.valid_from) : null);
          if (vFrom && updateData.valid_until && new Date(updateData.valid_until) < vFrom) {
            await client.query('ROLLBACK');
            throw new BadRequestError('valid_until must be after or the same as valid_from.');
          }
        }

        setClauses.push(`${field} = $${paramIndex++}`);
        // Handle boolean conversion for is_active if it's passed as string from some clients
        if (field === 'is_active' && typeof updateData[field] === 'string') {
            values.push(updateData[field].toLowerCase() === 'true');
        } else {
            values.push(updateData[field] === undefined ? null : updateData[field]);
        }
      }
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // Release lock
      return currentDiscount; // No actual updates, return current state
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(discountId); // For WHERE id = $N

    const updateQuery = `UPDATE discounts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK'); // Ensure rollback on any error
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      throw error;
    }
    console.error(`Error in discountService.updateDiscount for ID ${discountId}:`, error);
    throw new AppError(`Failed to update discount ID ${discountId}.`, 500, 'DISCOUNT_UPDATE_FAILED');
  } finally {
    client.release();
  }
}


/**
 * Deletes a discount by its ID.
 * @param {number} discountId - The ID of the discount to delete.
 * @returns {Promise<object>} The deleted discount object.
 * @throws {NotFoundError} If the discount is not found.
 * @throws {AppError} If database operation fails.
 */
async function deleteDiscount(discountId) {
  try {
    // TODO: Consider implications if discount is actively used in non-finalized carts or orders.
    // For now, direct delete. Add checks if business logic requires.
    const result = await db.query('DELETE FROM discounts WHERE id = $1 RETURNING *', [discountId]);
    if (result.rowCount === 0) {
      throw new NotFoundError(`Discount with ID ${discountId} not found.`);
    }
    return result.rows[0]; // Return the deleted discount data
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    console.error(`Error in discountService.deleteDiscount for ID ${discountId}:`, error);
    throw new AppError(`Failed to delete discount ID ${discountId}.`, 500, 'DISCOUNT_DELETE_FAILED');
  }
}

module.exports = {
  createDiscount,
  getAllDiscounts,
  getDiscountById,
  getDiscountByCode,
  updateDiscount,
  deleteDiscount,
  validateDiscountForCart,
};

/**
 * Validates a discount code against a cart subtotal and calculates its value.
 * @param {string} discountCode - The discount code to validate.
 * @param {number} cartSubtotal - The subtotal of the cart.
 * @returns {Promise<object>} An object with discount details and calculated amount.
 * @throws {NotFoundError} If the discount code is not found.
 * @throws {BadRequestError} If the discount is not applicable (e.g., expired, min amount not met).
 * @throws {AppError} For other database errors.
 */
async function validateDiscountForCart(discountCode, cartSubtotal) {
  if (!discountCode || typeof discountCode !== 'string' || discountCode.trim() === '') {
    throw new BadRequestError('Discount code is required.');
  }
  if (cartSubtotal === undefined || typeof cartSubtotal !== 'number' || cartSubtotal < 0) {
    throw new BadRequestError('Valid cart_subtotal is required.');
  }

  const codeToValidate = discountCode.trim().toUpperCase();
  const subtotal = parseFloat(cartSubtotal);

  try {
    // Fetch discount - no FOR UPDATE needed as this is a read-only validation.
    const discountResult = await db.query('SELECT * FROM discounts WHERE code = $1', [codeToValidate]);

    if (discountResult.rows.length === 0) {
      throw new NotFoundError('Invalid or unknown discount code.');
    }
    const discount = discountResult.rows[0];

    // Perform Validations
    if (!discount.is_active) {
      throw new BadRequestError('This discount code is no longer active.');
    }
    const currentDate = new Date();
    if (discount.valid_from && new Date(discount.valid_from) > currentDate) {
      throw new BadRequestError('This discount code is not yet valid.');
    }
    if (discount.valid_until && new Date(discount.valid_until) < currentDate) {
      throw new BadRequestError('This discount code has expired.');
    }
    if (discount.usage_limit !== null && discount.times_used >= discount.usage_limit) {
      throw new BadRequestError('This discount code has reached its usage limit.');
    }
    if (discount.min_order_amount !== null && subtotal < parseFloat(discount.min_order_amount)) {
      throw new BadRequestError(`Minimum order subtotal of $${parseFloat(discount.min_order_amount).toFixed(2)} not met for this discount.`);
    }

    // Calculate Discount Value
    let calculatedDiscountAmount = 0;
    if (discount.type === 'percentage') {
      calculatedDiscountAmount = subtotal * (parseFloat(discount.value) / 100.0);
    } else if (discount.type === 'fixed_amount') {
      calculatedDiscountAmount = parseFloat(discount.value);
    } else {
        // Should not happen if DB types are constrained
        throw new AppError(`Unknown discount type: ${discount.type}`, 500, 'UNKNOWN_DISCOUNT_TYPE');
    }

    calculatedDiscountAmount = Math.min(calculatedDiscountAmount, subtotal);
    calculatedDiscountAmount = parseFloat(calculatedDiscountAmount.toFixed(2));

    return {
      code: discount.code,
      type: discount.type,
      value: parseFloat(discount.value).toFixed(2), // Original value of the discount
      description: discount.description,
      calculated_discount_amount_for_cart: calculatedDiscountAmount,
      message: 'Discount code is valid.', // Can be enhanced in the route handler if needed
    };

  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof AppError) {
      throw error;
    }
    console.error(`Error in discountService.validateDiscountForCart for code ${discountCode}:`, error);
    throw new AppError('Failed to validate discount code due to a server error.', 500, 'DISCOUNT_VALIDATION_FAILED');
  }
}
