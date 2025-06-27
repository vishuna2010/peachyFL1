const express = require('express');
const router = express.Router();
// const db = require('../db'); // No longer directly used by this route file
const { isAuthenticated, tryAuthenticate } = require('../auth'); // Using tryAuthenticate for POST /
const { sendEmail, getOrderConfirmationHtml, getOrderConfirmationText } = require('../services/emailService');
const orderService = require('../services/orderService'); // Import orderService
const { body, validationResult } = require('express-validator'); // For validation
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
      } else {
        console.warn(`No customer email found for order ${createdOrder.id}. Skipping confirmation email.`);
      }

    } catch (error) {
      next(error); // Pass errors from service (or pre-service validation) to global error handler
    }
  }
);


// GET /api/orders/my-history - Get order history for the authenticated user
// TODO: Refactor to use orderService
router.get('/my-history', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (isNaN(page) || page < 1) {
      page = 1;
    }
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 100) {
        limit = 100;
    }

    const offset = (page - 1) * limit;

    const ordersQuery = `
      SELECT o.id, o.created_at as order_date, o.total_amount, o.status,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const ordersResult = await db.query(ordersQuery, [userId, limit, offset]);

    const totalCountQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const totalCountResult = await db.query(totalCountQuery, [userId]);
    const totalOrders = parseInt(totalCountResult.rows[0].count);

    const totalPages = Math.ceil(totalOrders / limit);

    res.status(200).json({
      data: ordersResult.rows,
      pagination: {
        total: totalOrders,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    return next(error);
  }
});

// GET /api/orders/my-history/:orderId - Get details for a specific order for the authenticated user
// TODO: Refactor to use orderService
router.get('/my-history/:orderId', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const orderIdParam = req.params.orderId;

    const orderId = parseInt(orderIdParam);
    if (isNaN(orderId) || orderId <= 0) {
      throw new BadRequestError('Invalid order ID format.');
    }

    // Query for the specific order, ensuring it belongs to the user
    // Query for the specific order, ensuring it belongs to the user
    // Using created_at as order_date for consistency with the list view
    const orderQuery = 'SELECT *, created_at as order_date FROM orders WHERE id = $1 AND user_id = $2';
    const orderResult = await db.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found or does not belong to the current user.`);
    }
    const orderData = orderResult.rows[0]; // This will now include order_date aliased from created_at

    // Query for associated order items
    const itemsQuery = `
      SELECT
        oi.id as item_id,
        oi.product_id,
        oi.quantity,
        oi.price_at_purchase,
        p.name as product_name,
        p.image_url as product_image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `;
    const itemsResult = await db.query(itemsQuery, [orderId]);
    orderData.items = itemsResult.rows;

    // Construct final order object to match frontend mock structure where possible
    const responseOrder = {
       id: orderData.id,
       order_date: orderData.order_date,
       status: orderData.status,
       total_amount: parseFloat(orderData.total_amount),
       shipping_address: {
           line1: orderData.shipping_address_line1,
           line2: orderData.shipping_address_line2,
           city: orderData.shipping_city,
           postalCode: orderData.shipping_postal_code,
           country: orderData.shipping_country
       },
       billing_address: {
           line1: orderData.billing_address_line1 || orderData.shipping_address_line1,
           line2: orderData.billing_address_line2 || orderData.shipping_address_line2,
           city: orderData.billing_city || orderData.shipping_city,
           postalCode: orderData.billing_postal_code || orderData.shipping_postal_code,
           country: orderData.billing_country || orderData.shipping_country
       },
       items: orderData.items.map(item => ({
           item_id: item.item_id,
           product_id: item.product_id,
           name: item.product_name,
           quantity: item.quantity,
           price_at_purchase: parseFloat(item.price_at_purchase),
           image_url: item.product_image_url
       })),
       subtotal: orderData.original_total_amount ? parseFloat(orderData.original_total_amount) : parseFloat(orderData.total_amount) + (orderData.discount_amount_applied ? parseFloat(orderData.discount_amount_applied) : 0),
       discount_applied: orderData.discount_id ? {
           code: orderData.discount_code_applied,
           amount_deducted: parseFloat(orderData.discount_amount_applied)
       } : null,
       // These fields are not in the 'orders' table schema provided earlier, so they are commented out.
       // If they were added, they could be included here.
       // shipping_cost: 0.00,
       // payment_method: 'N/A'
    };

    if (orderData.original_total_amount === null && responseOrder.discount_applied) {
       responseOrder.subtotal = parseFloat(orderData.total_amount) + parseFloat(orderData.discount_amount_applied);
    } else if (orderData.original_total_amount === null && !responseOrder.discount_applied) {
       responseOrder.subtotal = parseFloat(orderData.total_amount);
    }

    res.status(200).json(responseOrder);

  } catch (error) {
    return next(error); // Pass to global error handler
  }
});

