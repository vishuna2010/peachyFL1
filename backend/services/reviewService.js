const db = require('../db');
const { NotFoundError, BadRequestError, AppError } = require('../utils/AppError');
const auditLogService = require('./auditLogService'); // Assuming path

/**
 * INTERNAL HELPER: Updates the average rating and review count for a product.
 * Should be called within a transaction when a review is approved, or an approved review is modified/deleted.
 * @param {number} productId - The ID of the product to update.
 * @param {object} client - The database client for transactional integrity.
 */
async function _updateProductAverageRating(productId, client) {
  if (!productId) {
    console.error('[ReviewService._updateProductAverageRating] Product ID is required.');
    throw new AppError('Product ID is required for updating average rating.', 500, 'PRODUCT_ID_MISSING_FOR_RATING_UPDATE');
  }
  try {
    const ratingStats = await client.query(
      `SELECT COALESCE(AVG(rating), 0) as average_rating, COUNT(id) as review_count
       FROM product_reviews
       WHERE product_id = $1 AND status = 'approved'`,
      [productId]
    );

    let averageRating = 0;
    let reviewCount = 0;

    if (ratingStats.rows.length > 0) {
      averageRating = parseFloat(ratingStats.rows[0].average_rating);
      reviewCount = parseInt(ratingStats.rows[0].review_count, 10);
    }

    await client.query(
      `UPDATE products
       SET average_rating = $1, review_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [averageRating.toFixed(2), reviewCount, productId]
    );
    console.log(`[ReviewService] Updated average rating for product ${productId}: ${averageRating.toFixed(2)}, count: ${reviewCount}`);
  } catch (error) {
    console.error(`[ReviewService._updateProductAverageRating] Failed for product ${productId}:`, error);
    throw new AppError('Failed to update product average rating.', 500, 'PRODUCT_RATING_UPDATE_FAILED', { originalError: error.message, productId });
  }
}

/**
 * Retrieves a paginated and filterable list of all product reviews.
 * @param {object} options - Filtering and pagination options.
 * @returns {Promise<{ data: Review[], pagination: object }>}
 */
async function getAllReviews(options = {}) {
  const {
    page = 1,
    limit = 10,
    status,
    productId,
    userId,
    rating,
    dateFrom,
    dateTo,
    sortBy = 'created_at', // Default sort column
    sortOrder = 'DESC'    // Default sort order
  } = options;

  const offset = (page - 1) * limit;
  const queryParams = [];
  const whereClauses = [];
  let paramIndex = 1;

  if (status) {
    whereClauses.push(`r.status = $${paramIndex++}`);
    queryParams.push(status);
  }
  if (productId) {
    whereClauses.push(`r.product_id = $${paramIndex++}`);
    queryParams.push(productId);
  }
  if (userId) {
    whereClauses.push(`r.user_id = $${paramIndex++}`);
    queryParams.push(userId);
  }
  if (rating) {
    whereClauses.push(`r.rating = $${paramIndex++}`);
    queryParams.push(rating);
  }
  if (dateFrom) {
    whereClauses.push(`r.created_at >= $${paramIndex++}`);
    queryParams.push(dateFrom);
  }
  if (dateTo) {
    // Adjust dateTo to include the whole day
    const adjustedDateTo = new Date(dateTo);
    adjustedDateTo.setHours(23, 59, 59, 999);
    whereClauses.push(`r.created_at <= $${paramIndex++}`);
    queryParams.push(adjustedDateTo);
  }

  const whereCondition = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Whitelist sortBy columns and map to actual DB columns
  const allowedSorts = {
    'created_at': 'r.created_at',
    'rating': 'r.rating',
    'status': 'r.status',
    'product_name': 'p.name', // Example if sorting by related field
    'user_name': 'u.name'    // Example
  };
  const safeSortBy = allowedSorts[sortBy] || 'r.created_at'; // Default to created_at if invalid
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'; // Ensure valid sort order

  let orderByClause = `ORDER BY ${safeSortBy} ${safeSortOrder}`;
  if (sortBy !== 'created_at') { // Add secondary sort for consistency
      orderByClause += `, r.created_at ${safeSortOrder === 'ASC' ? 'DESC' : 'ASC'}`; // Opposite for secondary if primary is not date
  }


  try {
    const reviewsQuery = `
      SELECT r.id, r.rating, r.title, r.comment, r.status, r.created_at, r.updated_at,
             r.product_id, p.name as product_name, p.image_url as product_image_url,
             r.user_id, u.name as user_name, u.email as user_email
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      JOIN users u ON r.user_id = u.id
      ${whereCondition}
      ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const finalQueryParamsData = [...queryParams, limit, offset];
    const reviewsResult = await db.query(reviewsQuery, finalQueryParamsData);

    const totalCountQuery = `SELECT COUNT(r.id) FROM product_reviews r ${whereCondition};`;
    const totalCountResult = await db.query(totalCountQuery, queryParams);

    const totalItems = parseInt(totalCountResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: reviewsResult.rows,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems,
        pageSize: Number(limit),
        sortBy,
        sortOrder: safeSortOrder
      }
    };
  } catch (error) {
    console.error('[ReviewService.getAllReviews] Error:', error);
    throw new AppError('Failed to retrieve reviews.', 500, 'REVIEW_FETCH_ALL_FAILED', { originalError: error.message });
  }
}

