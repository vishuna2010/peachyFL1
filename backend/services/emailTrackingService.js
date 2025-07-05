const db = require('../db');
const crypto = require('crypto');
const config = require('../config');

class EmailTrackingService {
  /**
   * Generate a unique tracking token for email tracking
   */
  generateTrackingToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a unique unsubscribe token
   */
  generateUnsubscribeToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a tracking record for an email
   */
  async createTrackingRecord(emailData) {
    const {
      campaignId,
      recipientEmail,
      recipientUserId,
      messageId,
      emailType,
      subject
    } = emailData;

    const trackingToken = this.generateTrackingToken();

    const query = `
      INSERT INTO email_tracking 
      (campaign_id, recipient_email, recipient_user_id, message_id, tracking_token, email_type, subject)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tracking_token
    `;

    const result = await db.query(query, [
      campaignId,
      recipientEmail,
      recipientUserId,
      messageId,
      trackingToken,
      emailType,
      subject
    ]);

    return result.rows[0];
  }

  /**
   * Record an email open
   */
  async recordEmailOpen(trackingToken, userAgent = null, ipAddress = null) {
    const query = `
      UPDATE email_tracking 
      SET 
        opened_at = CASE WHEN opened_at IS NULL THEN NOW() ELSE opened_at END,
        opened_count = opened_count + 1,
        user_agent = COALESCE($2, user_agent),
        ip_address = COALESCE($3, ip_address),
        updated_at = NOW()
      WHERE tracking_token = $1
      RETURNING id, recipient_email, email_type, campaign_id
    `;

    const result = await db.query(query, [trackingToken, userAgent, ipAddress]);
    
    if (result.rows.length > 0) {
      // Update campaign stats if this is a campaign email
      if (result.rows[0].campaign_id) {
        await this.updateCampaignStats(result.rows[0].campaign_id, 'opens');
      }
      return result.rows[0];
    }
    
    return null;
  }

