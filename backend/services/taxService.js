const db = require('../db'); // Assuming db.js is in the parent directory

/**
 * Calculates the price with applied taxes based on a tax class.
 *
 * @param {number|null|undefined} basePrice The base price of the item.
 * @param {number|null|undefined} taxClassId The ID of the tax class to apply.
 * @param {object|null} dbClientOptional Optional database client for use in transactions.
 * @returns {Promise<object>} An object containing:
 *    - basePrice: The original base price (formatted).
 *    - taxAmount: The total calculated tax amount (formatted).
 *    - priceWithTax: The base price plus total tax amount (formatted).
 *    - appliedRates: An array of objects detailing each applied tax rate
 *      (e.g., { name, rate_percentage, amount }).
 */
async function calculatePriceWithAppliedTaxes(basePrice, taxClassId, dbClientOptional) {
  const queryRunner = dbClientOptional || db;

  // Ensure basePrice is a number, default to 0 if null/undefined for calculation safety,
  // but return original if it was null/undefined for the basePrice field in response.
  const originalBasePrice = (basePrice === null || basePrice === undefined) ? null : parseFloat(basePrice);

  if (taxClassId === null || taxClassId === undefined || originalBasePrice === null) {
    const price = originalBasePrice !== null ? originalBasePrice.toFixed(2) : null;
    return {
      basePrice: price,
      taxAmount: (0.00).toFixed(2), // Ensure formatting for zero
      priceWithTax: price,
      appliedRates: [],
    };
  }

  const numericBasePrice = parseFloat(basePrice); // Ensure it's a number for calculations

  let taxRates = [];
  try {
    const sql = `
      SELECT tr.id, tr.name, tr.rate_percentage, tr.tax_type
      FROM tax_rates tr
      JOIN tax_class_rates tcr ON tr.id = tcr.tax_rate_id
      WHERE tcr.tax_class_id = $1 AND tr.is_active = TRUE
      ORDER BY tr.priority ASC, tr.id ASC;
    `;
    const result = await queryRunner.query(sql, [taxClassId]);
    taxRates = result.rows;
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    // Depending on desired behavior, you might throw the error or return with no tax
    throw error; // Or return structure with error indication
  }

  if (taxRates.length === 0) {
    return {
      basePrice: numericBasePrice.toFixed(2),
      taxAmount: (0.00).toFixed(2),
      priceWithTax: numericBasePrice.toFixed(2),
      appliedRates: [],
    };
  }

  let totalTaxAmount = 0;
  const appliedRatesDetailed = [];

  for (const rate of taxRates) {
    const ratePercentage = parseFloat(rate.rate_percentage);
    if (isNaN(ratePercentage)) {
        console.warn(`Invalid rate_percentage for tax rate ID ${rate.id}: ${rate.rate_percentage}`);
        continue; // Skip this tax rate
    }
    // The `ratePercentage` is already the decimal factor (e.g., 0.0825 for 8.25%)
    // as it's fetched directly from `rate.rate_percentage` which should be stored as such.
    // The seed script was updated to store it as a decimal (e.g., 8.25 / 100 = 0.0825).
    const currentRateTax = numericBasePrice * ratePercentage;
    totalTaxAmount += currentRateTax;
    appliedRatesDetailed.push({
      id: rate.id,
      name: rate.name,
      rate_percentage: ratePercentage, // This is the decimal factor, e.g., 0.0825
      amount: parseFloat(currentRateTax.toFixed(4)),
    });
  }

  const priceWithTax = numericBasePrice + totalTaxAmount;

  // Format final applied rates amounts to 2 decimal places for currency representation
  const formattedAppliedRates = appliedRatesDetailed.map(r => ({
      ...r,
      amount: r.amount.toFixed(2)
  }));


  return {
    basePrice: numericBasePrice.toFixed(2),
    taxAmount: parseFloat(totalTaxAmount.toFixed(2)),
    priceWithTax: parseFloat(priceWithTax.toFixed(2)),
    appliedRates: formattedAppliedRates,
  };
}

