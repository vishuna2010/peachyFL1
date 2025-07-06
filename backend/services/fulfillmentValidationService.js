const db = require('../db');
const crypto = require('crypto');
const { NotFoundError, BadRequestError, AppError } = require('../utils/AppError');
const config = require('../config');

/**
 * Generates a unique fulfillment validation code for an order
 * @param {number} orderId - The order ID
 * @returns {string} A unique validation code
 */
function generateFulfillmentValidationCode(orderId) {
  // Create a deterministic but unique code based on order ID and timestamp
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
  const hash = crypto.createHash('sha256')
    .update(`${orderId}-${timestamp}-${config.FULFILLMENT_VALIDATION_SECRET || 'default-secret'}`)
    .digest('hex');
  
  // Take first 8 characters and convert to uppercase alphanumeric
  return hash.substring(0, 8).toUpperCase();
}

/**
 * Generates a QR code URL for fulfillment validation
 * @param {string} validationCode - The fulfillment validation code
 * @returns {string} The QR code URL
 */
function generateFulfillmentValidationQRUrl(validationCode) {
  const baseUrl = config.frontendUrlBase || 'http://localhost:3001';
  return `${baseUrl}/api/fulfillment/validate/${validationCode}`;
}

/**
 * Assigns a fulfillment validation code to an order
 * @param {number} orderId - The order ID
 * @returns {Promise<object>} The order with validation code
 */
