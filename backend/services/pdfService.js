const puppeteer = require('puppeteer');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas'); // Node canvas for jsbarcode

/**
 * Generates a barcode as a data URL.
 * @param {string} text - The text to encode in the barcode.
 * @param {object} options - Options for JsBarcode.
 * @returns {string} The barcode image as a data URL (PNG).
 */
function generateBarcodeDataURL(text, options = {}) {
  const canvas = createCanvas(200, 100); // Dimensions can be adjusted
  JsBarcode(canvas, text, {
    format: 'CODE128', // Common format, can be changed
    displayValue: true, // Display the text below the barcode
    fontSize: 18,
    margin: 10,
    ...options,
  });
  return canvas.toDataURL('image/png');
}

/**
 * Generates an HTML string for the product label.
 * @param {object} product - Product object containing name, sku, price.
 * @param {string} barcodeDataUrl - The data URL of the generated barcode.
 * @returns {string} HTML string for the label.
 */
function getProductLabelHtml(product, barcodeDataUrl) {
  const price = parseFloat(product.price).toFixed(2);
  const sku = product.sku || `ID: ${product.id}`; // Fallback to ID if SKU is not available

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Product Label</title>
      <style>
        body { font-family: Arial, sans-serif; width: 300px; /* Approx label width */ padding: 10px; text-align: center; border: 1px solid #ccc; }
        h1 { font-size: 20px; margin: 5px 0; }
        p { font-size: 14px; margin: 3px 0; }
        .sku { font-size: 12px; margin-bottom: 5px; }
        .price { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        img.barcode { display: block; margin: 0 auto; max-width: 90%; height: auto; }
      </style>
    </head>
    <body>
      <h1>${product.name}</h1>
      <p class="sku">SKU: ${sku}</p>
      <p class="price">$${price}</p>
      ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="Barcode for ${sku}" class="barcode" />` : '<p>No barcode generated.</p>'}
    </body>
    </html>
  `;
}

/**
 * Generates a product label PDF.
 * @param {object} product - Product object (id, name, sku, price).
 * @returns {Promise<Buffer>} A Promise that resolves with the PDF buffer.
 */
async function generateProductLabelPdf(product) {
  let browser = null;
  try {
    const barcodeText = product.sku || product.id.toString(); // Use SKU or ID for barcode
    if (!barcodeText) {
        console.warn(`No SKU or ID available for product ${product.name} to generate barcode.`);
        // Decide if barcode is optional or required. For now, proceed without if no text.
    }
    const barcodeDataUrl = barcodeText ? generateBarcodeDataURL(barcodeText) : null;
    const htmlContent = getProductLabelHtml(product, barcodeDataUrl);

    // Launch Puppeteer
    // Note: In some environments (like certain Lambdas or containers), you might need
    // 'puppeteer-core' and provide an executablePath for Chrome, or use args like '--no-sandbox'.
    browser = await puppeteer.launch({
        headless: true, // Ensure it's headless for server-side use
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Often needed in restricted environments
    });
    const page = await browser.newPage();

    // Set content to our generated HTML
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    // Common label sizes: e.g., 4x2 inches. Puppeteer uses points (72 DPI).
    // 3 inches width = 216 points. 1.5 inches height = 108 points.
    // These are approximate and depend on desired label output.
    const pdfBuffer = await page.pdf({
      // width: '3in', // Example: 3 inches wide
      // height: '1.5in', // Example: 1.5 inches tall
      // Instead of fixed size, we can let it fit content or use a format like 'Letter' and scale.
      // For a single label, fitting content is usually fine if HTML is styled to a fixed width.
      printBackground: true, // If your HTML has background colors/images
      // format: 'A7', // Small standard format, or omit for content-based size
      margin: { // Minimal margins
        top: '0.1in',
        right: '0.1in',
        bottom: '0.1in',
        left: '0.1in',
      }
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
};

function getInvoiceHtml(orderDetails) {
  // --- Company Details (Placeholders or from orderDetails if available) ---
  const companyName = orderDetails.company_name || 'Your Awesome Store';
  const companyAddress = orderDetails.company_address || '123 Commerce St, Business City, BC 12345';
  const companyLogoUrl = orderDetails.company_logo_url || null; // e.g., 'https://yourstore.com/logo.png'

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
      const unitPrice = parseFloat(item.price_at_purchase);
      const quantity = parseInt(item.quantity);
      const lineTotal = unitPrice * quantity;
      calculatedSubtotal += lineTotal;
      itemsHtml += `
        <tr>
          <td>${item.product_name || 'N/A'}</td>
          <td>${quantity}</td>
          <td>${unitPrice.toFixed(2)}</td>
          <td>${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    });
  }
  calculatedSubtotal = parseFloat(calculatedSubtotal.toFixed(2));

  // --- Totals ---
  // Use original_total_amount if available (pre-discount subtotal), else use calculated or total_amount
  const subtotal = orderDetails.original_total_amount
    ? parseFloat(orderDetails.original_total_amount)
    : (orderDetails.discount_amount_applied ? parseFloat(orderDetails.total_amount) + parseFloat(orderDetails.discount_amount_applied) : parseFloat(orderDetails.total_amount));

  const discountHtml = orderDetails.discount_amount_applied && parseFloat(orderDetails.discount_amount_applied) > 0
    ? `<tr><td colspan="3" class="text-right">Discount ${orderDetails.discount_code_applied ? `(${orderDetails.discount_code_applied})` : ''}:</td><td>-${parseFloat(orderDetails.discount_amount_applied).toFixed(2)}</td></tr>`
    : '';

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
        header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
        header img.logo { max-height: 80px; max-width: 200px; margin-bottom: 10px; }
        header h1 { margin: 0; font-size: 24px; }
        header p { margin: 2px 0; font-size: 12px; }
        .invoice-details { margin-bottom: 30px; overflow: hidden; }
        .invoice-details .invoice-id { float: left; font-size: 20px; font-weight: bold; }
        .invoice-details .invoice-date { float: right; text-align: right; }
        .addresses { margin-bottom: 30px; overflow: hidden; }
        .addresses .address-block { width: 48%; float: left; }
        .addresses .address-block.shipping { float: right; }
        .addresses h3 { margin-top: 0; margin-bottom: 5px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px;}
        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        table.items-table th, table.items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        table.items-table th { background-color: #f9f9f9; font-weight: bold; }
        table.items-table td.text-right, table.items-table th.text-right { text-align: right; }
        .totals-section { float: right; width: 40%; margin-top: 20px; }
        .totals-section table { width: 100%; }
        .totals-section td { padding: 5px 0; }
        .totals-section td.text-right { text-align: right; }
        .totals-section .grand-total td { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
        footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName} Logo" class="logo"><br>` : ''}
          <h1>${companyName}</h1>
          <p>${companyAddress}</p>
          ${orderDetails.company_phone ? `<p>Phone: ${orderDetails.company_phone}</p>` : ''}
          ${orderDetails.company_email ? `<p>Email: ${orderDetails.company_email}</p>` : ''}
          ${orderDetails.company_website ? `<p>Website: ${orderDetails.company_website}</p>` : ''}
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

        <h3>Order Items:</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <section class="totals-section">
          <table>
            <tr>
              <td>Subtotal:</td>
              <td class="text-right">${subtotal.toFixed(2)}</td>
            </tr>
            ${discountHtml}
            <tr class="grand-total">
              <td>Grand Total:</td>
              <td class="text-right">${grandTotal}</td>
            </tr>
          </table>
        </section>

        <footer>
          <p>Thank you for your business!</p>
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
    const htmlContent = getInvoiceHtml(orderDetails);

    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

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