// New function to calculate taxes for an entire cart
async function calculateTaxForCartItems(cartItems, userId, addressForTaxCalculation, userIsTaxExempt, dbClientOptional) {
  const queryRunner = dbClientOptional || db;
  const line_items_with_tax_details = [];
  let overall_total_tax_amount = 0;
  const tax_summary_details = {}; // Example: { "CA Sales Tax": { total_taxable_amount: X, total_tax_collected: Y } }

  // userIsTaxExempt is now passed as a parameter.
  // The internal fetch for user's tax exemption status is removed as orders.js handles it.

  if (userIsTaxExempt) {
    console.log(`User ID ${userId} is tax exempt. Applying zero tax to cart items.`);
    // If user is exempt, all tax amounts are zero
    for (const item of cartItems) {
      line_items_with_tax_details.push({
        ...item, // Spread original item details like product_id, variant_id, quantity
        calculated_exclusive_unit_price: parseFloat(item.unit_price).toFixed(2), // Assuming unit_price is pre-tax
        line_item_tax_amount: 0,
        applied_tax_rate_percentage: 0,
        tax_class_id_at_purchase: null, // Tax class ID might still be relevant for records, even if no tax applied
        applied_rates: []
      });
    }
    return {
      line_items_with_tax_details,
      total_tax_amount: 0,
      tax_summary_details: { general_exemption: { total_taxable_amount: cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity),0), total_tax_collected: 0 } }
    };
  }

  for (const item of cartItems) {
    let productTaxClassId = null;
    try {
      // Fetch product's tax_class_id
      // Ensure product_id is used if variant_id is not present or if tax class is always on base product
      const productInfoQuery = await queryRunner.query(
        'SELECT tax_class_id FROM products WHERE id = $1',
        [item.product_id] // item.product_id should be the base product ID
      );
      if (productInfoQuery.rows.length > 0) {
        productTaxClassId = productInfoQuery.rows[0].tax_class_id;
      }
    } catch (productError) {
      console.error(`Error fetching tax_class_id for product ID ${item.product_id}:`, productError);
      // Continue, will result in no tax for this item if taxClassId remains null
    }

    // Assuming item.unit_price is the pre-tax price
    const basePriceForItem = parseFloat(item.unit_price);
    let itemTaxDetails;

    if (productTaxClassId) {
      // Call the existing function for individual item tax calculation
      // Note: calculatePriceWithAppliedTaxes expects basePrice for a single unit.
      // The total line item tax will be quantity * taxAmountPerUnit.
      const singleItemTaxCalc = await calculatePriceWithAppliedTaxes(basePriceForItem, productTaxClassId, queryRunner);
      itemTaxDetails = {
        calculated_exclusive_unit_price: parseFloat(singleItemTaxCalc.basePrice).toFixed(2),
        line_item_tax_amount: parseFloat(singleItemTaxCalc.taxAmount) * item.quantity,
        // For simplicity, let's find the primary rate or sum percentages if multiple apply.
        // This part needs refinement based on how applied_tax_rate_percentage should be stored.
        // For now, if multiple rates, we can sum them or pick the first one.
        // Or, store the full appliedRates array if the DB schema for order_items allows.
        applied_tax_rate_percentage: singleItemTaxCalc.appliedRates.length > 0
            ? singleItemTaxCalc.appliedRates.reduce((sum, rate) => sum + rate.rate_percentage, 0) // Example: sum of rates
            : 0,
        applied_rates_summary: singleItemTaxCalc.appliedRates, // Keep the detailed breakdown
        tax_class_id_at_purchase: productTaxClassId // Store the tax class ID used
      };
    } else {
      // No tax class ID found or applicable
      itemTaxDetails = {
        calculated_exclusive_unit_price: basePriceForItem.toFixed(2),
        line_item_tax_amount: 0,
        applied_tax_rate_percentage: 0,
        applied_rates_summary: [],
        tax_class_id_at_purchase: null
      };
    }

    line_items_with_tax_details.push({
      ...item, // Original item properties (product_id, variant_id, quantity, unit_price)
      ...itemTaxDetails
    });
    overall_total_tax_amount += itemTaxDetails.line_item_tax_amount;

    // Populate tax_summary_details
    itemTaxDetails.applied_rates_summary.forEach(rate => {
      if (rate && typeof rate.name === 'string' && rate.name.trim() !== '') {
        const rateNameKey = rate.name.trim();
        if (!tax_summary_details[rateNameKey]) {
          tax_summary_details[rateNameKey] = { total_taxable_amount: 0, total_tax_collected: 0, rate_percentage: rate.rate_percentage };
        }
        // Assuming basePriceForItem * item.quantity is the taxable amount for this rate component
        tax_summary_details[rateNameKey].total_taxable_amount += (basePriceForItem * item.quantity);
        tax_summary_details[rateNameKey].total_tax_collected += (parseFloat(rate.amount) * item.quantity);
      } else {
        console.warn('Skipping tax rate in summary due to missing or invalid name:', rate);
      }
    });
  }

  // Ensure totals are correctly formatted and round taxable amounts appropriately
  for (const key in tax_summary_details) {
      tax_summary_details[key].total_taxable_amount = parseFloat(tax_summary_details[key].total_taxable_amount.toFixed(2));
      tax_summary_details[key].total_tax_collected = parseFloat(tax_summary_details[key].total_tax_collected.toFixed(2));
  }


  return {
    line_items_with_tax_details,
    total_tax_amount: parseFloat(overall_total_tax_amount.toFixed(2)),
    tax_summary_details
  };
}


