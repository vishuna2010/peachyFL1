// backend/utils/securityUtils.js
const crypto = require('crypto');
const config = require('../config');

/**
 * Generates a deterministic HMAC SHA256 token for delivery confirmation.
 * @param {string|number} orderId - The ID of the order.
 * @returns {string} The generated HMAC token.
 */
function generateDeliveryConfirmationToken(orderId) {
  if (!orderId) {
    throw new Error('Order ID is required to generate a delivery confirmation token.');
  }
  const secret = config.deliveryConfirmationSecret;
  if (!secret) {
    throw new Error('DELIVERY_CONFIRMATION_SECRET is not configured.');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(orderId)); // Ensure orderId is treated as a string
  return hmac.digest('hex');
}

/**
 * Validates a provided token against a freshly generated one for a given orderId.
 * @param {string|number} orderId - The ID of the order.
 * @param {string} providedToken - The token received from the client.
 * @returns {boolean} True if the token is valid, false otherwise.
 */
function validateDeliveryConfirmationToken(orderId, providedToken) {
  if (!orderId || !providedToken) {
    return false;
  }
  try {
    const expectedToken = generateDeliveryConfirmationToken(orderId);
    // Use crypto.timingSafeEqual for comparing tokens to prevent timing attacks
    if (expectedToken.length !== providedToken.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expectedToken, 'hex'), Buffer.from(providedToken, 'hex'));
  } catch (error) {
    console.error('Error validating delivery confirmation token:', error);
    return false;
  }
}

module.exports = {
  generateDeliveryConfirmationToken,
  validateDeliveryConfirmationToken,
};