  /**
   * Record an email click
   */
  async recordEmailClick(trackingToken, originalUrl, clickedUrl, userAgent = null, ipAddress = null) {
    // First, get the tracking record
    const trackingQuery = `
      SELECT id, recipient_email, email_type, campaign_id, clicked_count
      FROM email_tracking 
      WHERE tracking_token = $1
    `;
    
    const trackingResult = await db.query(trackingQuery, [trackingToken]);
    
    if (trackingResult.rows.length === 0) {
      return null;
    }

    const trackingRecord = trackingResult.rows[0];

    // Update the main tracking record
    const updateQuery = `
      UPDATE email_tracking 
      SET 
        clicked_at = CASE WHEN clicked_at IS NULL THEN NOW() ELSE clicked_at END,
        clicked_count = clicked_count + 1,
        last_clicked_url = $2,
        user_agent = COALESCE($3, user_agent),
        ip_address = COALESCE($4, ip_address),
        updated_at = NOW()
      WHERE tracking_token = $1
    `;

    await db.query(updateQuery, [trackingToken, clickedUrl, userAgent, ipAddress]);

    // Record the specific click
    const clickQuery = `
      INSERT INTO email_click_tracking 
      (tracking_id, original_url, clicked_url, user_agent, ip_address)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await db.query(clickQuery, [
      trackingRecord.id,
      originalUrl,
      clickedUrl,
      userAgent,
      ipAddress
    ]);

    // Update campaign stats if this is a campaign email
    if (trackingRecord.campaign_id) {
      await this.updateCampaignStats(trackingRecord.campaign_id, 'clicks');
    }

    return trackingRecord;
  }

  /**
   * Update campaign statistics
   */
  async updateCampaignStats(campaignId, statType) {
    const query = `
      UPDATE email_campaigns 
      SET 
        total_${statType} = total_${statType} + 1,
        updated_at = NOW()
      WHERE id = $1
    `;

    await db.query(query, [campaignId]);
  }

  /**
   * Check if a user is unsubscribed from a specific email type
   */
  async isUnsubscribed(email, emailType, campaignId = null) {
    let query = `
      SELECT id FROM email_unsubscribes 
      WHERE email = $1 AND (email_type = $2 OR email_type = 'all')
    `;
    
    let params = [email, emailType];

    if (campaignId) {
      query += ` AND (campaign_id = $3 OR campaign_id IS NULL)`;
      params.push(campaignId);
    }

    const result = await db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Unsubscribe a user from emails
   */
  async unsubscribe(email, emailType, campaignId = null, reason = null, userId = null) {
    const unsubscribeToken = this.generateUnsubscribeToken();

    const query = `
      INSERT INTO email_unsubscribes 
      (email, user_id, unsubscribe_token, email_type, campaign_id, reason)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (unsubscribe_token) DO NOTHING
      RETURNING id, unsubscribe_token
    `;

    const result = await db.query(query, [
      email,
      userId,
      unsubscribeToken,
      emailType,
      campaignId,
      reason
    ]);

    return result.rows[0];
  }

  /**
   * Resubscribe a user to emails
   */
  async resubscribe(email, emailType, campaignId = null) {
    let query = `
      DELETE FROM email_unsubscribes 
      WHERE email = $1 AND email_type = $2
    `;
    
    let params = [email, emailType];

    if (campaignId) {
      query += ` AND campaign_id = $3`;
      params.push(campaignId);
    }

    const result = await db.query(query, params);
    return result.rowCount > 0;
  }

  /**
   * Get email preferences for a user
   */
  async getEmailPreferences(userId, email) {
    const query = `
      SELECT * FROM email_preferences 
      WHERE user_id = $1 AND email = $2
    `;

    const result = await db.query(query, [userId, email]);
    return result.rows[0] || null;
  }

  /**
   * Update email preferences for a user
   */
  async updateEmailPreferences(userId, email, preferences) {
    const {
      marketing_emails,
      order_emails,
      promotional_emails,
      newsletter_emails
    } = preferences;

    const query = `
      INSERT INTO email_preferences 
      (user_id, email, marketing_emails, order_emails, promotional_emails, newsletter_emails)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, email) 
      DO UPDATE SET 
        marketing_emails = EXCLUDED.marketing_emails,
        order_emails = EXCLUDED.order_emails,
        promotional_emails = EXCLUDED.promotional_emails,
        newsletter_emails = EXCLUDED.newsletter_emails,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      email,
      marketing_emails,
      order_emails,
      promotional_emails,
      newsletter_emails
    ]);

    return result.rows[0];
  }

  /**
   * Get tracking statistics for a campaign
   */
  async getCampaignStats(campaignId) {
    const query = `
      SELECT 
        ec.id,
        ec.name,
        ec.subject,
        ec.total_recipients,
        ec.total_sent,
        ec.total_opens,
        ec.total_clicks,
        ROUND((ec.total_opens::DECIMAL / NULLIF(ec.total_sent, 0)) * 100, 2) as open_rate,
        ROUND((ec.total_clicks::DECIMAL / NULLIF(ec.total_sent, 0)) * 100, 2) as click_rate,
        ROUND((ec.total_clicks::DECIMAL / NULLIF(ec.total_opens, 0)) * 100, 2) as click_to_open_rate
      FROM email_campaigns ec
      WHERE ec.id = $1
    `;

    const result = await db.query(query, [campaignId]);
    return result.rows[0] || null;
  }

  /**
   * Get detailed tracking data for a campaign
   */
  async getCampaignTrackingData(campaignId, limit = 100, offset = 0) {
    const query = `
      SELECT 
        et.id,
        et.recipient_email,
        et.subject,
        et.sent_at,
        et.opened_at,
        et.opened_count,
        et.clicked_at,
        et.clicked_count,
        et.last_clicked_url,
        u.name as recipient_name
      FROM email_tracking et
      LEFT JOIN users u ON et.recipient_user_id = u.id
      WHERE et.campaign_id = $1
      ORDER BY et.sent_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [campaignId, limit, offset]);
    return result.rows;
  }

  /**
   * Generate tracking pixel HTML
   */
  generateTrackingPixel(trackingToken) {
    const trackingUrl = `${config.backendUrlBase}/api/track/email/open/${trackingToken}`;
    return `<img src="${trackingUrl}" alt="" width="1" height="1" style="display:none;" />`;
  }

  /**
   * Generate tracked link HTML
   */
  generateTrackedLink(originalUrl, trackingToken, linkText) {
    const trackingUrl = `${config.backendUrlBase}/api/track/email/click/${trackingToken}`;
    const encodedOriginalUrl = encodeURIComponent(originalUrl);
    const trackedUrl = `${trackingUrl}?url=${encodedOriginalUrl}`;
    
    return `<a href="${trackedUrl}" target="_blank">${linkText}</a>`;
  }

  /**
   * Generate unsubscribe link
   */
  generateUnsubscribeLink(email, emailType, campaignId = null) {
    const unsubscribeToken = this.generateUnsubscribeToken();
    const unsubscribeUrl = `${config.frontendUrlBase}/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(email)}&type=${emailType}`;
    
    if (campaignId) {
      unsubscribeUrl += `&campaign=${campaignId}`;
    }
    
    return unsubscribeUrl;
  }

  /**
   * Process email content to add tracking
   */
  async processEmailContent(htmlContent, trackingToken, emailType, campaignId = null) {
    let processedContent = htmlContent;

    // Add tracking pixel
    const trackingPixel = this.generateTrackingPixel(trackingToken);
    processedContent = processedContent.replace('</body>', `${trackingPixel}\n</body>`);

    // Add tracking to links (basic implementation - could be enhanced with regex)
    // This is a simplified version - in production you might want to use a proper HTML parser
    const linkRegex = /<a\s+href="([^"]+)"([^>]*)>([^<]+)<\/a>/gi;
    processedContent = processedContent.replace(linkRegex, (match, url, attributes, text) => {
      // Skip tracking for unsubscribe links
      if (url.includes('unsubscribe') || url.includes('track/email')) {
        return match;
      }
      
      const trackedLink = this.generateTrackedLink(url, trackingToken, text);
      return trackedLink;
    });

    // Add unsubscribe link if it's a marketing email
    if (emailType === 'marketing') {
      const unsubscribeLink = this.generateUnsubscribeLink('{{RECIPIENT_EMAIL}}', emailType, campaignId);
      const unsubscribeHtml = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          <p>If you no longer wish to receive these emails, you can <a href="${unsubscribeLink}">unsubscribe here</a>.</p>
        </div>
      `;
      processedContent = processedContent.replace('</body>', `${unsubscribeHtml}\n</body>`);
    }

    return processedContent;
  }
}

module.exports = new EmailTrackingService(); 