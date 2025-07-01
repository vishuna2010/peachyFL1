const db = require('../db');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/AppError');

// === Product Options (Global Types like "Color", "Size") ===

/**
 * Creates a new global product option type.
 * @param {string} name - The name of the option type.
 * @returns {Promise<object>} The created option type object.
 * @throws {ConflictError} If an option type with the same name already exists.
 * @throws {AppError} For other database errors.
 */
async function createOptionType(name) {
  try {
    const result = await db.query(
      'INSERT INTO product_options (name) VALUES ($1) RETURNING *',
      [name]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'product_options_name_key') {
      throw new ConflictError(`An option type with the name "${name}" already exists.`);
    }
    console.error('Error in optionService.createOptionType:', error);
    throw new AppError('Failed to create option type.', 500, 'OPTION_TYPE_CREATION_FAILED');
  }
}

/**
 * Lists all global product option types.
 * @returns {Promise<Array<object>>} An array of option type objects.
 * @throws {AppError} For database errors.
 */
async function getAllOptionTypes() {
  try {
    const result = await db.query('SELECT * FROM product_options ORDER BY name ASC');
    return result.rows;
  } catch (error) {
    console.error('Error in optionService.getAllOptionTypes:', error);
    throw new AppError('Failed to retrieve option types.', 500, 'OPTION_TYPES_FETCH_FAILED');
  }
}

/**
 * Gets a specific global product option type by ID.
 * @param {number} optionId - The ID of the option type.
 * @returns {Promise<object>} The option type object.
 * @throws {NotFoundError} If the option type is not found.
 * @throws {AppError} For other database errors.
 */
