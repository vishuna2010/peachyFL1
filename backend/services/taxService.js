const db = require('../db'); // Not strictly needed if dbClient is always used, but good for consistency or potential direct use elsewhere.
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Import if needed for errors thrown by this service

const PRICES_ARE_INCLUSIVE = process.env.PRICES_ARE_INCLUSIVE === 'true' || false;
// For testing, you might temporarily set this to true, e.g., const PRICES_ARE_INCLUSIVE = true;

/**
 * Calculates tax for cart items based on customer, shipping address, and product tax classes.
 * Phase 1: Assumes one applicable tax rate per item based on jurisdiction and tax class.
 *
 * @param {Array<Object>} cartItems - Array of items in the cart. Each item should have productId, quantity, unit_price.
 * @param {number} customerId - The ID of the customer placing the order.
 * @param {Object} billingAddressForTax - Details of the billing address for tax jurisdiction.
 *        Expected to have `country` and `state_province_region`. (Note: Prompt used shippingAddressDetails.country_code, this uses .country)
 * @param {Object} dbClient - An active database client (e.g., from a transaction pool).
 * @returns {Promise<Object>} An object containing total_tax_amount, line_items_with_tax_details, and tax_summary_details.
 */
async function calculateTaxForCartItems(cartItems, customerId, billingAddressForTax, dbClient) {
    // 1. Fetch User & Check Exemption
    let isUserTaxExempt = false;
    if (customerId) {
        const userResult = await dbClient.query('SELECT is_tax_exempt FROM users WHERE id = $1', [customerId]);
        if (userResult.rows.length > 0 && userResult.rows[0].is_tax_exempt) {
            isUserTaxExempt = true;
        }
    }

    if (isUserTaxExempt) {
        const itemsWithZeroTax = cartItems.map(item => ({
            ...item,
            line_item_tax_amount: 0,
            applied_tax_rate_percentage: 0,
            tax_class_id_at_purchase: null, // No tax class applied if exempt
        }));
        return {
            total_tax_amount: 0,
            line_items_with_tax_details: itemsWithZeroTax,
            tax_summary_details: []
        };
    }

    // 2. Determine Jurisdictions to Try (Enhanced for Phase 2)
    // Using .country and .state_province_region as per the original working version rather than .country_code
    const countryCode = billingAddressForTax.country ? String(billingAddressForTax.country).toUpperCase() : null;
    const stateCode = billingAddressForTax.state_province_region ? String(billingAddressForTax.state_province_region).toUpperCase() : null;

    const potentialJurisdictions = [];
    const queryParamsForJurisdictions = [];

    if (countryCode && stateCode) {
        potentialJurisdictions.push(String(`${countryCode}-${stateCode}`).toLowerCase());
    }
    if (countryCode) {
        potentialJurisdictions.push(String(countryCode).toLowerCase());
    }
    // Add a global fallback like '*' if you have global tax rates defined with '*' jurisdiction
    // potentialJurisdictions.push('*');

    let overall_total_tax = 0;
    const line_items_with_tax_details = []; // This will be the new array with tax details
    const applied_taxes_summary = {}; // Key: tax_rate_id or name, Value: { name, rate, total_tax_for_this_rate }

    for (const cartItem of cartItems) {
        // Initialize item with tax fields (copying to avoid modifying original cartItem if it's from a shared reference elsewhere)
        const itemWithTax = {
            ...cartItem, // Contains productId, quantity, unit_price (which might be inclusive or exclusive)
            original_unit_price: parseFloat(cartItem.unit_price), // Store original price
            calculated_exclusive_unit_price: parseFloat(cartItem.unit_price), // Default to original, adjusted if inclusive
            line_item_tax_amount: 0,
            applied_tax_rate_percentage: null, // This will store R_total_eff
            tax_class_id_at_purchase: null,
        };

        // Fetch product's tax_class_id
        const productResult = await dbClient.query('SELECT tax_class_id FROM products WHERE id = $1', [itemWithTax.productId]);
        if (productResult.rows.length === 0) {
            // This should ideally not happen if cart items are validated before this step
            console.warn(`Product with ID ${itemWithTax.productId} not found during tax calculation. Skipping tax for this item.`);
            line_items_with_tax_details.push(itemWithTax);
            continue;
        }
        const productTaxClassId = productResult.rows[0].tax_class_id;
        itemWithTax.tax_class_id_at_purchase = productTaxClassId;

        if (productTaxClassId === null) {
            // Product is not assigned to any tax class, so no tax for this item
            line_items_with_tax_details.push(itemWithTax);
            continue;
        }

        itemWithTax.tax_class_id_at_purchase = productTaxClassId;

        if (productTaxClassId === null || potentialJurisdictions.length === 0) {
            line_items_with_tax_details.push(itemWithTax); // No tax class or no jurisdiction to check
            continue;
        }

        const jurisdictionPlaceholders = potentialJurisdictions.map((_, i) => `LOWER($${i + 2})`).join(',');
        const allApplicableRatesQuery = `
            SELECT tr.id as tax_rate_id, tr.name, tr.rate_percentage, tr.jurisdiction, tr.tax_type
            FROM tax_rates tr
            JOIN tax_class_rates tcr ON tr.id = tcr.tax_rate_id
            WHERE tcr.tax_class_id = $1
              AND LOWER(tr.jurisdiction) IN (${jurisdictionPlaceholders})
              AND tr.is_active = TRUE
              AND (tr.valid_from IS NULL OR tr.valid_from <= CURRENT_DATE)
              AND (tr.valid_until IS NULL OR tr.valid_until >= CURRENT_DATE)
            ORDER BY LENGTH(tr.jurisdiction) DESC, tr.id;
        `;
        const queryValues = [productTaxClassId, ...potentialJurisdictions];
        const taxRateResults = await dbClient.query(allApplicableRatesQuery, queryValues);

        let R_total_eff = 0; // Total effective rate for this item

        if (taxRateResults.rows.length > 0) {
            const PRIMARY_TAX_TYPES = ['GST', 'VAT'];
            const primaryRates = [];
            const secondaryRates = [];
            const processedRateIdsForTempCalc = new Set();

            for (const rateRecord of taxRateResults.rows) {
                if (processedRateIdsForTempCalc.has(rateRecord.tax_rate_id)) continue;
                const taxTypeUpper = rateRecord.tax_type ? rateRecord.tax_type.toUpperCase() : "";
                if (PRIMARY_TAX_TYPES.includes(taxTypeUpper)) {
                    primaryRates.push(rateRecord);
                } else {
                    secondaryRates.push(rateRecord);
                }
                processedRateIdsForTempCalc.add(rateRecord.tax_rate_id);
            }

            let temp_total_primary_tax_rate = 0;
            primaryRates.forEach(r => temp_total_primary_tax_rate += parseFloat(r.rate_percentage));

            const temp_base_for_secondary_rate_calc = (1 + temp_total_primary_tax_rate);
            let temp_total_secondary_tax_rate_on_primary_base = 0;
            secondaryRates.forEach(r => temp_total_secondary_tax_rate_on_primary_base += (temp_base_for_secondary_rate_calc * parseFloat(r.rate_percentage)));

            R_total_eff = temp_total_primary_tax_rate + temp_total_secondary_tax_rate_on_primary_base;

            if (PRICES_ARE_INCLUSIVE) {
                if ((1 + R_total_eff) !== 0) {
                    itemWithTax.calculated_exclusive_unit_price = itemWithTax.original_unit_price / (1 + R_total_eff);
                } else {
                    itemWithTax.calculated_exclusive_unit_price = itemWithTax.original_unit_price; // Avoid division by zero, treat as 0 tax
                }
            }
            // If not inclusive, calculated_exclusive_unit_price remains same as original_unit_price (set at itemWithTax init)
        }

        itemWithTax.calculated_exclusive_unit_price = parseFloat(itemWithTax.calculated_exclusive_unit_price.toFixed(4));
        itemWithTax.applied_tax_rate_percentage = parseFloat(R_total_eff.toFixed(4));

        // Now, proceed with actual tax amount calculation using calculated_exclusive_unit_price
        let itemLineTaxTotal = 0;
        const item_extended_exclusive_price = itemWithTax.calculated_exclusive_unit_price * itemWithTax.quantity;

        if (taxRateResults.rows.length > 0) { // Re-check or use categorized rates
            const PRIMARY_TAX_TYPES = ['GST', 'VAT'];
            const primaryRates = []; // Re-populate or pass from above categorization
            const secondaryRates = [];
            const processedRateIdsForActualCalc = new Set();

            for (const rateRecord of taxRateResults.rows) {
                if (processedRateIdsForActualCalc.has(rateRecord.tax_rate_id)) continue;
                const taxTypeUpper = rateRecord.tax_type ? rateRecord.tax_type.toUpperCase() : "";
                if (PRIMARY_TAX_TYPES.includes(taxTypeUpper)) { primaryRates.push(rateRecord); }
                else { secondaryRates.push(rateRecord); }
                processedRateIdsForActualCalc.add(rateRecord.tax_rate_id);
            }

            let totalPrimaryTaxForThisItem = 0;
            for (const rateRecord of primaryRates) {
                const rate = parseFloat(rateRecord.rate_percentage);
                const tax_for_this_rate = item_extended_exclusive_price * rate;
                totalPrimaryTaxForThisItem += tax_for_this_rate;

                const summaryKey = rateRecord.tax_rate_id.toString();
                if (!applied_taxes_summary[summaryKey]) {
                    applied_taxes_summary[summaryKey] = {
                        tax_rate_id: rateRecord.tax_rate_id, name: rateRecord.name,
                        rate_percentage: rate,
                        total_tax_for_this_rate: 0,
                        tax_type: rateRecord.tax_type
                    };
                }
                applied_taxes_summary[summaryKey].total_tax_for_this_rate += tax_for_this_rate;
            }
            itemLineTaxTotal += totalPrimaryTaxForThisItem;

            const base_for_secondary_taxes = item_extended_exclusive_price + totalPrimaryTaxForThisItem;
            let totalSecondaryTaxForThisItem = 0;
            for (const rateRecord of secondaryRates) {
                const rate = parseFloat(rateRecord.rate_percentage);
                const tax_for_this_rate = base_for_secondary_taxes * rate;
                totalSecondaryTaxForThisItem += tax_for_this_rate;

                const summaryKey = rateRecord.tax_rate_id.toString();
                if (!applied_taxes_summary[summaryKey]) {
                    applied_taxes_summary[summaryKey] = {
                        tax_rate_id: rateRecord.tax_rate_id, name: rateRecord.name,
                        rate_percentage: rate,
                        total_tax_for_this_rate: 0,
                        tax_type: rateRecord.tax_type
                    };
                }
                applied_taxes_summary[summaryKey].total_tax_for_this_rate += tax_for_this_rate;
            }
            itemLineTaxTotal += totalSecondaryTaxForThisItem;

            itemWithTax.line_item_tax_amount = parseFloat(itemLineTaxTotal.toFixed(2));
            overall_total_tax += itemWithTax.line_item_tax_amount;
        }
        line_items_with_tax_details.push(itemWithTax);
    }

    for (const key in applied_taxes_summary) {
        if (applied_taxes_summary.hasOwnProperty(key)) {
            applied_taxes_summary[key].total_tax_for_this_rate = parseFloat(applied_taxes_summary[key].total_tax_for_this_rate.toFixed(2));
        }
    }

    // Format tax_summary_details into an array
    const tax_summary_details_array = Object.values(applied_taxes_summary);

    return {
        total_tax_amount: parseFloat(overall_total_tax.toFixed(2)),
        line_items_with_tax_details: line_items_with_tax_details,
        tax_summary_details: tax_summary_details_array
    };
}

module.exports = {
    calculateTaxForCartItems,
};