const { NotFoundError, ConflictError, BadRequestError, AppError } = require('../utils/AppError'); // Assuming AppError and others are in utils

// --- Tax Class CRUD ---

/**
 * Creates a new tax class.
 * @param {object} taxClassData - Contains name (string, required) and description (string, optional).
 * @returns {Promise<object>} The newly created tax class object.
 */
async function createTaxClass(taxClassData) {
  const { name, description } = taxClassData;
  if (!name || name.trim() === '') {
    throw new BadRequestError('Tax class name is required.');
  }

  try {
    const existingClass = await db.query('SELECT id FROM tax_classes WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (existingClass.rows.length > 0) {
      throw new ConflictError('A tax class with this name already exists.');
    }

    const result = await db.query(
      'INSERT INTO tax_classes (name, description, created_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [name.trim(), description || null]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      throw new ConflictError('A tax class with this name already exists (database constraint).');
    }
    if (error instanceof AppError) throw error;
    console.error('[taxService.createTaxClass] Error:', error);
    throw new AppError('Failed to create tax class.', 500, 'TAX_CLASS_CREATION_FAILED');
  }
}

/**
 * Retrieves a paginated list of all tax classes.
 * @param {object} paginationOptions - Contains page (number, default 1) and limit (number, default 10).
 * @returns {Promise<object>} An object containing data (array of tax classes) and pagination details.
 */
