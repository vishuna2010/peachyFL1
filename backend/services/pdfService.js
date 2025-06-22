const puppeteer = require('puppeteer');
// const JsBarcode = require('jsbarcode'); // Commented out
// const { createCanvas } = require('canvas'); // Commented out
const qrcode = require('qrcode');

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
};

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
          <td>
            ${item.product_name || 'N/A'}
            ${item.display_sku ? `<br><small style="font-size: 0.8em; color: #555;">SKU: ${item.display_sku}</small>` : ''}
          </td>
          <td>${item.tax_class_name_at_purchase || (item.tax_class_id_at_purchase ? `ID: ${item.tax_class_id_at_purchase}` : 'N/A')}</td>
          <td>${quantity}</td>
          <td class="text-right">${unitPrice.toFixed(2)}</td>
          <td class="text-right">${lineTotal.toFixed(2)}</td>
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
              <th>Tax Class</th>
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

// --- Packing Slip Generation ---

function getPackingSlipHtml(packingSlipData) {
  const companyName = packingSlipData.company_name || 'Your Awesome Store';
  const companyLogoUrl = packingSlipData.company_logo_url || null;
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
    const htmlContent = getPackingSlipHtml(dataForHtml);

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
