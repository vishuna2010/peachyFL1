// backend/routes/public.js
const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { AppError, BadRequestError, NotFoundError } = require('../utils/AppError'); // Import custom errors

// GET /api/public/delivery/confirm?orderId=...&token=...
router.get('/delivery/confirm', async (req, res, next) => {
  const { orderId, token } = req.query;

  if (!orderId || !token) {
    // Send a more user-friendly HTML response for direct browser access
    return res.status(400).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h1>Missing Information</h1>
          <p>Order ID and confirmation token are required.</p>
        </body>
      </html>
    `);
  }

  try {
    const result = await orderService.confirmOrderDelivery(orderId, token);
    // Send a user-friendly HTML success page
    res.status(200).send(`
      <html>
        <head><title>Delivery Confirmed</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #e6ffed;">
          <h1 style="color: #006400;">Delivery Confirmed!</h1>
          <p>Thank you. Delivery for Order #${result.orderId} has been successfully confirmed at ${new Date(result.delivery_confirmed_at).toLocaleString()}.</p>
          <p>Status: ${result.status}</p>
        </body>
      </html>
    `);
  } catch (error) {
    let statusCode = 500;
    let clientMessage = 'An unexpected error occurred while confirming delivery.';

    if (error instanceof NotFoundError) {
      statusCode = 404;
      clientMessage = error.message;
    } else if (error instanceof BadRequestError) {
      statusCode = 400; // Or 401/403 depending on specific token error if we refine error codes
      clientMessage = error.message;
    } else if (error instanceof AppError) {
      // Use AppError's status if available and reasonable for public display
      statusCode = (error.statusCode >= 400 && error.statusCode < 500) ? error.statusCode : 500;
      clientMessage = (error.statusCode >= 400 && error.statusCode < 500) ? error.message : 'Error processing request.';
    }

    console.error(`[GET /public/delivery/confirm] Error for orderId ${orderId}:`, error);
    // Send a user-friendly HTML error page
    res.status(statusCode).send(`
      <html>
        <head><title>Confirmation Failed</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #ffe6e6;">
          <h1 style="color: #990000;">Delivery Confirmation Failed</h1>
          <p>${clientMessage}</p>
          <p>Please check the link or contact support if the issue persists.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;
