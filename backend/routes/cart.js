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

module.exports = router;
