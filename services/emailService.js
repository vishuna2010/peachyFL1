const nodemailer = require('nodemailer');

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

// --- HTML Email Template for Order Confirmation ---
function getOrderConfirmationHtml(order, customerEmail) {
  // order object should contain id, total_amount, and an items array
  // items array: { product_name (or similar), quantity, price_at_purchase }

  let itemsHtml = '<table style="width:100%; border-collapse: collapse;"><tr><th style="border: 1px solid #ddd; padding: 8px; text-align:left;">Product</th><th style="border: 1px solid #ddd; padding: 8px; text-align:left;">Quantity</th><th style="border: 1px solid #ddd; padding: 8px; text-align:left;">Price</th><th style="border: 1px solid #ddd; padding: 8px; text-align:left;">Total</th></tr>';
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name || item.name || `Product ID: ${item.productId}`}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">$${parseFloat(item.priceAtPurchase || item.price_at_purchase).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">$${(parseFloat(item.priceAtPurchase || item.price_at_purchase) * item.quantity).toFixed(2)}</td>
        </tr>
      `;
    });
  } else {
    itemsHtml += '<tr><td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align:center;">No items found in order details.</td></tr>';
  }
  itemsHtml += '</table>';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="color: #007bff;">Thank You for Your Order!</h1>
      <p>Hello ${customerEmail || 'Valued Customer'},</p>
      <p>We're excited to let you know that we've received your order and it's now being processed. Your order ID is: <strong>#${order.id}</strong>.</p>

      <h2 style="color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px;">Order Summary</h2>
      ${itemsHtml}

      <p style="font-size: 1.2em; margin-top: 20px;">
        <strong>Total Amount: $${parseFloat(order.total_amount).toFixed(2)}</strong>
      </p>

      <h3 style="color: #0056b3; margin-top: 30px;">Shipping Address:</h3>
      <p>
        ${order.shippingAddress?.line1 || order.shipping_address_line1}<br>
        ${order.shippingAddress?.line2 || order.shipping_address_line2 || ''}<br>
        ${order.shippingAddress?.city || order.shipping_city}, ${order.shippingAddress?.postalCode || order.shipping_postal_code}<br>
        ${order.shippingAddress?.country || order.shipping_country}
      </p>

      <p style="margin-top: 30px;">We'll send you another email once your order has shipped.</p>
      <p>Thank you for shopping with My E-commerce Store!</p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 0.9em; color: #777;">
        If you have any questions, please reply to this email or contact our support team.
      </p>
    </div>
  `;
}

function getOrderConfirmationText(order, customerEmail) {
    let itemsText = "Items:\n";
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            itemsText += `- ${item.product_name || item.name || `Product ID: ${item.productId}`}: ${item.quantity} x $${parseFloat(item.priceAtPurchase || item.price_at_purchase).toFixed(2)} = $${(parseFloat(item.priceAtPurchase || item.price_at_purchase) * item.quantity).toFixed(2)}\n`;
        });
    } else {
        itemsText += "- No items found in order details.\n";
    }

    return `
Thank You for Your Order!

Hello ${customerEmail || 'Valued Customer'},

We're excited to let you know that we've received your order and it's now being processed.
Your Order ID is: #${order.id}.

Order Summary:
${itemsText}

Total Amount: $${parseFloat(order.total_amount).toFixed(2)}

Shipping Address:
${order.shippingAddress?.line1 || order.shipping_address_line1}
${order.shippingAddress?.line2 ? (order.shippingAddress.line2 + '\n') : ''}${order.shippingAddress?.city || order.shipping_city}, ${order.shippingAddress?.postalCode || order.shipping_postal_code}
${order.shippingAddress?.country || order.shipping_country}

We'll send you another email once your order has shipped.
Thank you for shopping with My E-commerce Store!

If you have any questions, please reply to this email or contact our support team.
    `;
}


module.exports = {
  sendEmail,
  getOrderConfirmationHtml,
  getOrderConfirmationText,
  // For testing/debugging if needed:
  // getTestTransporter,
};
