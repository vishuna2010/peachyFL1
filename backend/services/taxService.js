const db = require('../db'); // Not strictly needed if dbClient is always used, but good for consistency or potential direct use elsewhere.
const { NotFoundError, BadRequestError } = require('../utils/AppError'); // Import if needed for errors thrown by this service

/**
 * Calculates tax for cart items based on customer, shipping address, and product tax classes.
 * Phase 1: Assumes one applicable tax rate per item based on jurisdiction and tax class.
 *
 * @param {Array<Object>} cartItems - Array of items in the cart. Each item should have productId, quantity, unit_price.
 * @param {number} customerId - The ID of the customer placing the order.
 * @param {Object} shippingAddressDetails - Details of the shipping address.
 *        Expected to have `country` and `state_province_region`.
 * @param {Object} dbClient - An active database client (e.g., from a transaction pool).
 * @returns {Promise<Object>} An object containing total_tax_amount, line_items_with_tax_details, and tax_summary_details.
 */
async function calculateTaxForCartItems(cartItems, customerId, shippingAddressDetails, dbClient) {
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

    // 2. Determine Jurisdiction (Simplified for Phase 1)
    // Using country and state/province. Ensure these are consistently available.
    const country = shippingAddressDetails.country ? String(shippingAddressDetails.country).toUpperCase() : 'UNKNOWN_COUNTRY';
    const stateProvince = shippingAddressDetails.state_province_region ? String(shippingAddressDetails.state_province_region).toUpperCase() : 'UNKNOWN_STATE';
    const jurisdiction = `${country}-${stateProvince}`;
    // A more robust system would use country_code and state_code if available and validated.

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

        // Query for applicable tax rate
        // Phase 1: Assumes only one applicable rate per item. A more complex system might sum multiple rates (e.g., state + county tax).
        const taxRateQuery = `
            SELECT tr.id as tax_rate_id, tr.name, tr.rate_percentage
            FROM tax_rates tr
            JOIN tax_class_rates tcr ON tr.id = tcr.tax_rate_id
            WHERE tcr.tax_class_id = $1
              AND LOWER(tr.jurisdiction) = LOWER($2)
              AND tr.is_active = TRUE
              AND (tr.valid_from IS NULL OR tr.valid_from <= CURRENT_DATE)
              AND (tr.valid_until IS NULL OR tr.valid_until >= CURRENT_DATE)
            ORDER BY tr.id -- Consistent ordering if somehow multiple match, though LIMIT 1 picks one
            LIMIT 1;
        `;
        const taxRateResult = await dbClient.query(taxRateQuery, [productTaxClassId, jurisdiction]);

        if (taxRateResult.rows.length > 0) {
            const matched_tax_rate = taxRateResult.rows[0];
            const item_price_before_tax = parseFloat(itemWithTax.unit_price); // Assuming unit_price is pre-tax
            const rate = parseFloat(matched_tax_rate.rate_percentage);

            // Calculate tax for the entire line item (unit price * quantity * rate)
            const tax_for_item_line = item_price_before_tax * itemWithTax.quantity * rate;

            itemWithTax.line_item_tax_amount = parseFloat(tax_for_item_line.toFixed(2));
            itemWithTax.applied_tax_rate_percentage = rate;

            overall_total_tax += itemWithTax.line_item_tax_amount;

            // Update applied_taxes_summary
            const summaryKey = matched_tax_rate.tax_rate_id.toString(); // Use ID as a robust key
            if (!applied_taxes_summary[summaryKey]) {
                applied_taxes_summary[summaryKey] = {
                    tax_rate_id: matched_tax_rate.tax_rate_id,
                    name: matched_tax_rate.name,
                    rate_percentage: rate,
                    total_tax_for_this_rate: 0,
                };
            }
            applied_taxes_summary[summaryKey].total_tax_for_this_rate += itemWithTax.line_item_tax_amount;
            // Ensure two decimal places for summary totals too
            applied_taxes_summary[summaryKey].total_tax_for_this_rate = parseFloat(applied_taxes_summary[summaryKey].total_tax_for_this_rate.toFixed(2));

        }
        line_items_with_tax_details.push(itemWithTax);
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
