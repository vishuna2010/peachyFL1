const db = require('../db');
const { NotFoundError, BadRequestError, AppError, ConflictError } = require('../utils/AppError'); // Added ConflictError
const auditLogService = require('./auditLogService');

/**
 * INTERNAL HELPER: Updates the average rating and review count for a product.
 * Should be called within a transaction when a review is approved/disapproved, or an approved review's rating is modified/deleted.
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
       WHERE product_id = $1 AND is_approved = TRUE`, // Changed from status = 'approved'
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
 *                           `status` can be 'approved' or 'pending'.
 * @returns {Promise<{ data: Review[], pagination: object }>}
 */
async function getAllReviews(options = {}) {
  const {
    page = 1,
    limit = 10,
    status, // Expected: 'approved', 'pending', or null/undefined for all
    productId,
    userId,
    rating,
    dateFrom,
    dateTo,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = options;

  const offset = (page - 1) * limit;
  const queryParams = [];
  const whereClauses = [];
  let paramIndex = 1;

  if (status) {
    if (status.toLowerCase() === 'approved') {
      whereClauses.push(`r.is_approved = TRUE`);
    } else if (status.toLowerCase() === 'pending') {
      whereClauses.push(`r.is_approved = FALSE`);
    } else {
      // Potentially throw error for invalid status, or ignore. For now, ignoring.
      console.warn(`[ReviewService.getAllReviews] Invalid status filter: ${status}. Ignoring.`);
    }
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
    const adjustedDateTo = new Date(dateTo);
    adjustedDateTo.setHours(23, 59, 59, 999);
    whereClauses.push(`r.created_at <= $${paramIndex++}`);
    queryParams.push(adjustedDateTo);
  }

  const whereCondition = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allowedSorts = {
    'created_at': 'r.created_at',
    'rating': 'r.rating',
    'is_approved': 'r.is_approved', // Changed from 'status'
    'product_name': 'p.name',
    'user_name': 'u.name'
  };
  const safeSortBy = allowedSorts[sortBy] || 'r.created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let orderByClause = `ORDER BY ${safeSortBy} ${safeSortOrder}`;
  if (sortBy !== 'created_at' && safeSortBy !== 'r.created_at') { // Avoid duplicate primary sort on created_at
      orderByClause += `, r.created_at ${safeSortOrder === 'ASC' ? 'DESC' : 'ASC'}`;
  }


  try {
    const reviewsQuery = `
      SELECT r.id, r.rating, r.title, r.comment, r.is_approved, r.created_at, r.updated_at, -- Changed from r.status
             r.product_id, p.name as product_name, p.image_url as product_image_url,
             r.user_id, u.name as user_name, u.email as user_email
      FROM product_reviews r
      LEFT JOIN products p ON r.product_id = p.id  -- Changed to LEFT JOIN to not lose reviews if product/user deleted
      LEFT JOIN users u ON r.user_id = u.id      -- Changed to LEFT JOIN
      ${whereCondition}
      ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const finalQueryParamsData = [...queryParams, limit, offset];
    const reviewsResult = await db.query(reviewsQuery, finalQueryParamsData);

    const totalCountQuery = `SELECT COUNT(r.id) FROM product_reviews r ${whereCondition};`; // Assuming r alias is fine here
    const totalCountResult = await db.query(totalCountQuery, queryParams); // queryParams for WHERE, not pagination

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
      `SELECT r.id, r.rating, r.title, r.comment, r.is_approved, r.created_at, r.updated_at, -- Changed from r.status
              r.product_id, p.name as product_name, p.image_url as product_image_url,
              r.user_id, u.name as user_name, u.email as user_email
       FROM product_reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
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
 * Updates a review, primarily its approval status, title, comment, or rating.
 * @param {number} reviewId - The ID of the review.
 * @param {object} updateData - Data to update, e.g., { is_approved, title, comment, rating }.
 * @param {number} adminUserId - The ID of the admin performing the update.
 * @param {string} adminUserEmail - The email of the admin (for audit log).
 * @returns {Promise<Review>} The updated review object.
 */
async function updateReview(reviewId, updateData, adminUserId, adminUserEmail) {
  if (!reviewId || isNaN(parseInt(reviewId))) {
    throw new BadRequestError('Invalid Review ID provided.');
  }
  const { is_approved, title, comment, rating } = updateData; // Expecting is_approved (boolean)
  if (is_approved === undefined && title === undefined && comment === undefined && rating === undefined) {
    throw new BadRequestError('No update data provided for review.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const reviewCheck = await client.query('SELECT product_id, is_approved as old_is_approved, rating as old_rating FROM product_reviews WHERE id = $1 FOR UPDATE', [reviewId]);
    if (reviewCheck.rows.length === 0) {
      throw new NotFoundError(`Review with ID ${reviewId} not found.`);
    }
    const { product_id, old_is_approved, old_rating } = reviewCheck.rows[0];

    const fieldsToUpdate = {};
    if (is_approved !== undefined && typeof is_approved === 'boolean' && is_approved !== old_is_approved) {
        fieldsToUpdate.is_approved = is_approved;
    }
    if (title !== undefined) fieldsToUpdate.title = title;
    if (comment !== undefined) fieldsToUpdate.comment = comment;
    if (rating !== undefined && Number(rating) !== Number(old_rating)) {
        const numRating = Number(rating);
        if (numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
            throw new BadRequestError('Rating must be an integer between 1 and 5.');
        }
        fieldsToUpdate.rating = numRating;
    }


    if (Object.keys(fieldsToUpdate).length === 0) {
      await client.query('COMMIT');
      return getReviewById(reviewId);
    }

    fieldsToUpdate.updated_at = 'NOW()';

    const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `"${key}" = $${index + 1}`).join(', '); // Quote column names
    const values = Object.values(fieldsToUpdate);
    values.push(reviewId);

    const updateQuery = `UPDATE product_reviews SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
    const result = await client.query(updateQuery, values);
    const updatedReview = result.rows[0];

    // Determine if average rating needs update
    const approvalStatusChanged = fieldsToUpdate.is_approved !== undefined;
    const ratingChangedWhileApproved = fieldsToUpdate.rating !== undefined && updatedReview.is_approved;

    if (approvalStatusChanged || ratingChangedWhileApproved) {
      await _updateProductAverageRating(product_id, client);
    }

    await client.query('COMMIT');

    auditLogService.recordAuditEvent(
      'REVIEW_UPDATE_SUCCESS',
      { userId: adminUserId, userEmail: adminUserEmail },
      { resourceType: 'REVIEW', resourceId: reviewId },
      { old_is_approved: old_is_approved, new_is_approved: updatedReview.is_approved, updatedFields: Object.keys(fieldsToUpdate) }
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
 * @returns {Promise<object>} The deleted review data.
 */
async function deleteReview(reviewId, adminUserId, adminUserEmail) {
  if (!reviewId || isNaN(parseInt(reviewId))) {
    throw new BadRequestError('Invalid Review ID provided.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const reviewDataResult = await client.query('SELECT product_id, is_approved, rating, title FROM product_reviews WHERE id = $1 FOR UPDATE', [reviewId]);
    if (reviewDataResult.rows.length === 0) {
      throw new NotFoundError(`Review with ID ${reviewId} not found.`);
    }
    const deletedReviewData = reviewDataResult.rows[0];
    const { product_id, is_approved: reviewIsApproved } = deletedReviewData;

    await client.query('DELETE FROM product_reviews WHERE id = $1', [reviewId]);

    if (reviewIsApproved) { // If the deleted review was approved
      await _updateProductAverageRating(product_id, client);
    }

    await client.query('COMMIT');

    auditLogService.recordAuditEvent(
      'REVIEW_DELETE_SUCCESS',
      { userId: adminUserId, userEmail: adminUserEmail },
      { resourceType: 'REVIEW', resourceId: reviewId },
      { deletedReviewTitle: deletedReviewData.title, productId: product_id }
    ).catch(err => console.error(`[ReviewService] Audit log failed for REVIEW_DELETE_SUCCESS (ID: ${reviewId}):`, err));

    return deletedReviewData;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[ReviewService.deleteReview] Error for reviewId ${reviewId}:`, error);
    if (error instanceof NotFoundError) throw error;
    throw new AppError(`Failed to delete review ${reviewId}.`, 500, 'REVIEW_DELETE_FAILED', { originalError: error.message, reviewId });
  } finally {
    client.release();
  }
}

/**
 * Allows an authenticated user to submit a new review for a product.
 * Assumes review status defaults to 'pending' (is_approved = FALSE).
 * @param {number} userId - The ID of the authenticated user.
 * @param {number} productId - The ID of the product being reviewed.
 * @param {object} reviewData - Contains rating, title (optional), comment (optional).
 * @returns {Promise<object>} The newly created review object.
 */
async function submitNewReview(userId, productId, reviewData) {
  const { rating, title, comment } = reviewData;

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new BadRequestError('Rating must be an integer between 1 and 5.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }

    // Check for existing review by this user for this product
    const existingReview = await client.query(
      'SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2',
      [productId, userId]
    );
    if (existingReview.rows.length > 0) {
      throw new ConflictError('You have already submitted a review for this product.');
    }

    const result = await client.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, title, comment, is_approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`, // is_approved defaults to FALSE (pending)
      [productId, userId, rating, title || null, comment || null]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ConflictError) {
        throw error;
    }
    console.error(`[ReviewService.submitNewReview] Error for product ${productId}, user ${userId}:`, error);
    throw new AppError('Failed to submit review.', 500, 'REVIEW_SUBMISSION_FAILED');
  } finally {
    client.release();
  }
}

/**
 * Retrieves a specific user's review for a given product.
 * @param {number} userId - The ID of the user.
 * @param {number} productId - The ID of the product.
 * @returns {Promise<object|null>} The review object if found, otherwise null.
 */
async function getUserReviewForProduct(userId, productId) {
  try {
    const result = await db.query(
      'SELECT id, rating, title, comment, is_approved, created_at, updated_at FROM product_reviews WHERE product_id = $1 AND user_id = $2', // selected is_approved
      [productId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`[ReviewService.getUserReviewForProduct] Error for product ${productId}, user ${userId}:`, error);
    throw new AppError('Failed to retrieve user review.', 500, 'USER_REVIEW_FETCH_FAILED');
  }
}

/**
 * Retrieves a paginated list of approved reviews for a specific product.
 * @param {number} productId - The ID of the product.
 * @param {object} paginationOptions - Contains page and limit.
 * @returns {Promise<object>} Paginated list of approved reviews.
 */
async function getApprovedReviewsForProduct(productId, paginationOptions = {}) {
  const page = parseInt(paginationOptions.page) || 1;
  let limit = parseInt(paginationOptions.limit) || 10;
  if (limit > 100) limit = 100; // Max limit safeguard
  const offset = (page - 1) * limit;

  try {
    const reviewsQuery = `
      SELECT r.id, r.rating, r.title, r.comment, r.created_at, u.name as user_name
      FROM product_reviews r
      LEFT JOIN users u ON r.user_id = u.id -- LEFT JOIN in case user is deleted
      WHERE r.product_id = $1 AND r.is_approved = TRUE -- Changed from status = 'approved'
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const reviewsResult = await db.query(reviewsQuery, [productId, limit, offset]);

    const totalCountQuery = `
      SELECT COUNT(*) FROM product_reviews
      WHERE product_id = $1 AND is_approved = TRUE; -- Changed from status = 'approved'
    `;
    const totalCountResult = await db.query(totalCountQuery, [productId]);
    const totalItems = parseInt(totalCountResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      reviews: reviewsResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        pageSize: limit,
      },
    };
  } catch (error) {
    console.error(`[ReviewService.getApprovedReviewsForProduct] Error for product ${productId}:`, error);
    throw new AppError('Failed to retrieve approved reviews.', 500, 'APPROVED_REVIEWS_FETCH_FAILED');
  }
}


module.exports = {
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  _updateProductAverageRating,
  submitNewReview,
  getUserReviewForProduct,
  getApprovedReviewsForProduct,
};
