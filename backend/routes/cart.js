const express = require('express');
const router = express.Router();
const db = require('../db');

const ALLOWED_DISCOUNT_TYPES = ['percentage', 'fixed_amount']; // Could be shared from a constants file

// POST /api/cart/validate-discount - Validate a discount code against a cart subtotal
router.post('/validate-discount', async (req, res) => {
  const { discount_code, cart_subtotal } = req.body;

  // --- 1. Validate input ---
  if (!discount_code || typeof discount_code !== 'string' || discount_code.trim() === '') {
    return res.status(400).json({ message: 'Discount code is required.' });
  }
  if (cart_subtotal === undefined || typeof cart_subtotal !== 'number' || cart_subtotal < 0) {
    return res.status(400).json({ message: 'Valid cart_subtotal is required.' });
  }

  const codeToValidate = discount_code.trim().toUpperCase();
  const subtotal = parseFloat(cart_subtotal);

  try {
    // --- 2. Fetch Discount ---
    // No "FOR UPDATE" here as this is a read-only validation, not an application that changes state.
    const discountResult = await db.query('SELECT * FROM discounts WHERE code = $1', [codeToValidate]);

    if (discountResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or unknown discount code.' }); // 400 or 404
    }

    const discount = discountResult.rows[0];

    // --- 3. Perform Validations ---
    if (!discount.is_active) {
      return res.status(400).json({ message: 'This discount code is no longer active.' });
    }
    const currentDate = new Date();
    if (discount.valid_from && new Date(discount.valid_from) > currentDate) {
      return res.status(400).json({ message: 'This discount code is not yet valid.' });
    }
    if (discount.valid_until && new Date(discount.valid_until) < currentDate) {
      return res.status(400).json({ message: 'This discount code has expired.' });
    }
    if (discount.usage_limit !== null && discount.times_used >= discount.usage_limit) {
      return res.status(400).json({ message: 'This discount code has reached its usage limit.' });
    }
    if (discount.min_order_amount !== null && subtotal < parseFloat(discount.min_order_amount)) {
      return res.status(400).json({
        message: `Minimum order subtotal of $${parseFloat(discount.min_order_amount).toFixed(2)} not met for this discount.`
      });
    }

    // --- 4. Calculate Discount Value ---
    let calculatedDiscountAmount = 0;
    if (discount.type === 'percentage') {
      calculatedDiscountAmount = subtotal * (parseFloat(discount.value) / 100.0);
    } else if (discount.type === 'fixed_amount') {
      calculatedDiscountAmount = parseFloat(discount.value);
    }

    // Ensure discount doesn't exceed subtotal (e.g., $10 off a $5 cart)
    calculatedDiscountAmount = Math.min(calculatedDiscountAmount, subtotal);
    calculatedDiscountAmount = parseFloat(calculatedDiscountAmount.toFixed(2));


    // --- 5. Response (on success) ---
    res.status(200).json({
      code: discount.code,
      type: discount.type,
      value: parseFloat(discount.value).toFixed(2), // Original value of the discount
      description: discount.description,
      calculated_discount_amount_for_cart: calculatedDiscountAmount,
      message: 'Discount code is valid and applied.', // Message can be more dynamic if needed
    });

  } catch (error) {
    console.error('Error validating discount code:', error);
    res.status(500).json({ message: 'Failed to validate discount code due to a server error.' });
  }
});

const taxService = require('../services/taxService'); // Added for tax calculation
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Added for error handling

// POST /api/cart/calculate-taxes - Calculate taxes for a given cart
router.post('/calculate-taxes', async (req, res, next) => {
  const { cartItems, userId, shippingAddress } = req.body; // shippingAddress is for guest/estimation

  // Validate cartItems
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return next(new BadRequestError('Cart items are required to calculate taxes.'));
  }
  for (const item of cartItems) {
    if (!item.productId || typeof item.productId !== 'number' ||
        !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0 ||
        !item.price || typeof item.price !== 'number' || item.price < 0) {
      return next(new BadRequestError('Each cart item must have a valid productId, quantity, and price.'));
    }
    // productVariantId is optional
    if (item.variantId && typeof item.variantId !== 'number') {
        return next(new BadRequestError(`Invalid variantId format for product ${item.productId}.`));
    }
  }

  let userIsTaxExempt = false;
  let addressForTaxCalculation = {};

  const client = await db.pool.connect(); // Use a client for potential multiple queries

  try {
    // 1. Determine User and Tax Exemption Status
    if (userId) {
      const userResult = await client.query('SELECT is_tax_exempt, country, state_province_region, postal_code FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        userIsTaxExempt = userResult.rows[0].is_tax_exempt || false;
        // Use user's saved address if no specific shippingAddress is provided for estimation
        if (!shippingAddress || !shippingAddress.country) {
            addressForTaxCalculation = {
                country: userResult.rows[0].country,
                state_province_region: userResult.rows[0].state_province_region,
                // postal_code: userResult.rows[0].postal_code // Tax service might not use postal code directly for now
            };
        }
      } else {
        // User ID provided but not found - could be an error or guest passing an old ID.
        // For now, proceed as if guest if user not found, but log it.
        console.warn(`User ID ${userId} provided for tax calculation but not found.`);
      }
    }

    // 2. Determine Address for Tax Calculation
    // If a shippingAddress is explicitly provided in the request, use that.
    // This allows guests to estimate tax or logged-in users to estimate for a different address.
    if (shippingAddress && shippingAddress.country) {
        addressForTaxCalculation = {
            country: shippingAddress.country,
            state_province_region: shippingAddress.state_province_region || null,
            // postal_code: shippingAddress.postalCode || null // Align with taxService expectations
        };
    } else if (!addressForTaxCalculation.country && !userId) { // No userId and no shippingAddress means we can't determine jurisdiction
        // If no user and no address, we might default to no tax or return an error.
        // For now, let's assume taxService can handle missing address (e.g., no tax).
        // Or, require address if not a logged-in user with a saved address.
         return next(new BadRequestError('Shipping address is required to calculate taxes for guest users.'));
    }


    // 3. Prepare cart items for the tax service
    // The tax service expects: { product_id, variant_id, quantity, unit_price }
    const itemsForTaxCalc = cartItems.map(item => ({
      product_id: item.productId, // from cartItem.productId
      variant_id: item.variantId || null, // from cartItem.variantId
      quantity: item.quantity,
      unit_price: item.price // from cartItem.price (this should be the pre-tax unit price)
    }));

    // 4. Call Tax Service
    const taxCalculationResult = await taxService.calculateTaxForCartItems(
      itemsForTaxCalc,
      userId || null, // Pass userId if available, otherwise null
      addressForTaxCalculation,
      userIsTaxExempt,
      client // Pass the connected client
    );

    res.status(200).json(taxCalculationResult);

  } catch (error) {
    console.error('Error calculating taxes for cart:', error);
    // Use next to pass the error to the global error handler
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
