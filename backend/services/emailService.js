const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const config = require('../config'); // Import the centralized config

// --- Transporter Setup ---
let transporterInstance = null;
let etherealTestAccount = null; // To store Ethereal account details if used

async function initializeTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  try {
    if (config.email.service === 'ethereal' || (!config.email.host && config.nodeEnv === 'development')) {
      // Use Ethereal for development if explicitly set or no other config provided
      if (!etherealTestAccount) { // Create account only once
        etherealTestAccount = await nodemailer.createTestAccount();
        console.log('Ethereal test account created/retrieved:', etherealTestAccount.user);
      }
      transporterInstance = nodemailer.createTransport({
        host: etherealTestAccount.smtp.host,
        port: etherealTestAccount.smtp.port,
        secure: etherealTestAccount.smtp.secure,
        auth: {
          user: etherealTestAccount.user,
          pass: etherealTestAccount.pass,
        },
      });
      console.log("Ethereal transporter configured.");
    } else if (config.email.service === 'console') {
        // Simple console logger for email, useful for CI or when no email service is configured
        transporterInstance = {
            sendMail: async (mailOptions) => {
                console.log("--- CONSOLE EMAIL ---");
                console.log("To:", mailOptions.to);
                console.log("From:", mailOptions.from);
                console.log("Subject:", mailOptions.subject);
                console.log("Text Body:", mailOptions.text);
                // console.log("HTML Body:", mailOptions.html); // Optional: log HTML too
                console.log("--- END CONSOLE EMAIL ---");
                const messageId = `console-${Date.now()}@example.com`;
                return { messageId, response: "250 OK: message queued for delivery via console." };
            }
        };
        console.log("Console email transporter configured.");
    } else if (config.email.host) {
      // Use configured SMTP provider
      transporterInstance = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
        tls: {
          rejectUnauthorized: config.nodeEnv === 'production', // Stricter in prod
        }
      });
      console.log(`SMTP transporter configured for host: ${config.email.host}`);
    } else {
      console.warn("Email service is not configured. Emails will not be sent. Consider setting up Ethereal for development or a real SMTP provider.");
      // Fallback to a dummy transporter that does nothing but logs a warning
      transporterInstance = {
        sendMail: async (mailOptions) => {
          console.warn(`Email not sent (service not configured): To: ${mailOptions.to}, Subject: ${mailOptions.subject}`);
          return { messageId: `dummy-${Date.now()}`, response: "dummy - not sent" };
        }
      };
    }
    return transporterInstance;
  } catch (error) {
    console.error("Error creating email transporter:", error);
    throw new Error("Could not create email transporter.");
  }
}

// Initialize transporter when module loads or on first call
// initializeTransporter(); // Optional: initialize on load, or let sendEmail handle it.

// --- Send Email Function ---
async function sendEmail({ to, subject, text, html }) {
  try {
    const mailTransporter = await initializeTransporter(); // Ensures transporter is ready

    const mailOptions = {
      from: config.email.fromAddress, // Use fromAddress from config
      to: to,
      subject: subject,
      text: text,
      html: html,
    };

    let info = await mailTransporter.sendMail(mailOptions);

    // console.log('Message sent: %s', info.messageId); // Less verbose logging
    let previewUrl = null;
    if (etherealTestAccount && info.messageId && nodemailer.getTestMessageUrl(info)) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`Email sent via Ethereal. Message ID: ${info.messageId}. Preview URL: ${previewUrl}`);
    } else if (config.email.service === 'console') {
        console.log(`Email logged to console. Message ID: ${info.messageId}`);
    } else {
      console.log(`Email sent. Message ID: ${info.messageId}.`);
    }
    return { success: true, messageId: info.messageId, previewUrl: previewUrl };
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
&copy; ${new Date().getFullYear()} ${config.company.name}
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