/**
 * Fetches a single review by its ID.
 * @param {number} reviewId - The ID of the review.
 * @returns {Promise<Review>} The review object.
 * @throws {NotFoundError} If the review is not found.
 */
async function getReviewById(reviewId) {
  if (!reviewId || isNaN(parseInt(reviewId))) {
    throw new BadRequestError('Invalid Review ID provided.');
  }
  try {
    const result = await db.query(
      `SELECT r.id, r.rating, r.title, r.comment, r.status, r.created_at, r.updated_at,
              r.product_id, p.name as product_name, p.image_url as product_image_url,
              r.user_id, u.name as user_name, u.email as user_email
       FROM product_reviews r
       JOIN products p ON r.product_id = p.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [reviewId]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Review with ID ${reviewId} not found.`);
    }
    return result.rows[0];
  } catch (error) {
    console.error(`[ReviewService.getReviewById] Error for reviewId ${reviewId}:`, error);
    if (error instanceof NotFoundError) throw error;
    throw new AppError(`Failed to retrieve review ${reviewId}.`, 500, 'REVIEW_FETCH_ONE_FAILED', { originalError: error.message, reviewId });
  }
}

/**
 * Updates a review, primarily its status.
 * @param {number} reviewId - The ID of the review.
 * @param {object} updateData - Data to update, e.g., { status, title, comment, rating }.
 * @param {number} adminUserId - The ID of the admin performing the update.
 * @param {string} adminUserEmail - The email of the admin (for audit log).
 * @returns {Promise<Review>} The updated review object.
 */
