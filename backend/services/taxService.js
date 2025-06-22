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
    // Simple summation of tax amounts based on the initial base price
    const currentRateTax = numericBasePrice * (ratePercentage / 100);
    totalTaxAmount += currentRateTax;
    appliedRatesDetailed.push({
      id: rate.id,
      name: rate.name,
      rate_percentage: ratePercentage, // Store as number
      amount: parseFloat(currentRateTax.toFixed(4)), // Store tax amount with more precision initially
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
async function calculateTaxForCartItems(cartItems, userId, shippingAddress, dbClientOptional) {
  const queryRunner = dbClientOptional || db;
  const line_items_with_tax_details = [];
  let overall_total_tax_amount = 0;
  const tax_summary_details = {}; // Example: { "CA Sales Tax": { total_taxable_amount: X, total_tax_collected: Y } }

  // Fetch user's tax exemption status
  let userIsTaxExempt = false;
  if (userId) {
    try {
      const userResult = await queryRunner.query('SELECT is_tax_exempt FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        userIsTaxExempt = userResult.rows[0].is_tax_exempt;
      }
    } catch (userError) {
      console.error(`Error fetching user tax exemption status for user ID ${userId}:`, userError);
      // Decide if this should throw or proceed without exemption
    }
  }

  if (userIsTaxExempt) {
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

    // Populate tax_summary_details (simplified example)
    itemTaxDetails.applied_rates_summary.forEach(rate => {
        if (!tax_summary_details[rate.name]) {
            tax_summary_details[rate.name] = { total_taxable_amount: 0, total_tax_collected: 0 };
        }
        // Assuming basePriceForItem * item.quantity is the taxable amount for this rate
        tax_summary_details[rate.name].total_taxable_amount += (basePriceForItem * item.quantity);
        tax_summary_details[rate.name].total_tax_collected += (parseFloat(rate.amount) * item.quantity);
    });
  }

  // Ensure totals are correctly formatted
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


module.exports = {
  calculatePriceWithAppliedTaxes,
  calculateTaxForCartItems, // Export the new function
};