async function getOptionTypeById(optionId) {
  try {
    const result = await db.query('SELECT * FROM product_options WHERE id = $1', [optionId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Option type with ID ${optionId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Error in optionService.getOptionTypeById:', error);
    throw new AppError('Failed to retrieve option type by ID.', 500, 'OPTION_TYPE_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates a global product option type's name.
 * @param {number} optionId - The ID of the option type to update.
 * @param {string} name - The new name for the option type.
 * @returns {Promise<object>} The updated option type object.
 * @throws {NotFoundError} If the option type is not found.
 * @throws {ConflictError} If another option type with the new name already exists.
 * @throws {AppError} For other database errors.
 */
async function updateOptionType(optionId, name) {
  try {
    const result = await db.query(
      'UPDATE product_options SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [name, optionId]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Option type with ID ${optionId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error.code === '23505' && error.constraint === 'product_options_name_key') {
      throw new ConflictError(`An option type with the name "${name}" already exists.`);
    }
    console.error('Error in optionService.updateOptionType:', error);
    throw new AppError('Failed to update option type.', 500, 'OPTION_TYPE_UPDATE_FAILED');
  }
}

/**
 * Deletes a global product option type.
 * Checks if the option type has associated values before deletion.
 * @param {number} optionId - The ID of the option type to delete.
 * @returns {Promise<object>} The deleted option type object.
 * @throws {NotFoundError} If the option type is not found.
 * @throws {BadRequestError} If the option type has associated values.
 * @throws {AppError} For other database errors.
 */
async function deleteOptionType(optionId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const optionType = await client.query('SELECT * FROM product_options WHERE id = $1 FOR UPDATE', [optionId]);
    if (optionType.rows.length === 0) {
      throw new NotFoundError(`Option type with ID ${optionId} not found.`);
    }

    const valueCountResult = await client.query('SELECT COUNT(*) FROM product_option_values WHERE product_option_id = $1', [optionId]);
    const valueCount = parseInt(valueCountResult.rows[0].count, 10);
    if (valueCount > 0) {
      throw new BadRequestError(`Option type has ${valueCount} associated value(s). Please delete them first or reassign.`);
    }

    const result = await client.query('DELETE FROM product_options WHERE id = $1 RETURNING *', [optionId]);
    await client.query('COMMIT');
    return result.rows[0]; // Return the deleted option type
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    console.error('Error in optionService.deleteOptionType:', error);
    throw new AppError('Failed to delete option type.', 500, 'OPTION_TYPE_DELETE_FAILED');
  } finally {
    client.release();
  }
}


// === Product Option Values (Values like "Red", "Small" for a given Option Type) ===

/**
 * Creates a new value for a specific global option type.
 * @param {number} optionId - The ID of the parent option type.
 * @param {string} value - The value string (e.g., "Red", "Small").
 * @returns {Promise<object>} The created option value object.
 * @throws {NotFoundError} If the parent option type is not found.
 * @throws {ConflictError} If the value already exists for this option type.
 * @throws {AppError} For other database errors.
 */
async function createOptionValue(optionId, value) {
  try {
    const optionType = await db.query('SELECT id FROM product_options WHERE id = $1', [optionId]);
    if (optionType.rows.length === 0) {
      throw new NotFoundError(`Option type with ID ${optionId} not found, cannot add value.`);
    }
    const result = await db.query(
      'INSERT INTO product_option_values (product_option_id, value) VALUES ($1, $2) RETURNING *',
      [optionId, value]
    );
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error.code === '23505' && error.constraint === 'uk_option_value') { // Assuming 'uk_option_value' is the constraint name for UNIQUE (product_option_id, value)
      throw new ConflictError(`The value "${value}" already exists for this option type.`);
    }
    console.error('Error in optionService.createOptionValue:', error);
    throw new AppError('Failed to create option value.', 500, 'OPTION_VALUE_CREATION_FAILED');
  }
}

/**
 * Lists all global values for a specific option type.
 * @param {number} optionId - The ID of the option type.
 * @returns {Promise<Array<object>>} An array of option value objects.
 * @throws {NotFoundError} If the option type is not found.
 * @throws {AppError} For other database errors.
 */
async function getAllOptionValuesForType(optionId) {
  try {
    const optionType = await db.query('SELECT id FROM product_options WHERE id = $1', [optionId]);
    if (optionType.rows.length === 0) {
      throw new NotFoundError(`Option type with ID ${optionId} not found.`);
    }
    const result = await db.query('SELECT * FROM product_option_values WHERE product_option_id = $1 ORDER BY value ASC', [optionId]);
    return result.rows;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Error in optionService.getAllOptionValuesForType:', error);
    throw new AppError('Failed to retrieve option values for type.', 500, 'OPTION_VALUES_FETCH_FAILED');
  }
}

/**
 * Gets a specific global option value by its ID.
 * @param {number} valueId - The ID of the option value.
 * @returns {Promise<object>} The option value object.
 * @throws {NotFoundError} If the option value is not found.
 * @throws {AppError} For other database errors.
 */
async function getOptionValueById(valueId) {
  try {
    const result = await db.query('SELECT * FROM product_option_values WHERE id = $1', [valueId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Option value with ID ${valueId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Error in optionService.getOptionValueById:', error);
    throw new AppError('Failed to retrieve option value by ID.', 500, 'OPTION_VALUE_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates a global option value.
 * @param {number} valueId - The ID of the option value to update.
 * @param {string} value - The new value string.
 * @returns {Promise<object>} The updated option value object.
 * @throws {NotFoundError} If the option value is not found.
 * @throws {ConflictError} If the new value already exists for the parent option type.
 * @throws {AppError} For other database errors.
 */
async function updateOptionValue(valueId, newValue) {
  try {
    // Need to check conflict against existing (product_option_id, value)
    const currentValueData = await db.query('SELECT product_option_id FROM product_option_values WHERE id = $1', [valueId]);
    if (currentValueData.rows.length === 0) {
      throw new NotFoundError(`Option value with ID ${valueId} not found.`);
    }
    // product_option_id is not changed here, only the value string.
    const result = await db.query(
      'UPDATE product_option_values SET value = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newValue, valueId]
    );
    return result.rows[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error.code === '23505' && error.constraint === 'uk_option_value') {
      throw new ConflictError(`The value "${newValue}" already exists for the parent option type.`);
    }
    console.error('Error in optionService.updateOptionValue:', error);
    throw new AppError('Failed to update option value.', 500, 'OPTION_VALUE_UPDATE_FAILED');
  }
}

/**
 * Deletes a specific global option value.
 * Checks if the value is in use by product variants before deletion.
 * @param {number} valueId - The ID of the option value to delete.
 * @returns {Promise<object>} The deleted option value object.
 * @throws {NotFoundError} If the option value is not found.
 * @throws {BadRequestError} If the option value is in use.
 * @throws {AppError} For other database errors.
 */
async function deleteOptionValue(valueId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const valueData = await client.query('SELECT * FROM product_option_values WHERE id = $1 FOR UPDATE', [valueId]);
    if (valueData.rows.length === 0) {
      throw new NotFoundError(`Option value with ID ${valueId} not found.`);
    }

    const usageResult = await client.query('SELECT COUNT(*) FROM product_variant_option_values WHERE product_option_value_id = $1', [valueId]);
    const usageCount = parseInt(usageResult.rows[0].count, 10);
    if (usageCount > 0) {
      throw new BadRequestError(`Option value is in use by ${usageCount} product variant(s) and cannot be deleted.`);
    }
    // Also check if it's used in product_assigned_option_specific_values
    const assignedUsageResult = await client.query('SELECT COUNT(*) FROM product_assigned_option_specific_values WHERE product_option_value_id = $1', [valueId]);
    const assignedUsageCount = parseInt(assignedUsageResult.rows[0].count, 10);
    if (assignedUsageCount > 0) {
        throw new BadRequestError(`Option value is assigned to ${assignedUsageCount} product option configuration(s) and cannot be deleted directly. Please remove assignments first.`);
    }


    const result = await client.query('DELETE FROM product_option_values WHERE id = $1 RETURNING *', [valueId]);
    await client.query('COMMIT');
    return result.rows[0]; // Return the deleted value
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    console.error('Error in optionService.deleteOptionValue:', error);
    throw new AppError('Failed to delete option value.', 500, 'OPTION_VALUE_DELETE_FAILED');
  } finally {
    client.release();
  }
}


module.exports = {
  createOptionType,
  getAllOptionTypes,
  getOptionTypeById,
  updateOptionType,
  deleteOptionType,
  createOptionValue,
  getAllOptionValuesForType,
  getOptionValueById,
  updateOptionValue,
  deleteOptionValue,
};