module.exports = router;
router.get('/my-history', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (isNaN(page) || page < 1) {
      page = 1;
    }
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 100) {
        limit = 100;
    }

    const offset = (page - 1) * limit;

    const ordersQuery = `
      SELECT o.id, o.created_at as order_date, o.total_amount, o.status,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const ordersResult = await db.query(ordersQuery, [userId, limit, offset]);

    const totalCountQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const totalCountResult = await db.query(totalCountQuery, [userId]);
    const totalOrders = parseInt(totalCountResult.rows[0].count);

    const totalPages = Math.ceil(totalOrders / limit);

    res.status(200).json({
      data: ordersResult.rows,
      pagination: {
        total: totalOrders,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    return next(error);
  }
});

// GET /api/orders/my-history/:orderId - Get details for a specific order for the authenticated user
router.get('/my-history/:orderId', isAuthenticated, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const orderIdParam = req.params.orderId;

    const orderId = parseInt(orderIdParam);
    if (isNaN(orderId) || orderId <= 0) {
      throw new BadRequestError('Invalid order ID format.');
    }

    // Query for the specific order, ensuring it belongs to the user
    // Query for the specific order, ensuring it belongs to the user
    // Using created_at as order_date for consistency with the list view
    const orderQuery = 'SELECT *, created_at as order_date FROM orders WHERE id = $1 AND user_id = $2';
    const orderResult = await db.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found or does not belong to the current user.`);
    }
    const orderData = orderResult.rows[0]; // This will now include order_date aliased from created_at

    // Query for associated order items
    const itemsQuery = `
      SELECT
        oi.id as item_id,
        oi.product_id,
        oi.quantity,
        oi.price_at_purchase,
        p.name as product_name,
        p.image_url as product_image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `;
    const itemsResult = await db.query(itemsQuery, [orderId]);
    orderData.items = itemsResult.rows;

    // Construct final order object to match frontend mock structure where possible
    const responseOrder = {
       id: orderData.id,
       order_date: orderData.order_date,
       status: orderData.status,
       total_amount: parseFloat(orderData.total_amount),
       shipping_address: {
           line1: orderData.shipping_address_line1,
           line2: orderData.shipping_address_line2,
           city: orderData.shipping_city,
           postalCode: orderData.shipping_postal_code,
           country: orderData.shipping_country
       },
       billing_address: {
           line1: orderData.billing_address_line1 || orderData.shipping_address_line1,
           line2: orderData.billing_address_line2 || orderData.shipping_address_line2,
           city: orderData.billing_city || orderData.shipping_city,
           postalCode: orderData.billing_postal_code || orderData.shipping_postal_code,
           country: orderData.billing_country || orderData.shipping_country
       },
       items: orderData.items.map(item => ({
           item_id: item.item_id,
           product_id: item.product_id,
           name: item.product_name,
           quantity: item.quantity,
           price_at_purchase: parseFloat(item.price_at_purchase),
           image_url: item.product_image_url
       })),
       subtotal: orderData.original_total_amount ? parseFloat(orderData.original_total_amount) : parseFloat(orderData.total_amount) + (orderData.discount_amount_applied ? parseFloat(orderData.discount_amount_applied) : 0),
       discount_applied: orderData.discount_id ? {
           code: orderData.discount_code_applied,
           amount_deducted: parseFloat(orderData.discount_amount_applied)
       } : null,
       // These fields are not in the 'orders' table schema provided earlier, so they are commented out.
       // If they were added, they could be included here.
       // shipping_cost: 0.00,
       // payment_method: 'N/A'
    };

    if (orderData.original_total_amount === null && responseOrder.discount_applied) {
       responseOrder.subtotal = parseFloat(orderData.total_amount) + parseFloat(orderData.discount_amount_applied);
    } else if (orderData.original_total_amount === null && !responseOrder.discount_applied) {
       responseOrder.subtotal = parseFloat(orderData.total_amount);
    }

    res.status(200).json(responseOrder);

  } catch (error) {
    return next(error); // Pass to global error handler
  }
});

module.exports = router;
