const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const config = require('../config'); // Import centralized configuration

// --- Transporter Setup ---
// This is an async function because createTestAccount is async
// In a real app, you'd initialize the transporter once when the app starts,
// using environment variables for a real SMTP provider.
let testAccount = null; // Cache the test account
let transporter = null;

async function getTestTransporter() {
  if (transporter && testAccount) { // Use cached transporter if available
    // Verify connection only if needed, or periodically. For Ethereal, it's usually fine.
    // console.log("Using cached Ethereal transporter.");
    return transporter;
  }

  try {
    testAccount = await nodemailer.createTestAccount();
    console.log('Ethereal test account created/retrieved:', testAccount);

    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
      // IMPORTANT: In a real app, use environment variables for these:
      // host: process.env.SMTP_HOST,
      // port: process.env.SMTP_PORT,
      // secure: process.env.SMTP_SECURE === 'true',
      // auth: {
      //   user: process.env.SMTP_USER,
      //   pass: process.env.SMTP_PASS,
      // },
      // tls: {
      //   // do not fail on invalid certs if using self-signed or local dev server
      //   rejectUnauthorized: process.env.NODE_ENV === 'production',
      // }
    });
    console.log("Ethereal transporter configured.");
    return transporter;
  } catch (error) {
    console.error("Error creating Ethereal test account or transporter:", error);
    // Fallback or throw error, depending on how critical email is at this stage
    // For now, we'll let it fail if it can't create a test account.
    throw new Error("Could not create email transporter.");
  }
}


// --- Send Email Function ---
async function sendEmail({ to, subject, text, html }) {
  try {
    const mailTransporter = await getTestTransporter();

    const mailOptions = {
      from: '"My E-commerce Store" <noreply@my-ecommerce.example.com>', // sender address
      to: to, // list of receivers (string or array)
      subject: subject, // Subject line
      text: text, // plain text body
      html: html, // html body
    };

    // Send mail with defined transport object
    let info = await mailTransporter.sendMail(mailOptions);

    console.log('Message sent: %s', info.messageId);
    // Preview URL will only be available if you are using Ethereal.email
    if (testAccount) { // Check if we are using an Ethereal test account
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// --- HTML Email Template for Order Confirmation (Refactored) ---
async function getOrderConfirmationHtml(orderData, customerEmail) {
    try {
        // The 'order' object in the template will expect fields like:
        // id, order_date, items (array), total_amount, shipping_address, billing_address,
        // subtotal, discount_applied { code, amount_deducted }, total_tax_amount, payment_status.
        // The 'customer' object will expect 'name'.

        let customerName = "Valued Customer";
        if (orderData.user && orderData.user.name) { // Assuming orderData might contain a nested user object
            customerName = orderData.user.name;
        } else if (typeof customerEmail === 'object' && customerEmail !== null && customerEmail.name) {
             // This case is less likely given current usage but kept for robustness
            customerName = customerEmail.name;
        } else if (typeof customerEmail === 'string' && customerEmail.includes('@')) {
            customerName = customerEmail.split('@')[0]; // Basic name from email
        } else if (typeof customerEmail === 'string' && customerEmail.length > 0) {
             customerName = customerEmail; // If customerEmail is already the name
        }


        const templateData = {
            order: {
                ...orderData,
                order_date: orderData.created_at || orderData.order_date,
                items: orderData.items.map(item => ({
                    ...item,
                    name: item.product_name || item.name,
                    price_at_purchase: item.priceAtPurchase || item.price_at_purchase
                })),
                // shipping_address and billing_address are assumed to be structured correctly in orderData
            },
            customer: {
                name: customerName
            },
            site: { // Add site-specific data for the template
                logoUrl: config.siteLogoUrl,
                name: config.siteName || 'Your Awesome Store'
            }
        };

        // Ensure subtotal, discount, tax are available and correctly formatted for the template
        // The template itself handles parseFloat and toFixed for display, but ensure values exist
        templateData.order.subtotal = orderData.original_total_amount !== undefined ? orderData.original_total_amount : (orderData.total_amount - (orderData.total_tax_amount || 0) + (orderData.discount_applied ? orderData.discount_applied.amount_deducted : 0));
        if (orderData.discount_code_applied && orderData.discount_amount_applied !== undefined) {
            templateData.order.discount_applied = {
                code: orderData.discount_code_applied,
                amount_deducted: orderData.discount_amount_applied
            };
        }


        const templatePath = path.join(__dirname, '..', 'email_templates', 'order_confirmation.ejs');
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const html = ejs.render(templateContent, templateData);
        return html;
    } catch (error) {
        console.error("Error rendering HTML email template:", error);
        return "<p>There was an error generating the order confirmation email. Please contact support.</p>";
    }
}

// --- Plain Text Email Template for Order Confirmation (Refactored) ---
function getOrderConfirmationText(orderData, customerEmail) {
    let customerName = "Valued Customer";
    if (orderData.user && orderData.user.name) {
        customerName = orderData.user.name;
    } else if (typeof customerEmail === 'string' && customerEmail.includes('@')) {
        customerName = customerEmail.split('@')[0];
    } else if (typeof customerEmail === 'string' && customerEmail.length > 0) {
        customerName = customerEmail;
    }

    let itemsSummary = "";
    if (orderData.items && orderData.items.length > 0) {
        orderData.items.forEach(item => {
            const price = parseFloat(item.priceAtPurchase || item.price_at_purchase || item.price || 0).toFixed(2);
            const lineTotal = (parseFloat(price) * item.quantity).toFixed(2);
            itemsSummary += `- ${item.product_name || item.name}: ${item.quantity} x $${price} = $${lineTotal}\n`;
        });
    }

    const subtotal = parseFloat(orderData.original_total_amount !== undefined ? orderData.original_total_amount : (orderData.total_amount - (orderData.total_tax_amount || 0) + (orderData.discount_applied ? orderData.discount_applied.amount_deducted : 0))).toFixed(2);
    const discountInfo = orderData.discount_applied && orderData.discount_applied.amount_deducted ? `Discount (${orderData.discount_applied.code}): -$${parseFloat(orderData.discount_applied.amount_deducted).toFixed(2)}\n` : "";
    const taxInfo = orderData.total_tax_amount !== undefined && orderData.total_tax_amount > 0 ? `Tax: $${parseFloat(orderData.total_tax_amount).toFixed(2)}\n` : "";

    const text = `
Dear ${customerName},

Thank you for your order!
We've received your order and will process it shortly.

Order ID: ${orderData.id}
Order Date: ${new Date(orderData.created_at || orderData.order_date).toLocaleDateString()}
Payment Status: ${orderData.payment_status || 'N/A'}

Order Summary:
${itemsSummary}
Subtotal: $${subtotal}
${discountInfo}${taxInfo}Grand Total: $${parseFloat(orderData.total_amount).toFixed(2)}

Shipping Address:
${orderData.shippingAddress?.line1 || orderData.shipping_address?.line1 || ''}
${orderData.shippingAddress?.line2 ? (orderData.shippingAddress.line2 + '\n') : ''}${orderData.shippingAddress?.city || orderData.shipping_address?.city || ''}, ${orderData.shippingAddress?.postalCode || orderData.shipping_address?.postalCode || ''}
${orderData.shippingAddress?.country || orderData.shipping_address?.country || ''}

If you have any questions, please contact our support team.
&copy; ${new Date().getFullYear()} Your Company Name
    `.trim();
    return text;
}

module.exports = {
  sendEmail,
  getOrderConfirmationHtml,
  getOrderConfirmationText,
  // For testing/debugging if needed:
  // getTestTransporter,
};