// --- HTML Email Template for Refund Confirmation ---
async function getRefundConfirmationHtml(refundData) {
    // refundData expected structure:
    // {
    //   order: { id: orderId, /* ... other order details if needed ... */ },
    //   user: { name: customerName, email: customerEmail },
    //   refund: {
    //     type: 'full' | 'partial',
    //     reason: 'Optional reason string',
    //     amount_this_transaction: totalAmountRefundedThisTime,
    //     items_processed: [ { name, sku, refunded_qty, price_at_purchase }, ... ]
    //   }
    // }
    try {
        const templatePath = path.join(__dirname, '..', 'email_templates', 'refund_confirmation.ejs');
        const templateContent = fs.readFileSync(templatePath, 'utf-8');

        // Ensure numbers are formatted for display if not already
        const displayData = {
            ...refundData,
            refund: {
                ...refundData.refund,
                amount_this_transaction: Number(refundData.refund.amount_this_transaction).toFixed(2),
                items_processed: refundData.refund.items_processed.map(item => ({
                    ...item,
                    price_at_purchase: Number(item.price_at_purchase).toFixed(2)
                }))
            }
        };
        const html = ejs.render(templateContent, displayData);
        return html;
    } catch (error) {
        console.error("Error rendering HTML refund email template:", error);
        return "<p>There was an error generating the refund confirmation email. Please contact support.</p>";
    }
}

// --- Plain Text Email Template for Refund Confirmation ---
function getRefundConfirmationText(refundData) {
    let itemsSummary = "";
    if (refundData.refund.items_processed && refundData.refund.items_processed.length > 0) {
        refundData.refund.items_processed.forEach(item => {
            const price = Number(item.price_at_purchase).toFixed(2);
            const lineTotal = (Number(item.price_at_purchase) * item.refunded_qty).toFixed(2);
            itemsSummary += `- ${item.name} (SKU: ${item.sku || 'N/A'}): ${item.refunded_qty} x $${price} = $${lineTotal} (refunded)\n`;
        });
    }

    const reasonText = refundData.refund.reason ? `Reason: ${refundData.refund.reason}\n` : "";

    const text = `
Dear ${refundData.user.name || 'Customer'},

This email confirms that a ${refundData.refund.type} refund has been processed for your Order ID: #${refundData.order.id}.

${reasonText}
Total Amount Refunded in this Transaction: $${Number(refundData.refund.amount_this_transaction).toFixed(2)}
Date Processed: ${new Date().toLocaleDateString()}

Items Refunded in this Transaction:
${itemsSummary || "No specific items listed for this refund (e.g., full order refund based on total amount).\n"}
The refunded amount should reflect in your account within a few business days.
If you have any questions, please contact our support team.

Thank you,
${config.company.name}
    `.trim();
    return text;
}

module.exports = {
  sendEmail,
  getOrderConfirmationHtml,
  getOrderConfirmationText,
  getRefundConfirmationHtml,
  getRefundConfirmationText,
  sendWelcomeEmail, // Added new function
  // For testing/debugging if needed:
  // getTestTransporter,
};


// --- Welcome Email Function ---
/**
 * Sends a welcome email to a new user.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} userName - The name of the user.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, previewUrl?: string}>}
 */
async function sendWelcomeEmail(toEmail, userName) {
  try {
    const siteName = config.company.name || 'Our Platform'; // Get from config
    const shopLink = config.frontendUrlBase || 'http://localhost:3000'; // Get from config
    const profileLink = `${shopLink}/profile`; // Example profile link
    const supportEmail = config.email.supportAddress || config.email.fromAddress; // Get from config
    const companyAddress = config.company.address || '';


    const templatePath = path.join(__dirname, '..', 'email_templates', 'welcome_email.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const htmlContent = ejs.render(templateContent, {
      siteName,
      userName,
      shopLink,
      profileLink,
      supportEmail,
      companyAddress,
      // unsubscribeLink: `${shopLink}/unsubscribe?email=${encodeURIComponent(toEmail)}` // Optional
    });

    // Basic plain text version (can be improved or generated from HTML)
    const textContent = `
Welcome to ${siteName}, ${userName}!

Thank you for signing up. We're thrilled to have you join our community!

Get started by exploring our latest products: ${shopLink}
Or complete your profile: ${profileLink}

If you have any questions, contact our support team at ${supportEmail}.

Best regards,
The ${siteName} Team

---
&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.
${companyAddress}
    `.trim();

    return sendEmail({
      to: toEmail,
      subject: `Welcome to ${siteName}!`,
      text: textContent,
      html: htmlContent,
    });

  } catch (error) {
    console.error(`Error preparing or sending welcome email to ${toEmail}:`, error);
    // Return a similar structure as sendEmail for consistency in error handling by caller
    return { success: false, error: `Failed to send welcome email: ${error.message}` };
  }
}
