const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { isAuthenticated, checkPermission } = require('../auth');
const emailTrackingService = require('../services/emailTrackingService');
const { sendMarketingPromoEmailWithTracking } = require('../services/emailService');
const db = require('../db');

// GET /admin/email-campaigns - List all email campaigns
router.get('/email-campaigns', 
  isAuthenticated, 
  checkPermission('marketing:view_campaigns'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          ec.*,
          u.name as created_by_name,
          ROUND((ec.total_opens::DECIMAL / NULLIF(ec.total_sent, 0)) * 100, 2) as open_rate,
          ROUND((ec.total_clicks::DECIMAL / NULLIF(ec.total_sent, 0)) * 100, 2) as click_rate
        FROM email_campaigns ec
        LEFT JOIN users u ON ec.created_by = u.id
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM email_campaigns ec';
      let params = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        query += ` WHERE ec.status = $${paramCount}`;
        countQuery += ` WHERE ec.status = $${paramCount}`;
        params.push(status);
      }

      query += ` ORDER BY ec.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), offset);

      const [campaignsResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, status ? [status] : [])
      ]);

      const totalCampaigns = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCampaigns / limit);

      res.json({
        campaigns: campaignsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCampaigns,
          totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /admin/email-campaigns - Create a new email campaign
router.post('/email-campaigns',
  isAuthenticated,
  checkPermission('marketing:create_campaigns'),
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Campaign name is required and must be 1-255 characters'),
    body('subject').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Email subject is required and must be 1-255 characters'),
    body('template_name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Template name is required'),
    body('status').optional().isIn(['draft', 'scheduled', 'sent', 'paused']).withMessage('Invalid status'),
    body('scheduled_at').optional().isISO8601().withMessage('Invalid scheduled date format')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        name,
        subject,
        template_name,
        status = 'draft',
        scheduled_at
      } = req.body;

      const query = `
        INSERT INTO email_campaigns 
        (name, subject, template_name, status, scheduled_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await db.query(query, [
        name,
        subject,
        template_name,
        status,
        scheduled_at,
        req.user.userId
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// GET /admin/email-campaigns/:id - Get campaign details
router.get('/email-campaigns/:id',
  isAuthenticated,
  checkPermission('marketing:view_campaigns'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Invalid campaign ID')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;

      const query = `
        SELECT 
          ec.*,
          u.name as created_by_name
        FROM email_campaigns ec
        LEFT JOIN users u ON ec.created_by = u.id
        WHERE ec.id = $1
      `;

      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /admin/email-campaigns/:id - Update campaign
router.put('/email-campaigns/:id',
  isAuthenticated,
  checkPermission('marketing:edit_campaigns'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Invalid campaign ID'),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('subject').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('template_name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('status').optional().isIn(['draft', 'scheduled', 'sent', 'paused']),
    body('scheduled_at').optional().isISO8601()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const updateFields = req.body;

      // Build dynamic update query
      const setClause = Object.keys(updateFields)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const query = `
        UPDATE email_campaigns 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [id, ...Object.values(updateFields)]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /admin/email-campaigns/:id - Delete campaign
router.delete('/email-campaigns/:id',
  isAuthenticated,
  checkPermission('marketing:delete_campaigns'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Invalid campaign ID')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;

      const result = await db.query('DELETE FROM email_campaigns WHERE id = $1 RETURNING id', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// GET /admin/email-campaigns/:id/stats - Get campaign statistics
router.get('/email-campaigns/:id/stats',
  isAuthenticated,
  checkPermission('marketing:view_campaigns'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Invalid campaign ID')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const stats = await emailTrackingService.getCampaignStats(id);
      
      if (!stats) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// GET /admin/email-campaigns/:id/tracking - Get campaign tracking data
router.get('/email-campaigns/:id/tracking',
  isAuthenticated,
  checkPermission('marketing:view_campaigns'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Invalid campaign ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const trackingData = await emailTrackingService.getCampaignTrackingData(id, limit, offset);
      
      res.json({
        trackingData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          offset
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /admin/email-campaigns/:id/send - Send campaign to recipients
router.post('/email-campaigns/:id/send',
  isAuthenticated,
  checkPermission('marketing:send_campaigns'),
  [
    param('id').isInt({ gt: 0 }).withMessage('Invalid campaign ID'),
    body('recipients').isArray().withMessage('Recipients must be an array'),
    body('recipients.*.email').isEmail().withMessage('Invalid email address'),
    body('recipients.*.name').optional().isString().withMessage('Name must be a string')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { recipients } = req.body;

      // Get campaign details
      const campaignQuery = 'SELECT * FROM email_campaigns WHERE id = $1';
      const campaignResult = await db.query(campaignQuery, [id]);
      
      if (campaignResult.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const campaign = campaignResult.rows[0];

      // Update campaign status
      await db.query(
        'UPDATE email_campaigns SET status = $1, total_recipients = $2, sent_at = NOW() WHERE id = $3',
        ['sent', recipients.length, id]
      );

      // Send emails to recipients
      const results = [];
      for (const recipient of recipients) {
        try {
          const promoDetails = {
            subject: campaign.subject,
            promoTitle: campaign.name,
            promoMessageBody: `This is a campaign email for: ${campaign.name}`,
            ctaLink: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/campaigns/${id}`,
            ctaText: 'View Campaign'
          };

          const trackingData = {
            campaignId: id,
            userId: recipient.userId || null,
            messageId: `campaign_${id}_${Date.now()}_${Math.random()}`
          };

          const result = await sendMarketingPromoEmailWithTracking(
            recipient.email,
            recipient.name,
            promoDetails,
            trackingData
          );

          results.push({
            email: recipient.email,
            success: result.success,
            error: result.error
          });
        } catch (error) {
          results.push({
            email: recipient.email,
            success: false,
            error: error.message
          });
        }
      }

      // Update campaign with sent count
      const successCount = results.filter(r => r.success).length;
      await db.query(
        'UPDATE email_campaigns SET total_sent = $1 WHERE id = $2',
        [successCount, id]
      );

      res.json({
        message: `Campaign sent to ${successCount} recipients`,
        results
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /admin/email-unsubscribes - List unsubscribes
router.get('/email-unsubscribes',
  isAuthenticated,
  checkPermission('marketing:view_unsubscribes'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('email_type').optional().isString().withMessage('Email type must be a string')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { page = 1, limit = 20, email_type } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          eu.*,
          u.name as user_name,
          ec.name as campaign_name
        FROM email_unsubscribes eu
        LEFT JOIN users u ON eu.user_id = u.id
        LEFT JOIN email_campaigns ec ON eu.campaign_id = ec.id
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM email_unsubscribes eu';
      let params = [];
      let paramCount = 0;

      if (email_type) {
        paramCount++;
        query += ` WHERE eu.email_type = $${paramCount}`;
        countQuery += ` WHERE eu.email_type = $${paramCount}`;
        params.push(email_type);
      }

      query += ` ORDER BY eu.unsubscribed_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), offset);

      const [unsubscribesResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, email_type ? [email_type] : [])
      ]);

      const totalUnsubscribes = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalUnsubscribes / limit);

      res.json({
        unsubscribes: unsubscribesResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUnsubscribes,
          totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router; 