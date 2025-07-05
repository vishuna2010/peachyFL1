const express = require('express');
const router = express.Router();
const db = require('../db'); // Re-enabled for user lookup in email sending
const { isAuthenticated, tryAuthenticate } = require('../auth'); // Using tryAuthenticate for POST /
const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationText, sendInvoiceEmail } = require('../services/emailService'); // Added sendInvoiceEmail
const orderService = require('../services/orderService'); // Import orderService
const pdfService = require('../services/pdfService'); // Import pdfService
const config = require('../config'); // Import config for siteName, URLs etc.
const { body, query, param, validationResult } = require('express-validator'); // Corrected import
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/AppError'); // For direct error handling if needed pre-service call

// POST /api/orders - Create a new order
router.post(
  '/',
  tryAuthenticate, // Allows both authenticated and guest users
  [ // Basic validation for top-level structure. Service will do more detailed validation.
    body('cartItems').isArray({ min: 1 }).withMessage('Cart items must be a non-empty array.'),
    body('cartItems.*.productId').isInt({ gt: 0 }).withMessage('Each cart item must have a valid productId.'),
    body('cartItems.*.quantity').isInt({ gt: 0 }).withMessage('Each cart item must have a positive quantity.'),
    body('cartItems.*.productVariantId').optional().isInt({ gt: 0 }).withMessage('productVariantId must be a positive integer if provided.'),
    body('shippingAddress').isObject().withMessage('Shipping address must be an object.'),
    body('shippingAddress.line1').notEmpty().withMessage('Shipping address line1 is required.'),
    body('shippingAddress.city').notEmpty().withMessage('Shipping address city is required.'),
    body('shippingAddress.postalCode').notEmpty().withMessage('Shipping address postal code is required.'),
    body('shippingAddress.country').notEmpty().withMessage('Shipping address country is required.'),
    body('billingAddress').optional().isObject().withMessage('Billing address must be an object if provided.'),
    // Guest details validation if user is not authenticated
    body('guestDetails').custom((value, { req }) => {
      if (!req.user && !value) { // If not logged in, guestDetails are required
        throw new Error('Guest details are required for guest checkout.');
      }
      if (value && (!value.email || !value.firstName || !value.lastName)) {
        throw new Error('Guest email, firstName, and lastName are required if guestDetails are provided.');
      }
      return true;
    }),
    body('discount_code').optional().isString().trim(),
    body('mock_payment_successful').optional().isBoolean().toBoolean()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orderRequestData = {
      cartItems: req.body.cartItems,
      shippingAddress: req.body.shippingAddress,
      billingAddress: req.body.billingAddress,
      discount_code: req.body.discount_code,
      guestDetails: req.body.guestDetails,
      mock_payment_successful: req.body.mock_payment_successful
    };

    const authenticatedUser = req.user ? {
      userId: req.user.userId,
      // email, name, is_tax_exempt will be fetched by the service if needed
    } : null;

    try {
      const createdOrder = await orderService.createPublicOrder(orderRequestData, authenticatedUser);

      res.status(201).json({ message: 'Order created successfully.', order: createdOrder });

      // Email Sending Logic (remains in the route after successful order creation)
      // The service should return enough info (like userEmailForOrder, userNameForOrder) or the route can re-fetch minimal user details if needed.
      // For now, assuming `createdOrder` contains necessary details or we fetch them if not present.
      let userEmailForOrder = authenticatedUser ? req.user.email : orderRequestData.guestDetails.email; // Simplified, service might return this
      let userNameForOrder = authenticatedUser ? req.user.name : `${orderRequestData.guestDetails.firstName} ${orderRequestData.guestDetails.lastName}`; // Simplified

      if (createdOrder.user && createdOrder.user.email) { // If service returns enriched user info
          userEmailForOrder = createdOrder.user.email;
          userNameForOrder = createdOrder.user.name;
      } else if (!userEmailForOrder && createdOrder.user_id) { // Fallback: fetch minimal user details if service didn't return them
          const minimalUser = await db.query('SELECT email, name FROM users WHERE id = $1', [createdOrder.user_id]);
          if (minimalUser.rows.length > 0) {
              userEmailForOrder = minimalUser.rows[0].email;
              userNameForOrder = minimalUser.rows[0].name;
          }
      }


      if (userEmailForOrder) {
        // Construct emailOrderData based on `createdOrder` which is the rich object from service
        const emailOrderData = {
          id: createdOrder.id,
          status: createdOrder.status,
          payment_status: createdOrder.payment_status,
          total_amount: createdOrder.total_amount,
          original_total_amount: createdOrder.original_total_amount, // This is subtotal_exclusive_for_discount
          total_tax_amount: createdOrder.total_tax_amount,
          discount_code_applied: createdOrder.discount_code_applied,
          discount_amount_applied: createdOrder.discount_amount_applied,
          created_at: createdOrder.created_at,
          user: { name: userNameForOrder, email: userEmailForOrder },
          shippingAddress: createdOrder.shipping_address_line1 ? { // Reconstruct from flat structure if needed
              line1: createdOrder.shipping_address_line1,
              line2: createdOrder.shipping_address_line2,
              city: createdOrder.shipping_city,
              postalCode: createdOrder.shipping_postal_code,
              country: createdOrder.shipping_country,
          } : orderRequestData.shippingAddress, // Fallback to request data
          billingAddress: createdOrder.billing_address_line1 ? {
              line1: createdOrder.billing_address_line1,
              line2: createdOrder.billing_address_line2,
              city: createdOrder.billing_city,
              postalCode: createdOrder.billing_postal_code,
              country: createdOrder.billing_country,
          } : (orderRequestData.billingAddress || orderRequestData.shippingAddress),
          items: createdOrder.items.map(item => ({ // Assuming items are part of createdOrder from service
            name: item.product_name_at_purchase || item.product_name, // Adjust based on what service returns
            quantity: item.quantity,
            price_at_purchase: item.price_at_purchase,
            line_item_tax_amount: item.line_item_tax_amount,
          })),
          subtotal: createdOrder.original_total_amount, // This is subtotalExclusiveForDiscount
          discount_applied: createdOrder.discount_id ? { code: createdOrder.discount_code_applied, amount_deducted: createdOrder.discount_amount_applied } : null
        };

        (async () => {
          try {
            const emailHtml = await getOrderConfirmationHtml(emailOrderData, userEmailForOrder);
            const emailText = getOrderConfirmationText(emailOrderData, userEmailForOrder);
            sendEmail({
              to: userEmailForOrder,
              subject: `Order Confirmation #${createdOrder.id}`,
              text: emailText,
              html: emailHtml,
            }).then(emailResult => {
              if (emailResult.success) {
                console.log(`Order confirmation email sent for order ${createdOrder.id} to ${userEmailForOrder}. Preview: ${emailResult.previewUrl || 'N/A'}`);
              } else {
                console.error(`Failed to send order confirmation email for order ${createdOrder.id}: ${emailResult.error}`);
              }
            }).catch(emailError => console.error(`Error in sendEmail promise chain for order ${createdOrder.id}:`, emailError));
          } catch (templateError) {
            console.error(`Error generating email content for order ${createdOrder.id}:`, templateError);
          }
        })();

        // Generate and send Invoice PDF email
        (async () => {
          try {
            const siteNameFromConfig = config.company.name || 'Our Platform';
            const invoiceData = await orderService.getOrderDetailsForPdf(createdOrder.id, 'invoice');
            const pdfBuffer = await pdfService.generateOrderInvoicePdf(invoiceData);
            const pdfFileName = `Invoice-Order-${createdOrder.id}.pdf`;

            const emailBodyOptionalData = {
                orderTotal: createdOrder.total_amount,
                currencySymbol: '$', // TODO: Get from config or order details
                viewOrderLink: `${config.frontendUrlBase || 'http://localhost:3000'}/profile/orders/${createdOrder.id}`,
                supportEmail: config.email.supportAddress || config.email.fromAddress,
                companyAddress: config.company.address || ''
            };

            emailService.sendInvoiceEmail(
              userEmailForOrder,
              userNameForOrder,
              createdOrder.id,
              siteNameFromConfig,
              pdfBuffer,
              pdfFileName,
              emailBodyOptionalData
            )
            .then(emailRes => {
              if (emailRes.success) {
                console.log(`Invoice PDF email sent for order ${createdOrder.id} to ${userEmailForOrder}.`);
              } else {
                console.error(`Failed to send invoice PDF email for order ${createdOrder.id}: ${emailRes.error}`);
              }
            })
            .catch(err => {
              console.error(`Error dispatching invoice PDF email for order ${createdOrder.id}:`, err);
            });
          } catch (pdfOrEmailError) {
            console.error(`Error generating PDF or preparing invoice email for order ${createdOrder.id}:`, pdfOrEmailError);
          }
        })();

      } else {
        console.warn(`No customer email found for order ${createdOrder.id}. Skipping confirmation and invoice emails.`);
      }

    } catch (error) {
      next(error); // Pass errors from service (or pre-service validation) to global error handler
    }
  }
);


// GET /api/orders/my-history - Get order history for the authenticated user
router.get(
  '/my-history',
  isAuthenticated,
  [ // Add validators for pagination query parameters
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt() // Max limit can be adjusted
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { page, limit } = req.query; // These will be validated and sanitized

    try {
      const result = await orderService.getUserOrderHistory(userId, { page, limit });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/orders/my-history/:orderId - Get details for a specific order for the authenticated user
router.get(
  '/my-history/:orderId',
  isAuthenticated,
  [ // Add validator for orderId param
    param('orderId').isInt({ gt: 0 }).withMessage('Order ID must be a positive integer.').toInt()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { orderId } = req.params; // orderId is validated and sanitized

    try {
      const orderDetails = await orderService.getUserOrderDetails(userId, orderId);
      res.status(200).json(orderDetails);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
