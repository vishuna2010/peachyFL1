const db = require('../db'); // Not strictly needed if dbClient is always used, but good for consistency or potential direct use elsewhere.
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Import if needed for errors thrown by this service

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
            ...cartItem,
            line_item_tax_amount: 0,
            applied_tax_rate_percentage: null,
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
            // Product is not assigned to any tax class, or no jurisdiction to check
            line_items_with_tax_details.push(itemWithTax);
            continue;
        }

        // Build IN clause for jurisdictions dynamically for SQL query
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
        // Note: The productId is itemWithTax.productId, unit_price is itemWithTax.unit_price

        const queryValues = [productTaxClassId, ...potentialJurisdictions];
        const taxRateResults = await dbClient.query(allApplicableRatesQuery, queryValues);

        let itemLineTaxTotal = 0;

            if (taxRateResults.rows.length > 0) {
                const PRIMARY_TAX_TYPES = ['GST', 'VAT'];
                const primaryRates = [];
                const secondaryRates = [];

                const processedRateIdsForCategorization = new Set();
                for (const rateRecord of taxRateResults.rows) {
                    if (processedRateIdsForCategorization.has(rateRecord.tax_rate_id)) {
                        continue;
                    }
                    const taxTypeUpper = rateRecord.tax_type ? rateRecord.tax_type.toUpperCase() : "";
                    if (PRIMARY_TAX_TYPES.includes(taxTypeUpper)) {
                        primaryRates.push(rateRecord);
                    } else {
                        secondaryRates.push(rateRecord);
                    }
                    processedRateIdsForCategorization.add(rateRecord.tax_rate_id);
                }

                const item_extended_base_price = parseFloat(itemWithTax.unit_price) * itemWithTax.quantity;
                let totalPrimaryTaxForThisItem = 0;

                // Process Primary Rates
                for (const rateRecord of primaryRates) {
                    const rate = parseFloat(rateRecord.rate_percentage);
                    const tax_for_this_rate = item_extended_base_price * rate;
                    totalPrimaryTaxForThisItem += tax_for_this_rate;

                    const summaryKey = rateRecord.tax_rate_id.toString();
                    if (!applied_taxes_summary[summaryKey]) {
                        applied_taxes_summary[summaryKey] = {
                            tax_rate_id: rateRecord.tax_rate_id, name: rateRecord.name,
                            rate_percentage: rate,
                            total_tax_for_this_rate: 0,
                            tax_type: rateRecord.tax_type // Store tax_type in summary
                        };
                    }
                    applied_taxes_summary[summaryKey].total_tax_for_this_rate += tax_for_this_rate;
                }

                itemLineTaxTotal += totalPrimaryTaxForThisItem;

                // Process Secondary Rates
                const base_for_secondary_taxes = item_extended_base_price + totalPrimaryTaxForThisItem;
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
                            tax_type: rateRecord.tax_type // Store tax_type in summary
                        };
                    }
                    applied_taxes_summary[summaryKey].total_tax_for_this_rate += tax_for_this_rate;
                }
                itemLineTaxTotal += totalSecondaryTaxForThisItem;

                itemWithTax.line_item_tax_amount = parseFloat(itemLineTaxTotal.toFixed(2));

                if (item_extended_base_price > 0) {
                    itemWithTax.applied_tax_rate_percentage = parseFloat((itemLineTaxTotal / item_extended_base_price).toFixed(4));
                } else {
                    itemWithTax.applied_tax_rate_percentage = 0;
                }
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
