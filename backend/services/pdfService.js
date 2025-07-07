const puppeteer = require('puppeteer');
// const JsBarcode = require('jsbarcode'); // Commented out
// const { createCanvas } = require('canvas'); // Commented out
const qrcode = require('qrcode');
const config = require('../config'); // Import the centralized config
const { getSiteSetting } = require('./siteSettingsService');

/**
 * Generates a barcode as a data URL.
 * @param {string} text - The text to encode in the barcode.
 * @param {object} options - Options for JsBarcode.
 * @returns {string} The barcode image as a data URL (PNG).
 */
function generateBarcodeDataURL(text, options = {}) {
  // const canvas = createCanvas(200, 100); // Commented out
  // JsBarcode(canvas, text, { // Commented out
  //   format: 'CODE128',
  //   displayValue: true,
  //   fontSize: 18,
  //   margin: 10,
  //   ...options,
  // });
  // return canvas.toDataURL('image/png'); // Commented out
  console.warn("Barcode generation (JsBarcode/Canvas) is currently disabled.");
  return null; // Return null as canvas is not available
}

/**
 * Generates an HTML string for the product label.
 * @param {object} product - Product object containing name, sku, price.
 * @param {object} labelData - Object with label data (full_display_name, sku, selling_price, currency_symbol).
 * @param {string} barcodeDataUrl - The data URL of the generated barcode.
 * @param {string} qrCodeDataUrl - The data URL of the generated QR code.
 * @returns {string} HTML string for the label.
 */
