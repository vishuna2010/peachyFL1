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
      SELECT tr.id, tr.name, tr.rate_percentage, tr.type
      FROM tax_rates tr
      JOIN tax_class_rates tcr ON tr.id = tcr.tax_rate_id
      WHERE tcr.tax_class_id = $1 AND tr.is_active = TRUE
      ORDER BY tr.priority ASC, tr.id ASC; -- Added order for consistent calculation if priority matters later
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

module.exports = {
  calculatePriceWithAppliedTaxes,
};