async function getAllTaxClasses(paginationOptions = {}) {
  const { page = 1, limit = 10 } = paginationOptions;
  const offset = (page - 1) * limit;

  try {
    const dataQuery = 'SELECT * FROM tax_classes ORDER BY name ASC LIMIT $1 OFFSET $2;';
    const dataResult = await db.query(dataQuery, [limit, offset]);

    const countQuery = 'SELECT COUNT(*) FROM tax_classes;';
    const countResult = await db.query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: dataResult.rows,
      pagination: {
        total: totalRecords,
        page: page,
        limit: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  } catch (error) {
    console.error('[taxService.getAllTaxClasses] Error:', error);
    throw new AppError('Failed to retrieve tax classes.', 500, 'TAX_CLASS_FETCH_ALL_FAILED');
  }
}

/**
 * Retrieves a specific tax class by its ID.
 * @param {number} taxClassId - The ID of the tax class.
 * @returns {Promise<object>} The tax class object.
 * @throws {NotFoundError} If not found.
 */
async function getTaxClassById(taxClassId) {
  try {
    const result = await db.query('SELECT * FROM tax_classes WHERE id = $1', [taxClassId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Tax class with ID ${taxClassId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[taxService.getTaxClassById] Error for ID ${taxClassId}:`, error);
    throw new AppError('Failed to retrieve tax class.', 500, 'TAX_CLASS_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates an existing tax class.
 * @param {number} taxClassId - The ID of the tax class to update.
 * @param {object} updateData - Contains name (string, optional) and/or description (string, optional).
 * @returns {Promise<object>} The updated tax class object.
 */
async function updateTaxClass(taxClassId, updateData) {
  const { name, description } = updateData;

  if (name === undefined && description === undefined) {
    throw new BadRequestError('No fields provided for update. Please provide name or description.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const currentClassResult = await client.query('SELECT name, description FROM tax_classes WHERE id = $1 FOR UPDATE', [taxClassId]);
    if (currentClassResult.rows.length === 0) {
      throw new NotFoundError(`Tax class with ID ${taxClassId} not found.`);
    }
    const currentClass = currentClassResult.rows[0];

    const updateFields = {};
    let needsUpdate = false;

    if (name !== undefined && name.trim() !== currentClass.name) {
      const trimmedName = name.trim();
      if (trimmedName === '') throw new BadRequestError('Tax class name cannot be empty if provided.');
      const existingClass = await client.query('SELECT id FROM tax_classes WHERE LOWER(name) = LOWER($1) AND id != $2', [trimmedName, taxClassId]);
      if (existingClass.rows.length > 0) {
        throw new ConflictError('Another tax class with this name already exists.');
      }
      updateFields.name = trimmedName;
      needsUpdate = true;
    }

    if (description !== undefined && description !== currentClass.description) {
      updateFields.description = description === null || description.trim() === '' ? null : description.trim();
      needsUpdate = true;
    }

    if (!needsUpdate && name === undefined && description === undefined) {
        // This case should be caught by the initial check, but as a safeguard:
        // if name or description were provided but identical to current, this path might be hit.
        // The route handler already checks if name and description are both undefined.
        // This ensures if they are provided but same as current, we don't proceed.
        return currentClass; // No actual change
    }

    if (Object.keys(updateFields).length === 0) {
        // All provided fields were identical to existing ones
        return currentClass; // No actual change needed
    }


    const setClauses = Object.keys(updateFields).map((key, i) => `${key} = $${i + 1}`);
    const values = Object.values(updateFields);
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const updateQuery = `UPDATE tax_classes SET ${setClauses.join(', ')} WHERE id = $${values.length + 1} RETURNING *;`;
    values.push(taxClassId);

    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new ConflictError('Another tax class with this name already exists (database constraint).');
    }
    if (error instanceof AppError) throw error;
    console.error(`[taxService.updateTaxClass] Error for ID ${taxClassId}:`, error);
    throw new AppError('Failed to update tax class.', 500, 'TAX_CLASS_UPDATE_FAILED');
  } finally {
    if(client) client.release();
  }
}

/**
 * Deletes a tax class.
 * @param {number} taxClassId - The ID of the tax class to delete.
 * @returns {Promise<object>} The data of the deleted tax class.
 */
async function deleteTaxClass(taxClassId) {
  try {
    // products.tax_class_id is ON DELETE SET NULL.
    // tax_class_rates.tax_class_id is ON DELETE CASCADE.
    const result = await db.query('DELETE FROM tax_classes WHERE id = $1 RETURNING *', [taxClassId]);
    if (result.rowCount === 0) {
      throw new NotFoundError(`Tax class with ID ${taxClassId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[taxService.deleteTaxClass] Error for ID ${taxClassId}:`, error);
    throw new AppError('Failed to delete tax class.', 500, 'TAX_CLASS_DELETE_FAILED');
  }
}

// --- Tax Class Rates Management ---

/**
 * Links a tax rate to a tax class.
 * @param {number} classId - The ID of the tax class.
 * @param {number} rateId - The ID of the tax rate.
 * @returns {Promise<object>} The new tax_class_rates record.
 */
async function linkRateToClass(classId, rateId) {
  try {
    const classCheck = await db.query('SELECT id FROM tax_classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      throw new NotFoundError(`Tax class with ID ${classId} not found.`);
    }
    const rateCheck = await db.query('SELECT id FROM tax_rates WHERE id = $1', [rateId]);
    if (rateCheck.rows.length === 0) {
      throw new BadRequestError(`Tax rate with ID ${rateId} not found.`);
    }

    const result = await db.query(
      'INSERT INTO tax_class_rates (tax_class_id, tax_rate_id) VALUES ($1, $2) RETURNING *',
      [classId, rateId]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      throw new ConflictError('This tax rate is already linked to this tax class.');
    }
    if (error instanceof AppError) throw error;
    console.error(`[taxService.linkRateToClass] Error linking rate ${rateId} to class ${classId}:`, error);
    throw new AppError('Failed to link tax rate to class.', 500, 'TAX_CLASS_RATE_LINK_FAILED');
  }
}

/**
 * Lists all tax rates linked to a specific tax class.
 * @param {number} classId - The ID of the tax class.
 * @returns {Promise<Array<object>>} An array of tax rate objects.
 */
async function getRatesForClass(classId) {
  try {
    const classCheck = await db.query('SELECT id FROM tax_classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      throw new NotFoundError(`Tax class with ID ${classId} not found.`);
    }

    const result = await db.query(
      `SELECT tr.*
       FROM tax_rates tr
       JOIN tax_class_rates tcr ON tr.id = tcr.tax_rate_id
       WHERE tcr.tax_class_id = $1
       ORDER BY tr.name ASC;`,
      [classId]
    );
    return result.rows;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[taxService.getRatesForClass] Error for class ID ${classId}:`, error);
    throw new AppError('Failed to retrieve rates for tax class.', 500, 'TAX_CLASS_RATES_FETCH_FAILED');
  }
}

/**
 * Unlinks a tax rate from a tax class.
 * @param {number} classId - The ID of the tax class.
 * @param {number} rateId - The ID of the tax rate.
 * @returns {Promise<object>} Data of the unlinked relation.
 */
async function unlinkRateFromClass(classId, rateId) {
  try {
    const result = await db.query(
      'DELETE FROM tax_class_rates WHERE tax_class_id = $1 AND tax_rate_id = $2 RETURNING *',
      [classId, rateId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError(`Link between tax class ID ${classId} and tax rate ID ${rateId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[taxService.unlinkRateFromClass] Error unlinking rate ${rateId} from class ${classId}:`, error);
    throw new AppError('Failed to unlink tax rate from class.', 500, 'TAX_CLASS_RATE_UNLINK_FAILED');
  }
}


module.exports = {
  calculatePriceWithAppliedTaxes,
  calculateTaxForCartItems, // Export the new function

  // Tax Class CRUD
  createTaxClass,
  getAllTaxClasses,
  getTaxClassById,
  updateTaxClass,
  deleteTaxClass,

  // Tax Class Rates Management
  linkRateToClass,
  getRatesForClass,
  unlinkRateFromClass,

  // Tax Rate CRUD
  createTaxRate,
  getAllTaxRates,
  getTaxRateById,
  updateTaxRate,
  deleteTaxRate,
};

// --- Tax Rate CRUD ---

/**
 * Creates a new tax rate.
 * @param {object} taxRateData - Contains name, rate_percentage, jurisdiction, tax_type, etc.
 * @returns {Promise<object>} The newly created tax rate object.
 */
async function createTaxRate(taxRateData) {
  const {
    name, rate_percentage, jurisdiction, tax_type, tax_code,
    is_active, valid_from, valid_until
  } = taxRateData;

  // Validations from route handler
  if (!name || name.trim() === '') throw new BadRequestError('Tax rate name is required.');
  if (name.trim().length < 2 || name.trim().length > 255) throw new BadRequestError('Name must be between 2 and 255 characters.');
  if (rate_percentage === undefined || isNaN(parseFloat(rate_percentage))) throw new BadRequestError('Rate percentage is required and must be a number.');
  const numRatePercentage = parseFloat(rate_percentage);
  if (numRatePercentage < 0 || numRatePercentage > 1) throw new BadRequestError('Rate percentage must be a decimal between 0.0000 and 1.0000.');
  if (!jurisdiction || jurisdiction.trim() === '') throw new BadRequestError('Jurisdiction is required.');
  if (!tax_type || tax_type.trim() === '') throw new BadRequestError('Tax type is required.');

  const finalValidFrom = valid_from ? new Date(valid_from) : null;
  const finalValidUntil = valid_until ? new Date(valid_until) : null;

  if (finalValidFrom && finalValidUntil && finalValidUntil < finalValidFrom) {
    throw new BadRequestError('Valid until date cannot be before valid from date.');
  }

  try {
    const existingRate = await db.query('SELECT id FROM tax_rates WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (existingRate.rows.length > 0) {
      throw new ConflictError('A tax rate with this name already exists.');
    }

    const result = await db.query(
      `INSERT INTO tax_rates (name, rate_percentage, jurisdiction, tax_type, tax_code, is_active, valid_from, valid_until, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        name.trim(), numRatePercentage, jurisdiction.trim(), tax_type.trim(), tax_code || null,
        is_active === undefined ? true : is_active,
        finalValidFrom,
        finalValidUntil
      ]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // Unique violation on name (DB constraint)
      throw new ConflictError('A tax rate with this name already exists (database constraint).');
    }
    if (error instanceof AppError) throw error;
    console.error('[taxService.createTaxRate] Error:', error);
    throw new AppError('Failed to create tax rate.', 500, 'TAX_RATE_CREATION_FAILED');
  }
}

/**
 * Retrieves a paginated and filtered list of all tax rates.
 * @param {object} filterOptions - Contains is_active, tax_type, jurisdiction.
 * @param {object} paginationOptions - Contains page and limit.
 * @returns {Promise<object>} An object containing data (array of tax rates) and pagination details.
 */
async function getAllTaxRates(filterOptions = {}, paginationOptions = {}) {
  const { is_active, tax_type, jurisdiction } = filterOptions;
  let { page = 1, limit = 10 } = paginationOptions;

  page = parseInt(page, 10);
  if (isNaN(page) || page < 1) page = 1;
  limit = parseInt(limit, 10);
  if (isNaN(limit) || limit < 1) limit = 10;
  limit = Math.min(limit, 1000); // Max limit

  const offset = (page - 1) * limit;

  const queryParams = [];
  const whereClauses = [];
  let paramIndex = 1;

  if (is_active !== undefined) {
    whereClauses.push(`is_active = $${paramIndex++}`);
    queryParams.push(is_active);
  }
  if (tax_type) {
    whereClauses.push(`LOWER(tax_type) = LOWER($${paramIndex++})`);
    queryParams.push(tax_type);
  }
  if (jurisdiction) {
    whereClauses.push(`LOWER(jurisdiction) = LOWER($${paramIndex++})`);
    queryParams.push(jurisdiction);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const dataQuery = `
      SELECT id, name, rate_percentage, jurisdiction, tax_type, tax_code,
             is_active, priority, valid_from, valid_until, created_at, updated_at
      FROM tax_rates
      ${whereString}
      ORDER BY name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const dataParams = [...queryParams, limit, offset];
    const dataResult = await db.query(dataQuery, dataParams);

    const countQuery = `SELECT COUNT(*) FROM tax_rates ${whereString};`;
    const countParams = queryParams.slice(0, paramIndex - 2); // Only filter params
    const countResult = await db.query(countQuery, countParams);

    const totalRecords = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: dataResult.rows,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        filters: {
          is_active: is_active !== undefined ? is_active : null,
          tax_type: tax_type || null,
          jurisdiction: jurisdiction || null
        }
      }
    };
  } catch (error) {
    console.error('[taxService.getAllTaxRates] Error:', error);
    throw new AppError('Failed to retrieve tax rates.', 500, 'TAX_RATE_FETCH_ALL_FAILED');
  }
}

/**
 * Retrieves a specific tax rate by its ID.
 * @param {number} taxRateId - The ID of the tax rate.
 * @returns {Promise<object>} The tax rate object.
 */
async function getTaxRateById(taxRateId) {
  try {
    const result = await db.query('SELECT * FROM tax_rates WHERE id = $1', [taxRateId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Tax rate with ID ${taxRateId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[taxService.getTaxRateById] Error for ID ${taxRateId}:`, error);
    throw new AppError('Failed to retrieve tax rate.', 500, 'TAX_RATE_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates an existing tax rate.
 * @param {number} taxRateId - The ID of the tax rate to update.
 * @param {object} updateData - Object containing fields to update.
 * @returns {Promise<object>} The updated tax rate object.
 */
async function updateTaxRate(taxRateId, updateData) {
  const updatableFields = ['name', 'rate_percentage', 'jurisdiction', 'tax_type', 'tax_code', 'is_active', 'valid_from', 'valid_until'];
  const hasUpdates = updatableFields.some(field => updateData[field] !== undefined);
  if (!hasUpdates) {
    throw new BadRequestError('No fields provided for update.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const currentRateResult = await client.query('SELECT * FROM tax_rates WHERE id = $1 FOR UPDATE', [taxRateId]);
    if (currentRateResult.rows.length === 0) {
      throw new NotFoundError(`Tax rate with ID ${taxRateId} not found.`);
    }
    const currentRate = currentRateResult.rows[0];

    const finalUpdateData = { ...updateData }; // Clone to avoid mutating original

    // Validate and prepare fields
    if (finalUpdateData.name !== undefined) finalUpdateData.name = finalUpdateData.name.trim();
    if (finalUpdateData.rate_percentage !== undefined) {
      finalUpdateData.rate_percentage = parseFloat(finalUpdateData.rate_percentage);
      if (isNaN(finalUpdateData.rate_percentage) || finalUpdateData.rate_percentage < 0 || finalUpdateData.rate_percentage > 1) {
        throw new BadRequestError('Rate percentage must be a decimal between 0.0000 and 1.0000.');
      }
    }
    if (finalUpdateData.jurisdiction !== undefined) finalUpdateData.jurisdiction = finalUpdateData.jurisdiction.trim();
    if (finalUpdateData.tax_type !== undefined) finalUpdateData.tax_type = finalUpdateData.tax_type.trim();
    if (finalUpdateData.tax_code !== undefined && finalUpdateData.tax_code !== null) finalUpdateData.tax_code = finalUpdateData.tax_code.trim();


    let finalValidFrom = finalUpdateData.valid_from !== undefined ? (finalUpdateData.valid_from ? new Date(finalUpdateData.valid_from) : null) : (currentRate.valid_from ? new Date(currentRate.valid_from) : null);
    let finalValidUntil = finalUpdateData.valid_until !== undefined ? (finalUpdateData.valid_until ? new Date(finalUpdateData.valid_until) : null) : (currentRate.valid_until ? new Date(currentRate.valid_until) : null);

    // Store effective dates back into finalUpdateData for SET clause construction
    if (finalUpdateData.valid_from !== undefined) finalUpdateData.valid_from = finalValidFrom;
    if (finalUpdateData.valid_until !== undefined) finalUpdateData.valid_until = finalValidUntil;


    if (finalValidFrom && finalValidUntil && finalValidUntil < finalValidFrom) {
      throw new BadRequestError('Valid until date cannot be before valid from date.');
    }

    if (finalUpdateData.name && finalUpdateData.name !== currentRate.name) {
      const existingRate = await client.query('SELECT id FROM tax_rates WHERE LOWER(name) = LOWER($1) AND id != $2', [finalUpdateData.name, taxRateId]);
      if (existingRate.rows.length > 0) {
        throw new ConflictError('Another tax rate with this name already exists.');
      }
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    updatableFields.forEach(field => {
      if (finalUpdateData[field] !== undefined) {
        // Check if the new value is actually different from the current one
        // For dates, compare Date objects if they are not null
        let currentValue = currentRate[field];
        let newValue = finalUpdateData[field];

        if ((field === 'valid_from' || field === 'valid_until')) {
             currentValue = currentValue ? new Date(currentValue).toISOString() : null;
             newValue = newValue ? new Date(newValue).toISOString() : null;
        }

        if (newValue !== currentValue) {
            setClauses.push(`${field} = $${paramIndex++}`);
            values.push(finalUpdateData[field] === '' && (field === 'tax_code') ? null : finalUpdateData[field]);
        }
      }
    });

    if (setClauses.length === 0) {
      await client.query('ROLLBACK'); // Release lock
      return currentRate; // No actual changes to apply
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(taxRateId);

    const updateQuery = `UPDATE tax_rates SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
    const result = await client.query(updateQuery, values);
    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    if(client) await client.query('ROLLBACK');
    if (error.code === '23505' && error.constraint && error.constraint.includes('name')) { // More specific check for name constraint
      throw new ConflictError('Another tax rate with this name already exists (database constraint).');
    }
    if (error instanceof AppError) throw error;
    console.error(`[taxService.updateTaxRate] Error for ID ${taxRateId}:`, error);
    throw new AppError('Failed to update tax rate.', 500, 'TAX_RATE_UPDATE_FAILED');
  } finally {
    if(client) client.release();
  }
}

/**
 * Deletes a tax rate.
 * @param {number} taxRateId - The ID of the tax rate to delete.
 * @returns {Promise<object>} The data of the deleted tax rate.
 */
async function deleteTaxRate(taxRateId) {
  try {
    // tax_class_rates.tax_rate_id is ON DELETE CASCADE
    const result = await db.query('DELETE FROM tax_rates WHERE id = $1 RETURNING *', [taxRateId]);
    if (result.rowCount === 0) {
      throw new NotFoundError(`Tax rate with ID ${taxRateId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(`[taxService.deleteTaxRate] Error for ID ${taxRateId}:`, error);
    throw new AppError('Failed to delete tax rate.', 500, 'TAX_RATE_DELETE_FAILED');
  }
}
