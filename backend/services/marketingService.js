// backend/services/marketingService.js

const userService = require('./userService');
const emailService = require('./emailService');
const { AppError } = require('../utils/AppError');

/**
 * Sends a promotional email to a segment of users.
 * For this initial version, segmentType 'all_users' is implicitly used.
 *
 * @param {object} promoDetails - Details for the promotion.
 * @param {string} promoDetails.subject - The subject of the email.
 * @param {string} [promoDetails.promoTitle] - Optional title for the promo content.
 * @param {string} promoDetails.promoMessageBody - The main HTML body of the promo.
 * @param {string} promoDetails.ctaLink - The URL for the call-to-action button.
 * @param {string} promoDetails.ctaText - The text for the call-to-action button.
 * @param {string} [segmentType='all_users'] - The type of segment to target (currently ignored, defaults to all).
 * @returns {Promise<object>} A summary of the email sending operation.
 *                            e.g., { totalUsersAttempted: number, emailsSentSuccessfully: number, emailsFailed: number, errors: Array<string> }
 * @throws {AppError} If there's a critical error fetching users or if promoDetails are invalid.
 */
async function sendPromotionalEmailToSegment(promoDetails, segmentType = 'all_users') {
  if (!promoDetails || !promoDetails.subject || !promoDetails.promoMessageBody || !promoDetails.ctaLink || !promoDetails.ctaText) {
    throw new AppError('Invalid promotional details provided. Subject, message body, CTA link, and CTA text are required.', 400, 'INVALID_PROMO_DETAILS');
  }

  let users = [];
  try {
    // For now, segmentType is ignored, and we fetch all "subscribed" users.
    // Future enhancements would use segmentType to call different userService methods.
    users = await userService.getAllMarketingSubscribers();
  } catch (error) {
    console.error('Error fetching users for marketing email:', error);
    throw new AppError('Failed to fetch users for marketing campaign.', 500, 'MARKETING_USER_FETCH_FAILED', error);
  }

  if (!users || users.length === 0) {
    return {
      totalUsersAttempted: 0,
      emailsSentSuccessfully: 0,
      emailsFailed: 0,
      errors: [],
      message: 'No users found in the target segment to send emails to.'
    };
  }

  let emailsSentSuccessfully = 0;
  let emailsFailed = 0;
  const errorMessages = [];

  // TODO: Implement proper batching and rate limiting for large volumes.
  // For now, sending sequentially with a small delay to be kind to email services/logging.
  for (const user of users) {
    try {
      // Construct user name for personalization
      let userName = 'Valued Customer'; // Default
      if (user.name) {
        userName = user.name;
      } else if (user.first_name) {
        userName = user.first_name;
      }
      // Could also add user.last_name if desired for "Hi FirstName LastName,"

      const result = await emailService.sendMarketingPromoEmail(user.email, userName, promoDetails);
      if (result.success) {
        emailsSentSuccessfully++;
        // Optional: Small delay between emails
        // await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      } else {
        emailsFailed++;
        errorMessages.push(`Failed to send to ${user.email}: ${result.error || 'Unknown error'}`);
        console.warn(`Marketing email failed for ${user.email}: ${result.error}`);
      }
    } catch (error) {
      emailsFailed++;
      errorMessages.push(`Critical error sending to ${user.email}: ${error.message}`);
      console.error(`Critical error sending marketing email to ${user.email}:`, error);
    }
  }

  return {
    totalUsersAttempted: users.length,
    emailsSentSuccessfully,
    emailsFailed,
    errors: errorMessages,
    message: `Marketing email campaign processed. Attempted: ${users.length}, Succeeded: ${emailsSentSuccessfully}, Failed: ${emailsFailed}.`
  };
}

module.exports = {
  sendPromotionalEmailToSegment,
};