async function updateReview(reviewId, updateData, adminUserId, adminUserEmail) {
  if (!reviewId || isNaN(parseInt(reviewId))) {
    throw new BadRequestError('Invalid Review ID provided.');
  }
  const { status, title, comment, rating } = updateData;
  if (!status && title === undefined && comment === undefined && rating === undefined) {
    throw new BadRequestError('No update data provided for review.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const reviewCheck = await client.query('SELECT product_id, status as old_status, rating as old_rating FROM product_reviews WHERE id = $1 FOR UPDATE', [reviewId]);
    if (reviewCheck.rows.length === 0) {
      throw new NotFoundError(`Review with ID ${reviewId} not found.`);
    }
    const { product_id, old_status, old_rating } = reviewCheck.rows[0];

    const fieldsToUpdate = {};
    if (status !== undefined && status !== old_status) fieldsToUpdate.status = status;
    if (title !== undefined) fieldsToUpdate.title = title;
    if (comment !== undefined) fieldsToUpdate.comment = comment;
    if (rating !== undefined && Number(rating) !== Number(old_rating)) fieldsToUpdate.rating = Number(rating);


    if (Object.keys(fieldsToUpdate).length === 0) {
      await client.query('COMMIT'); // Or ROLLBACK if no change means no action
      return getReviewById(reviewId); // Return current review if no actual changes made
    }

    fieldsToUpdate.updated_at = 'NOW()'; // Always update timestamp

    const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(fieldsToUpdate);
    values.push(reviewId); // For WHERE id = $X

    const updateQuery = `UPDATE product_reviews SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
    const result = await client.query(updateQuery, values);
    const updatedReview = result.rows[0];

    const statusChanged = fieldsToUpdate.status && fieldsToUpdate.status !== old_status;
    const ratingChanged = fieldsToUpdate.rating && fieldsToUpdate.rating !== old_rating;
    const approvedStatusInvolved = old_status === 'approved' || (fieldsToUpdate.status && fieldsToUpdate.status === 'approved');

    if ((statusChanged && approvedStatusInvolved) || (ratingChanged && updatedReview.status === 'approved')) {
      await _updateProductAverageRating(product_id, client);
    }

    await client.query('COMMIT');

    // Audit Log
    auditLogService.recordAuditEvent(
      'REVIEW_UPDATE_SUCCESS',
      { userId: adminUserId, userEmail: adminUserEmail },
      { resourceType: 'REVIEW', resourceId: reviewId },
      { oldStatus: old_status, newStatus: updatedReview.status, updatedFields: Object.keys(fieldsToUpdate) }
      // req object is not available in service, pass null or construct minimal context if needed by auditLogService
    ).catch(err => console.error(`[ReviewService] Audit log failed for REVIEW_UPDATE_SUCCESS (ID: ${reviewId}):`, err));

    return updatedReview;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[ReviewService.updateReview] Error for reviewId ${reviewId}:`, error);
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    throw new AppError(`Failed to update review ${reviewId}.`, 500, 'REVIEW_UPDATE_FAILED', { originalError: error.message, reviewId });
  } finally {
    client.release();
  }
}

/**
 * Deletes a review.
 * @param {number} reviewId - The ID of the review.
 * @param {number} adminUserId - The ID of the admin performing the deletion.
 * @param {string} adminUserEmail - The email of the admin (for audit log).
 * @returns {Promise<object>} The deleted review data (for audit logging or confirmation).
 */
async function deleteReview(reviewId, adminUserId, adminUserEmail) {
  if (!reviewId || isNaN(parseInt(reviewId))) {
    throw new BadRequestError('Invalid Review ID provided.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const reviewDataResult = await client.query('SELECT product_id, status, rating, title FROM product_reviews WHERE id = $1 FOR UPDATE', [reviewId]);
    if (reviewDataResult.rows.length === 0) {
      throw new NotFoundError(`Review with ID ${reviewId} not found.`);
    }
    const deletedReviewData = reviewDataResult.rows[0];
    const { product_id, status: reviewStatus } = deletedReviewData;

    await client.query('DELETE FROM product_reviews WHERE id = $1', [reviewId]);

    if (reviewStatus === 'approved') {
      await _updateProductAverageRating(product_id, client);
    }

    await client.query('COMMIT');

    // Audit Log
    auditLogService.recordAuditEvent(
      'REVIEW_DELETE_SUCCESS',
      { userId: adminUserId, userEmail: adminUserEmail },
      { resourceType: 'REVIEW', resourceId: reviewId },
      { deletedReviewTitle: deletedReviewData.title, productId: product_id }
    ).catch(err => console.error(`[ReviewService] Audit log failed for REVIEW_DELETE_SUCCESS (ID: ${reviewId}):`, err));

    return deletedReviewData; // Return what was deleted for context
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[ReviewService.deleteReview] Error for reviewId ${reviewId}:`, error);
    if (error instanceof NotFoundError) throw error;
    throw new AppError(`Failed to delete review ${reviewId}.`, 500, 'REVIEW_DELETE_FAILED', { originalError: error.message, reviewId });
  } finally {
    client.release();
  }
}

module.exports = {
  getAllReviews,
  getReviewById,
  updateReview, // More generic update method
  deleteReview,
  _updateProductAverageRating // Exporting for potential direct use in product service if needed, though typically private
};