async function assignFulfillmentValidationCode(orderId) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if order exists and doesn't already have a validation code
    const orderCheck = await client.query(
      'SELECT id, fulfillment_validation_code FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderCheck.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found.`);
    }
    
    if (orderCheck.rows[0].fulfillment_validation_code) {
      throw new BadRequestError(`Order ${orderId} already has a fulfillment validation code.`);
    }
    
    // Generate unique validation code
    let validationCode;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      validationCode = generateFulfillmentValidationCode(orderId);
      const existingCode = await client.query(
        'SELECT id FROM orders WHERE fulfillment_validation_code = $1',
        [validationCode]
      );
      
      if (existingCode.rows.length === 0) {
        break;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        throw new AppError('Failed to generate unique fulfillment validation code after multiple attempts.', 500);
      }
    } while (true);
    
    // Update order with validation code
    const updateResult = await client.query(
      'UPDATE orders SET fulfillment_validation_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [validationCode, orderId]
    );
    
    await client.query('COMMIT');
    
    return {
      order_id: updateResult.rows[0].id,
      validation_code: validationCode,
      qr_url: generateFulfillmentValidationQRUrl(validationCode)
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Validates a fulfillment code and marks the order as validated
 * @param {string} validationCode - The fulfillment validation code
 * @param {number} validatedByUserId - The user ID performing the validation
 * @param {string} validationMethod - The method used for validation (qr_scan, manual, etc.)
 * @param {string} notes - Optional notes about the validation
 * @returns {Promise<object>} The validation result
 */
async function validateFulfillment(validationCode, validatedByUserId, validationMethod = 'qr_scan', notes = null) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find order by validation code
    const orderResult = await client.query(
      `SELECT o.id, o.status, o.fulfillment_validated_at, o.fulfillment_validated_by_user_id,
              u.name as validated_by_name
       FROM orders o
       LEFT JOIN users u ON o.fulfillment_validated_by_user_id = u.id
       WHERE o.fulfillment_validation_code = $1`,
      [validationCode]
    );
    
    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`No order found with validation code: ${validationCode}`);
    }
    
    const order = orderResult.rows[0];
    
    // Check if already validated
    if (order.fulfillment_validated_at) {
      throw new BadRequestError(`Order ${order.id} has already been validated for fulfillment.`);
    }
    
    // Check if order is in a valid status for fulfillment
    if (!['pending', 'processing'].includes(order.status.toLowerCase())) {
      throw new BadRequestError(`Order ${order.id} is in status '${order.status}' and cannot be validated for fulfillment.`);
    }
    
    // Update order as validated
    await client.query(
      `UPDATE orders 
       SET fulfillment_validated_at = CURRENT_TIMESTAMP,
           fulfillment_validated_by_user_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [validatedByUserId, order.id]
    );
    
    // Log the validation
    await client.query(
      `INSERT INTO fulfillment_validation_logs 
       (order_id, validation_code, validated_by_user_id, validation_method, validation_status, validation_notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [order.id, validationCode, validatedByUserId, validationMethod, 'success', notes]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      order_id: order.id,
      validation_code: validationCode,
      validated_at: new Date().toISOString(),
      validated_by_user_id: validatedByUserId,
      message: `Order ${order.id} has been successfully validated for fulfillment.`
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets fulfillment validation details for an order
 * @param {number} orderId - The order ID
 * @returns {Promise<object>} The fulfillment validation details
 */
async function getFulfillmentValidationDetails(orderId) {
  try {
    const orderResult = await db.query(
      `SELECT o.id, o.fulfillment_validation_code, o.fulfillment_validated_at,
              o.fulfillment_validated_by_user_id, o.status,
              u.name as validated_by_name, u.email as validated_by_email
       FROM orders o
       LEFT JOIN users u ON o.fulfillment_validated_by_user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found.`);
    }
    
    const order = orderResult.rows[0];
    
    // Get validation logs
    const logsResult = await db.query(
      `SELECT fvl.*, u.name as validated_by_name
       FROM fulfillment_validation_logs fvl
       LEFT JOIN users u ON fvl.validated_by_user_id = u.id
       WHERE fvl.order_id = $1
       ORDER BY fvl.scanned_at DESC`,
      [orderId]
    );
    
    return {
      order_id: order.id,
      validation_code: order.fulfillment_validation_code,
      qr_url: order.fulfillment_validation_code ? generateFulfillmentValidationQRUrl(order.fulfillment_validation_code) : null,
      validated_at: order.fulfillment_validated_at,
      validated_by_user_id: order.fulfillment_validated_by_user_id,
      validated_by_name: order.validated_by_name,
      validated_by_email: order.validated_by_email,
      order_status: order.status,
      validation_logs: logsResult.rows
    };
    
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError(`Failed to retrieve fulfillment validation details for order ${orderId}.`, 500);
  }
}

/**
 * Gets all fulfillment validation logs with pagination
 * @param {object} options - Pagination options
 * @returns {Promise<object>} Paginated validation logs
 */
async function getFulfillmentValidationLogs(options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  
  try {
    const countQuery = 'SELECT COUNT(*) FROM fulfillment_validation_logs';
    const logsQuery = `
      SELECT fvl.*, o.id as order_id, u.name as validated_by_name, u.email as validated_by_email
      FROM fulfillment_validation_logs fvl
      JOIN orders o ON fvl.order_id = o.id
      LEFT JOIN users u ON fvl.validated_by_user_id = u.id
      ORDER BY fvl.scanned_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const totalResult = await db.query(countQuery);
    const logsResult = await db.query(logsQuery, [limit, offset]);
    
    return {
      data: logsResult.rows,
      pagination: {
        total: parseInt(totalResult.rows[0].count),
        page,
        limit,
        totalPages: Math.ceil(parseInt(totalResult.rows[0].count) / limit)
      }
    };
    
  } catch (error) {
    throw new AppError('Failed to retrieve fulfillment validation logs.', 500);
  }
}

/**
 * Get recent fulfillment validations
 * @param {number} limit - Number of recent validations to return
 * @returns {Promise<Array>} Array of recent validation records
 */
async function getRecentValidations(limit = 10) {
  try {
    const query = `
      SELECT 
        fvl.id,
        fvl.order_id,
        fvl.validation_code,
        fvl.scanned_at as validated_at,
        fvl.validation_method,
        fvl.validation_notes as notes,
        u.name as validated_by_name
      FROM fulfillment_validation_logs fvl
      LEFT JOIN users u ON fvl.validated_by_user_id = u.id
      WHERE fvl.validation_status = 'success'
      ORDER BY fvl.scanned_at DESC
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
    return result.rows;
    
  } catch (error) {
    throw new AppError('Failed to retrieve recent validations.', 500);
  }
}

module.exports = {
  generateFulfillmentValidationCode,
  generateFulfillmentValidationQRUrl,
  assignFulfillmentValidationCode,
  validateFulfillment,
  getFulfillmentValidationDetails,
  getFulfillmentValidationLogs,
  getRecentValidations
}; 