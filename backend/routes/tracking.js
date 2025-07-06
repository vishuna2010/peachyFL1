const express = require('express');
const router = express.Router();
const emailTrackingService = require('../services/emailTrackingService');

// GET /api/track/email/open/:trackingToken - Track email opens
router.get('/email/open/:trackingToken', async (req, res) => {
  try {
    const { trackingToken } = req.params;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Record the email open
    const trackingRecord = await emailTrackingService.recordEmailOpen(trackingToken, userAgent, ipAddress);

    if (!trackingRecord) {
      console.warn(`Email open tracking failed: Invalid tracking token ${trackingToken}`);
      // Return a 1x1 transparent GIF for tracking pixel
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.send(transparentGif);
    }

    console.log(`Email opened: ${trackingRecord.recipient_email} (${trackingRecord.email_type})`);

    // Return a 1x1 transparent GIF for tracking pixel
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(transparentGif);

  } catch (error) {
    console.error('Error tracking email open:', error);
    // Still return the tracking pixel even if there's an error
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(transparentGif);
  }
});

// GET /api/track/email/click/:trackingToken - Track email clicks
router.get('/email/click/:trackingToken', async (req, res) => {
  try {
    const { trackingToken } = req.params;
    const { url } = req.query;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!url) {
      console.warn(`Email click tracking failed: No URL provided for token ${trackingToken}`);
      return res.redirect('/');
    }

    // Record the email click
    const trackingRecord = await emailTrackingService.recordEmailClick(
      trackingToken,
      url,
      url, // clickedUrl is the same as originalUrl in this case
      userAgent,
      ipAddress
    );

    if (!trackingRecord) {
      console.warn(`Email click tracking failed: Invalid tracking token ${trackingToken}`);
      return res.redirect(url);
    }

    console.log(`Email clicked: ${trackingRecord.recipient_email} -> ${url}`);

    // Redirect to the original URL
    res.redirect(url);

  } catch (error) {
    console.error('Error tracking email click:', error);
    // Still redirect to the URL even if there's an error
    const { url } = req.query;
    res.redirect(url || '/');
  }
});

// GET /api/track/email/unsubscribe - Handle unsubscribe requests
router.get('/email/unsubscribe', async (req, res) => {
  try {
    const { token, email, type, campaign } = req.query;

    if (!token || !email || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    // Verify the unsubscribe token and process unsubscribe
    const unsubscribeResult = await emailTrackingService.unsubscribe(
      email,
      type,
      campaign || null,
      'User requested unsubscribe via link',
      null // userId will be looked up if needed
    );

    if (!unsubscribeResult) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid unsubscribe request' 
      });
    }

    // Redirect to frontend unsubscribe confirmation page
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe/confirmed?email=${encodeURIComponent(email)}&type=${type}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process unsubscribe request' 
    });
  }
});

// GET /api/track/email/resubscribe - Handle resubscribe requests
router.get('/email/resubscribe', async (req, res) => {
  try {
    const { email, type, campaign } = req.query;

    if (!email || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    // Process resubscribe
    const resubscribeResult = await emailTrackingService.resubscribe(
      email,
      type,
      campaign || null
    );

    if (!resubscribeResult) {
      return res.status(400).json({ 
        success: false, 
        error: 'No unsubscribe record found to resubscribe' 
      });
    }

    // Redirect to frontend resubscribe confirmation page
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resubscribe/confirmed?email=${encodeURIComponent(email)}&type=${type}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error processing resubscribe:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process resubscribe request' 
    });
  }
});

// POST /api/email/resubscribe - Admin resubscribe endpoint
router.post('/email/resubscribe', async (req, res) => {
  try {
    const { email, email_type } = req.body;

    if (!email || !email_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: email and email_type' 
      });
    }

    // Process resubscribe
    const resubscribeResult = await emailTrackingService.resubscribe(
      email,
      email_type,
      null // campaignId
    );

    if (!resubscribeResult) {
      return res.status(400).json({ 
        success: false, 
        error: 'No unsubscribe record found to resubscribe' 
      });
    }

    res.json({ 
      success: true, 
      message: 'User resubscribed successfully',
      data: resubscribeResult
    });

  } catch (error) {
    console.error('Error processing resubscribe:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process resubscribe request' 
    });
  }
});

module.exports = router; 