function getProductLabelHtml(labelData, barcodeDataUrl, qrCodeDataUrl) {
  // barcodeDataUrl is effectively ignored now in the HTML structure
  const sellingPrice = parseFloat(labelData.selling_price).toFixed(2); // Base price
  const priceInclTax = labelData.price_incl_tax ? parseFloat(labelData.price_incl_tax).toFixed(2) : sellingPrice;
  const taxAmount = labelData.tax_amount ? parseFloat(labelData.tax_amount).toFixed(2) : null;
  const sku = labelData.sku || 'N/A';
  const displayName = labelData.full_display_name || 'N/A';
  const currencySymbol = labelData.currency_symbol || '$';

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Product Label</title><style>
      body { font-family: Arial, sans-serif; width: 300px; padding: 10px; text-align: center; border: 1px solid #ccc; box-sizing: border-box; }
      h1 { font-size: 18px; margin: 8px 0; word-wrap: break-word; }
      .price-section { margin-bottom: 8px; }
      .price-section p { margin: 2px 0; }
      .base-price { font-size: 13px; }
      .tax-amount { font-size: 11px; color: #555; }
      .total-price { font-size: 16px; font-weight: bold; margin-top: 4px; }
      img.qrcode { display: block; margin: 8px auto 5px auto; max-width: 45%; height: auto; } /* Adjusted size slightly if needed */
      .sku { font-size: 12px; margin-top: 2px; margin-bottom: 8px; word-break: break-all; } /* word-break for long SKUs */
    </style></head>
    <body>
      <h1>${displayName}</h1>

      <div class="price-section">
        <p class="base-price">Price: ${currencySymbol}${sellingPrice}</p>
        ${taxAmount && parseFloat(taxAmount) > 0 ? `<p class="tax-amount">Tax: ${currencySymbol}${taxAmount}</p>` : ''}
        <p class="total-price">Total: ${currencySymbol}${priceInclTax}</p>
      </div>

      ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR Code for ${labelData.barcode_value || sku}" class="qrcode" />` : ''}
      ${qrCodeDataUrl ? `<p class="sku">SKU: ${sku}</p>` : `<p class="sku">SKU: ${sku}</p>`}

    </body>
    </html>
  `;
}

/**
 * Generates a product label PDF.
 * @param {object} productLabelData - Object containing data for the label.
 * @param {number} count - Number of labels to generate.
 * @returns {Promise<Buffer>} A Promise that resolves with the PDF buffer.
 */
async function generateProductLabelPdf(productLabelData, count = 1) {
  let browser = null;

  function extractCoreLabelContent(htmlString) {
    const bodyMatch = htmlString.match(/<body>([\s\S]*)<\/body>/);
    return bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : '';
  }

  try {
    // Barcode generation is removed
    // const barcodeText = productLabelData.barcode_value;
    // if (!barcodeText) {
    //     console.warn(`No barcode_value available for product ${productLabelData.full_display_name} to generate barcode.`);
    // }
    // const barcodeDataUrl = barcodeText ? generateBarcodeDataURL(barcodeText) : null;

    // Generate QR Code using barcode_value (SKU)
    const qrCodeDataUrl = productLabelData.barcode_value
      ? await generateQrCodeDataURL(productLabelData.barcode_value)
      : null;

    const singleLabelHtml = getProductLabelHtml(productLabelData, null, qrCodeDataUrl); // Pass null for barcodeDataUrl
    const coreLabelHtml = extractCoreLabelContent(singleLabelHtml);

    let allLabelsHtmlContent = '';
    for (let i = 0; i < count; i++) {
      allLabelsHtmlContent += `<div class="label-instance">${coreLabelHtml}</div>`;
    }

    const finalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Product Labels</title>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          .label-instance {
            width: 300px; /* From original getProductLabelHtml */
            padding: 10px;
            border: 1px solid #ccc;
            box-sizing: border-box;
            page-break-after: always; /* Each label on a new page for simplicity */
            /* To try multiple on one page, use: display: inline-block; margin: 5mm; page-break-inside: avoid; */
          }
          /* Copy styles from getProductLabelHtml and scope them to .label-instance */
          .label-instance h1 { font-size: 18px; margin: 5px 0; word-wrap: break-word; text-align: center; }
          .label-instance .sku { font-size: 12px; margin-bottom: 5px; text-align: center; }
          .label-instance .price { font-size: 14px; margin-bottom: 3px; text-align: center; }
          .label-instance .vat-price { font-size: 16px; font-weight: bold; margin-bottom: 8px; text-align: center; }
          .label-instance img.barcode { display: block; margin: 0 auto 5px auto; max-width: 90%; height: auto; }
          .label-instance img.qrcode { display: block; margin: 5px auto 0 auto; max-width: 35%; height: auto; }
        </style>
      </head>
      <body>${allLabelsHtmlContent}</body>
      </html>
    `;

    // Launch Puppeteer
    // Note: In some environments (like certain Lambdas or containers), you might need
    // 'puppeteer-core' and provide an executablePath for Chrome, or use args like '--no-sandbox'.
    browser = await puppeteer.launch({
        headless: true, // Ensure it's headless for server-side use
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Often needed in restricted environments
    });
    const page = await browser.newPage();

    // Set content to our generated HTML
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    // Generate PDF
    // Common label sizes: e.g., 4x2 inches. Puppeteer uses points (72 DPI).
    // 3 inches width = 216 points. 1.5 inches height = 108 points.
    // These are approximate and depend on desired label output.
    const pdfBuffer = await page.pdf({
      printBackground: true,
      margin: { top: '0.1in', right: '0.1in', bottom: '0.1in', left: '0.1in' }
      // format: 'A4' // Optional: use if page-break-after doesn't give desired result without it
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF with Puppeteer:', error);
    throw error; // Re-throw to be handled by the route
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generateProductLabelPdf,
  generateOrderInvoicePdf,
  generateQrCodeDataURL,
  generatePackingSlipPdf, // Added new function
  getShippingLabelHtml, // Added for shipping label
  generateShippingLabelPdf, // Added for shipping label
  generateRefundInvoicePdf, // Added for refund invoices
};

// Helper function to generate HTML for a shipping label
function getShippingLabelHtml(labelData) {
  const {
    orderId,
    shipmentDate,
    sender, // { name, addressLine1, addressLine2, city, postalCode, country, phone }
    recipient, // { name, addressLine1, addressLine2, city, postalCode, country, phone }
    trackingNumber,
    carrier,
    barcodeDataUrl // This will be the QR code data URL for the tracking number
  } = labelData;

  return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <title>Shipping Label - Order ${orderId}</title>
      <style>
          body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0; /* Padding will be handled by puppeteer's page.pdf margin */
              width: 4in;
              height: 6in;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
          }
          .label-container {
              width: 100%;
              height: 100%;
              padding: 0.15in; /* Overall padding inside the 4x6 area */
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
          }
          .section {
              border: 1.5px solid #000;
              padding: 0.1in;
              margin-bottom: 0.1in;
              page-break-inside: avoid;
          }
          .address-block h3 {
              margin-top: 0;
              margin-bottom: 0.05in;
              font-size: 8pt;
              font-weight: bold;
              text-transform: uppercase;
              border-bottom: 1px solid #ccc;
              padding-bottom: 0.03in;
          }
          .address-block p {
              margin: 0.02in 0;
              font-size: 10pt;
              line-height: 1.3;
          }
          .address-block p.recipient-name {
              font-size: 12pt;
              font-weight: bold;
          }
          .top-section { display: flex; justify-content: space-between; margin-bottom: 0.1in; }
          .top-section .sender-address { width: 55%; }
          .top-section .carrier-details { width: 40%; text-align: left; font-size: 8pt; padding: 0.05in }

          .recipient-address { text-align: left; padding: 0.15in; }
          .barcode-area { text-align: center; padding-top: 0.1in; padding-bottom: 0.05in; border-top: 2px dashed #000; margin-top:0.1in; }
          .barcode-area img {
              max-width: 70%; /* Adjust based on QR code size */
              height: auto;
              max-height: 0.8in; /* Max height for QR code */
              display: block;
              margin: 0.05in auto;
          }
          .tracking-number-text { font-size: 10pt; font-weight: bold; margin-top: 0.05in; letter-spacing: 0.5px; }
          .footer-info { text-align: center; font-size: 7pt; padding-top: 0.05in; }
          .no-grow { flex-grow: 0; }
          .grow { flex-grow: 1; }
      </style>
  </head>
  <body>
      <div class="label-container">
          <div class="no-grow">
              <div class="top-section">
                  <div class="section sender-address address-block">
                      <h3>FROM:</h3>
                      <p>${sender.name}</p>
                      <p>${sender.addressLine1}</p>
                      ${sender.addressLine2 ? `<p>${sender.addressLine2}</p>` : ''}
                      <p>${sender.city}, ${sender.postalCode}</p>
                      <p>${sender.country || ''}</p>
                      ${sender.phone ? `<p>Tel: ${sender.phone}</p>` : ''}
                  </div>
                  <div class="section carrier-details">
                      <p><strong>Carrier:</strong> ${carrier}</p>
                      <p><strong>Order ID:</strong> ${orderId}</p>
                      <p><strong>Ship Date:</strong> ${shipmentDate}</p>
                      <!-- Add weight/service type here if available -->
                  </div>
              </div>

              <div class="section recipient-address address-block">
                  <h3>TO:</h3>
                  <p class="recipient-name">${recipient.name}</p>
                  <p>${recipient.addressLine1}</p>
                  ${recipient.addressLine2 ? `<p>${recipient.addressLine2}</p>` : ''}
                  <p>${recipient.city}, ${recipient.postalCode}</p>
                  <p>${recipient.country}</p>
                  ${recipient.phone ? `<p>Tel: ${recipient.phone}</p>` : ''}
              </div>
          </div>

          <div class="grow section barcode-area">
              ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Tracking QR Code">` : '<p>Tracking N/A</p>'}
              <p class="tracking-number-text">${trackingNumber}</p>
          </div>
          <div class="no-grow footer-info">
              <p>Thank you for your order! - ${config.company.name}</p>
          </div>
      </div>
  </body>
  </html>
  `;
}

// Function to generate Shipping Label PDF
async function generateShippingLabelPdf(labelData) {
  let browser = null;
  try {
    // Generate QR Code for the tracking number
    const qrCodeDataUrl = labelData.trackingNumber && labelData.trackingNumber !== 'N/A'
      ? await generateQrCodeDataURL(labelData.trackingNumber)
      : null;

    const htmlContent = getShippingLabelHtml({ ...labelData, barcodeDataUrl: qrCodeDataUrl });

    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      width: '4in',
      height: '6in',
      printBackground: true,
      margin: { // Minimal margins, as padding is handled in HTML/CSS
        top: '0in',
        right: '0in',
        bottom: '0in',
        left: '0in',
      }
    });
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating shipping label PDF with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


async function generateQrCodeDataURL(text) {
  if (!text) return null;
  try {
    // Options can be customized, e.g., errorCorrectionLevel, margin, scale
    const options = {
      errorCorrectionLevel: 'H', // High
      type: 'image/png',
      margin: 2,
      scale: 4 // Adjust scale for size/resolution (pixels per module)
    };
    return await qrcode.toDataURL(text, options);
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    return null; // Or throw err to be caught by caller
  }
}

async function getInvoiceHtml(orderDetails) {
  // --- Company Details from config, overridden by orderDetails if present ---
  const companyName = orderDetails.company_name || config.company.name;
  const companyAddress = orderDetails.company_address || config.company.address;
  
  // Get logo from site settings first, then fall back to config
  let companyLogoUrl = orderDetails.company_logo_url;
  if (!companyLogoUrl) {
    const siteLogo = await getSiteSetting('site_logo');
    companyLogoUrl = siteLogo || config.company.logoUrl;
  }
  
  const companyPhone = orderDetails.company_phone || config.company.phone;
  const companyEmail = orderDetails.company_email || config.company.email;
  const companyWebsite = orderDetails.company_website || config.company.website;

  // --- Format Dates ---
  const orderDate = new Date(orderDetails.created_at).toLocaleDateString();

  // --- Helper to format address ---
  const formatAddress = (addr, type) => {
    if (!addr) return `<p>No ${type} address provided.</p>`;
    return `
      <p>
        ${addr.line1 || ''}<br>
        ${addr.line2 || ''}${addr.line2 ? '<br>' : ''}
        ${addr.city || ''}, ${addr.state_province_region || ''} ${addr.postal_code || ''}<br>
        ${addr.country || ''}
      </p>
    `;
  };

  // --- Items Table ---
  let itemsHtml = '';
  let calculatedSubtotal = 0;
  if (orderDetails.items && orderDetails.items.length > 0) {
    orderDetails.items.forEach(item => {
      const unitPrice = parseFloat(item.price_at_purchase); // This is pre-tax unit price
      const quantity = parseInt(item.quantity);
      const lineItemTaxAmount = parseFloat(item.line_item_tax_amount || 0);
      const appliedTaxRatePercentage = item.applied_tax_rate_percentage ? parseFloat(item.applied_tax_rate_percentage) : null;

      // Line total should be pre-tax for subtotal calculation, tax is added separately
      const lineSubtotal = unitPrice * quantity;
      calculatedSubtotal += lineSubtotal;

      itemsHtml += `
        <tr>
          <td>
            ${item.product_name || 'N/A'}
            ${item.display_sku ? `<br><small style="font-size: 0.8em; color: #555;">SKU: ${item.display_sku}</small>` : ''}
          </td>
          <td>${item.tax_class_name_at_purchase || (item.tax_class_id_at_purchase ? `ID: ${item.tax_class_id_at_purchase}` : 'N/A')}</td>
          <td class="text-right">${appliedTaxRatePercentage !== null ? `${appliedTaxRatePercentage.toFixed(2)}%` : 'N/A'}</td>
          <td>${quantity}</td>
          <td class="text-right">${unitPrice.toFixed(2)}</td>
          <td class="text-right">${lineItemTaxAmount.toFixed(2)}</td>
          <td class="text-right">${lineSubtotal.toFixed(2)}</td>
        </tr>
      `;
    });
  }
  // calculatedSubtotal is the sum of (unitPrice * quantity) for all items, which is correct for a pre-tax subtotal.
  // The `orderDetails.original_total_amount` from the DB already represents this pre-discount, pre-tax subtotal.
  // So we can use `orderDetails.original_total_amount` directly.

  const subtotalForDisplay = parseFloat(orderDetails.original_total_amount || calculatedSubtotal).toFixed(2);

  const discountAmount = orderDetails.discount_amount_applied ? parseFloat(orderDetails.discount_amount_applied) : 0;
  const discountHtml = discountAmount > 0
    ? `<tr><td colspan="2"></td><td colspan="4" class="text-right strong">Discount ${orderDetails.discount_code_applied ? `(${orderDetails.discount_code_applied})` : ''}:</td><td class="text-right strong">-${discountAmount.toFixed(2)}</td></tr>`
    : '';

  const totalTaxAmount = orderDetails.total_tax_amount ? parseFloat(orderDetails.total_tax_amount) : 0;
  const taxHtml = `<tr><td colspan="2"></td><td colspan="4" class="text-right strong">Total Tax:</td><td class="text-right strong">${totalTaxAmount.toFixed(2)}</td></tr>`;

  // Tax summary details (optional display)
  let taxSummaryHtml = '';
  if (orderDetails.tax_summary_details && typeof orderDetails.tax_summary_details === 'object' && Object.keys(orderDetails.tax_summary_details).length > 0) {
    taxSummaryHtml += '<tr><td colspan="7" style="padding-top: 10px; text-align: right;"><strong>Tax Breakdown:</strong></td></tr>';
    for (const taxName in orderDetails.tax_summary_details) {
        const detail = orderDetails.tax_summary_details[taxName];
        taxSummaryHtml += `<tr><td colspan="2"></td><td colspan="4" class="text-right">${taxName}:</td><td class="text-right">${parseFloat(detail.total_tax_collected || 0).toFixed(2)}</td></tr>`;
    }
  }


  const grandTotal = parseFloat(orderDetails.total_amount).toFixed(2);


  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice #${orderDetails.id}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #333; }
        .container { width: 90%; margin: 0 auto; padding: 20px; }
        header { border-bottom: 1px solid #FC7099; padding-bottom: 20px; margin-bottom: 30px; text-align: center; } /* Peach Pink border */
        header img.logo { max-height: 60px; max-width: 180px; margin-bottom: 15px; } /* Adjusted logo size */
        header h1 { margin: 0; font-size: 24px; color: #FC7099; } /* Peach Pink company name */
        header p { margin: 2px 0; font-size: 12px; }
        .invoice-details { margin-bottom: 30px; overflow: hidden; }
        .invoice-details .invoice-id { float: left; font-size: 22px; font-weight: bold; color: #FC7099; } /* Peach Pink "INVOICE" */
        .invoice-details .invoice-date { float: right; text-align: right; }
        .addresses { margin-bottom: 30px; overflow: hidden; }
        .addresses .address-block { width: 48%; float: left; }
        .addresses .address-block.shipping { float: right; }
        .addresses h3 { margin-top: 0; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #26A7E2; } /* Sky Blue section titles */
        h3.order-items-heading { margin-top: 20px; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #26A7E2; } /* Sky Blue for Order Items heading */
        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        table.items-table th, table.items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        table.items-table th { background-color: #26A7E2; color: white; font-weight: bold; } /* Sky Blue header, white text */
        table.items-table td.text-right, table.items-table th.text-right { text-align: right; }
        .totals-section { float: right; width: 40%; margin-top: 20px; }
        .totals-section table { width: 100%; }
        .totals-section td { padding: 5px 0; }
        .totals-section td.text-right { text-align: right; }
        .totals-section .grand-total td { font-weight: bold; font-size: 16px; border-top: 2px solid #FC7099; color: #F6A03C } /* Peach Pink border, Orange Gold total */
        footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName} Logo" class="logo"><br>` : ''}
          <h1>${companyName}</h1>
          <p>${companyAddress}</p>
          ${companyPhone ? `<p>Phone: ${companyPhone}</p>` : ''}
          ${companyEmail ? `<p>Email: ${companyEmail}</p>` : ''}
          ${companyWebsite ? `<p>Website: ${companyWebsite}</p>` : ''}
        </header>

        <section class="invoice-details">
          <div class="invoice-id">INVOICE</div>
          <div class="invoice-date">
            <p><strong>Invoice #:</strong> ${orderDetails.id}</p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
            <p><strong>Status:</strong> ${orderDetails.status || 'N/A'}</p>
          </div>
        </section>

        <section class="addresses">
          <div class="address-block billing">
            <h3>Bill To:</h3>
            ${formatAddress(orderDetails.billing_address || orderDetails.shipping_address, 'Billing')}
            ${orderDetails.user_email ? `<p>Email: ${orderDetails.user_email}</p>` : ''}
          </div>
          <div class="address-block shipping">
            <h3>Ship To:</h3>
            ${formatAddress(orderDetails.shipping_address, 'Shipping')}
          </div>
        </section>

        <h3 class="order-items-heading">Order Items:</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Tax Class</th>
              <th class="text-right">Tax Rate</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Line Tax</th>
              <th class="text-right">Line Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <section class="totals-section">
          <table style="width: 100%;">
            <tr>
              <td colspan="2"></td> <td colspan="4" class="text-right">Subtotal:</td>
              <td class="text-right">${subtotalForDisplay}</td>
            </tr>
            ${discountHtml}
            ${taxHtml}
            ${taxSummaryHtml}
            <tr class="grand-total">
             <td colspan="2"></td> <td colspan="4" class="text-right strong">Grand Total:</td>
              <td class="text-right strong">${grandTotal}</td>
            </tr>
          </table>
        </section>
        <div style="clear: both;"></div>

        <footer>
          <p>Thank you for your business!</p>
          ${orderDetails.delivery_confirmation_qr_url ?
            `<div>
               <img src="${orderDetails.delivery_confirmation_qr_code_data_url || ''}" alt="Delivery Confirmation QR Code" style="margin: 10px auto; display: block; width: 100px; height: 100px;">
               <p style="font-size: 9px;">Scan for delivery confirmation</p>
             </div>` : ''
          }
          <p>${companyName} - ${new Date().getFullYear()}</p>
        </footer>
      </div>
    </body>
    </html>
  `;
}

async function generateOrderInvoicePdf(orderDetails) {
  let browser = null;
  try {
    let finalOrderDetails = { ...orderDetails }; // Clone to potentially add QR image data

    if (finalOrderDetails.delivery_confirmation_qr_url) {
      const qrImageDataUrl = await generateQrCodeDataURL(finalOrderDetails.delivery_confirmation_qr_url);
      if (qrImageDataUrl) {
        finalOrderDetails.delivery_confirmation_qr_code_data_url = qrImageDataUrl;
      }
    }

    const htmlContent = await getInvoiceHtml(finalOrderDetails);

    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    const page = await browser.newPage();
    
    // Set a longer timeout and disable images if they cause issues
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    
    // Test if we can access the logo URL
    if (finalOrderDetails.company_logo_url) {
      try {
        console.log('DEBUG: Testing logo URL accessibility:', finalOrderDetails.company_logo_url);
        const response = await page.goto(finalOrderDetails.company_logo_url, { waitUntil: 'networkidle0', timeout: 10000 });
        console.log('DEBUG: Logo URL response status:', response.status());
        if (response.status() !== 200) {
          console.log('DEBUG: Logo URL not accessible, status:', response.status());
        }
      } catch (error) {
        console.log('DEBUG: Error accessing logo URL:', error.message);
      }
    }
    
    // Try to set content with a more lenient wait condition
    try {
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (error) {
      console.log('DEBUG: setContent with domcontentloaded failed, trying without waitUntil:', error.message);
      await page.setContent(htmlContent, { timeout: 45000 });
    }

    const pdfBuffer = await page.pdf({
      format: 'A4', // Standard page format
      printBackground: true,
      margin: {
        top: '0.75in',
        right: '0.5in',
        bottom: '0.75in',
        left: '0.5in',
      }
    });
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating order invoice PDF with Puppeteer:', error);
    throw error; // Re-throw to be handled by the caller
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// --- Packing Slip Generation ---

async function getPackingSlipHtml(packingSlipData) {
  const companyName = packingSlipData.company_name || config.company.name;
  
  // Get logo from site settings first, then fall back to config
  let companyLogoUrl = packingSlipData.company_logo_url;
  if (!companyLogoUrl) {
    const siteLogo = await getSiteSetting('site_logo');
    companyLogoUrl = siteLogo || config.company.logoUrl;
  }
  
  const orderDate = new Date(packingSlipData.order_date).toLocaleDateString();

  const formatAddress = (addr, type) => {
    if (!addr) return `<p>No ${type} address provided.</p>`;
    return `
      <p>
        ${addr.line1 || ''}<br>
        ${addr.line2 || ''}${addr.line2 ? '<br>' : ''}
        ${addr.city || ''}, ${addr.state_province_region || ''} ${addr.postal_code || ''}<br>
        ${addr.country || ''}
      </p>
    `;
  };

  let itemsHtml = '';
  if (packingSlipData.items && packingSlipData.items.length > 0) {
    packingSlipData.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td>${item.sku || 'N/A'}</td>
          <td>
            ${item.product_name || 'N/A'}
            ${item.variant_description ? `<br><small>(${item.variant_description})</small>` : ''}
          </td>
          <td>${item.quantity_ordered}</td>
          ${packingSlipData.show_images ? `<td>${item.image_url ? `<img src="${item.image_url}" alt="${item.product_name}" style="width: 50px; height: auto;"/>` : ''}</td>` : ''}
        </tr>
      `;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Packing Slip - Order #${packingSlipData.order_id}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #333; }
        .container { width: 90%; margin: 0 auto; padding: 20px; }
        header { text-align: center; margin-bottom: 20px; }
        header img.logo { max-height: 70px; max-width: 180px; margin-bottom: 10px; }
        header h1 { margin: 0; font-size: 22px; }
        .slip-details { margin-bottom: 20px; overflow: hidden; }
        .slip-details .slip-id { float: left; font-size: 18px; font-weight: bold; }
        .slip-details .slip-date { float: right; text-align: right; }
        .shipping-address h3 { margin-top: 0; margin-bottom: 5px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        table.items-table th, table.items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
        table.items-table th { background-color: #f9f9f9; font-weight: bold; }
        footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; font-size: 10px; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName} Logo" class="logo"><br>` : ''}
          <h1>${companyName}</h1>
        </header>

        <section class="slip-details">
          <div class="slip-id">PACKING SLIP</div>
          <div class="slip-date">
            <p><strong>Order #:</strong> ${packingSlipData.order_id}</p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
          </div>
        </section>

        <section class="shipping-address">
          <h3>Ship To:</h3>
          ${formatAddress(packingSlipData.shipping_address, 'Shipping')}
          ${packingSlipData.customer_name ? `<p><strong>Attn:</strong> ${packingSlipData.customer_name}</p>` : ''}
          ${packingSlipData.customer_email ? `<p>Email: ${packingSlipData.customer_email}</p>` : ''}
        </section>

        <h3>Order Items:</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Qty Ordered</th>
              ${packingSlipData.show_images ? '<th>Image</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <footer>
          <p>Thank you for your order!</p>
          ${packingSlipData.fulfillment_validation_code ? `
          <div style="text-align: center; margin-top: 20px; padding: 15px; border: 2px dashed #ccc; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #333;">📦 Fulfillment Validation</h4>
            <p style="margin: 5px 0; font-size: 12px;">Scan this QR code to validate fulfillment:</p>
            <div style="text-align: center;">
              <img src="${packingSlipData.fulfillment_qr_code}" alt="Fulfillment QR Code" style="width: 100px; height: 100px;">
            </div>
            <p style="margin: 5px 0; font-family: monospace; font-size: 14px; font-weight: bold;">${packingSlipData.fulfillment_validation_code}</p>
          </div>
          ` : ''}
        </footer>
      </div>
    </body>
    </html>
  `;
}

async function generatePackingSlipPdf(packingSlipData) {
  let browser = null;
  try {
    // Optionally add show_images to packingSlipData if not already present
    const dataForHtml = { ...packingSlipData, show_images: packingSlipData.show_images !== undefined ? packingSlipData.show_images : true };
    const htmlContent = await getPackingSlipHtml(dataForHtml);

    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      }
    });
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating packing slip PDF with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// --- Refund Invoice Generation ---

async function getRefundInvoiceHtml(refundData) {
  const companyName = refundData.company_name || config.company.name;
  const companyAddress = refundData.company_address || config.company.address;
  
  // Get logo from site settings first, then fall back to config
  let companyLogoUrl = refundData.company_logo_url;
  if (!companyLogoUrl) {
    companyLogoUrl = await getSiteSetting('site_logo') || config.company.logoUrl;
  }
  
  const companyPhone = refundData.company_phone || config.company.phone;
  const companyEmail = refundData.company_email || config.company.email;
  
  const refundDate = new Date().toLocaleDateString();
  const refundType = refundData.refund.type === 'full' ? 'FULL REFUND' : 'PARTIAL REFUND';
  const refundAmount = parseFloat(refundData.refund.amount_this_transaction).toFixed(2);

  const formatAddress = (addr, type) => {
    if (!addr) return `<p>No ${type} address provided.</p>`;
    return `
      <p>
        ${addr.line1 || ''}<br>
        ${addr.line2 || ''}${addr.line2 ? '<br>' : ''}
        ${addr.city || ''}, ${addr.state_province_region || ''} ${addr.postal_code || ''}<br>
        ${addr.country || ''}
      </p>
    `;
  };

  let refundedItemsHtml = '';
  if (refundData.refund.items_processed && refundData.refund.items_processed.length > 0) {
    refundData.refund.items_processed.forEach(item => {
      const itemTotal = (parseFloat(item.price_at_purchase) * item.refunded_qty).toFixed(2);
      refundedItemsHtml += `
        <tr>
          <td>${item.sku || 'N/A'}</td>
          <td>${item.name}</td>
          <td>${item.refunded_qty}</td>
          <td>$${parseFloat(item.price_at_purchase).toFixed(2)}</td>
          <td>$${itemTotal}</td>
        </tr>
      `;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Refund Invoice - Order #${refundData.order.id}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.4; }
        .container { width: 90%; margin: 0 auto; padding: 20px; }
        header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        header img.logo { max-height: 80px; max-width: 200px; margin-bottom: 15px; }
        header h1 { margin: 0; font-size: 28px; color: #d32f2f; }
        header .refund-type { font-size: 18px; color: #d32f2f; font-weight: bold; margin-top: 5px; }
        .invoice-details { margin-bottom: 30px; overflow: hidden; }
        .invoice-details .invoice-id { float: left; font-size: 20px; font-weight: bold; }
        .invoice-details .invoice-date { float: right; text-align: right; }
        .customer-info { margin-bottom: 30px; }
        .customer-info h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .refund-summary { margin-bottom: 30px; background-color: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; }
        .refund-summary h3 { margin-top: 0; color: #e65100; }
        .refund-amount { font-size: 24px; font-weight: bold; color: #d32f2f; }
        table.refund-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        table.refund-items th, table.refund-items td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        table.refund-items th { background-color: #f5f5f5; font-weight: bold; }
        table.refund-items .total-row { background-color: #f9f9f9; font-weight: bold; }
        .refund-reason { margin-bottom: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
        .refund-reason h4 { margin-top: 0; color: #495057; }
        footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #777; }
        .company-info { text-align: center; margin-bottom: 20px; }
        .clear { clear: both; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName} Logo" class="logo"><br>` : ''}
          <h1>REFUND INVOICE</h1>
          <div class="refund-type">${refundType}</div>
        </header>

        <section class="invoice-details">
          <div class="invoice-id">Order #${refundData.order.id}</div>
          <div class="invoice-date">
            <p><strong>Refund Date:</strong> ${refundDate}</p>
            <p><strong>Refund Type:</strong> ${refundType}</p>
          </div>
          <div class="clear"></div>
        </section>

        <section class="customer-info">
          <h3>Customer Information:</h3>
          <p><strong>Name:</strong> ${refundData.user.name}</p>
          <p><strong>Email:</strong> ${refundData.user.email}</p>
          ${refundData.order.shipping_address ? `
            <h4>Shipping Address:</h4>
            ${formatAddress(refundData.order.shipping_address, 'Shipping')}
          ` : ''}
        </section>

        <section class="refund-summary">
          <h3>Refund Summary</h3>
          <p><strong>Total Refund Amount:</strong> <span class="refund-amount">$${refundAmount}</span></p>
          <p><strong>Refund Date:</strong> ${refundDate}</p>
          <p><strong>Refund Type:</strong> ${refundType}</p>
        </section>

        ${refundData.refund.reason ? `
          <section class="refund-reason">
            <h4>Refund Reason:</h4>
            <p>${refundData.refund.reason}</p>
          </section>
        ` : ''}

        <h3>Refunded Items:</h3>
        <table class="refund-items">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Quantity Refunded</th>
              <th>Unit Price</th>
              <th>Total Refunded</th>
            </tr>
          </thead>
          <tbody>
            ${refundedItemsHtml}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;"><strong>Total Refund Amount:</strong></td>
              <td><strong>$${refundAmount}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="company-info">
          <p><strong>${companyName}</strong></p>
          ${companyAddress ? `<p>${companyAddress}</p>` : ''}
          ${companyPhone ? `<p>Phone: ${companyPhone}</p>` : ''}
          ${companyEmail ? `<p>Email: ${companyEmail}</p>` : ''}
        </div>

        <footer>
          <p>This refund has been processed and will be reflected in your account within 3-5 business days.</p>
          <p>Thank you for your business!</p>
          <p>${companyName} - ${new Date().getFullYear()}</p>
        </footer>
      </div>
    </body>
    </html>
  `;
}

async function generateRefundInvoicePdf(refundData) {
  let browser = null;
  try {
    const htmlContent = await getRefundInvoiceHtml(refundData);

    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.75in',
        right: '0.5in',
        bottom: '0.75in',
        left: '0.5in',
      }
    });
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating refund invoice PDF with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
