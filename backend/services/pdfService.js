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
};
