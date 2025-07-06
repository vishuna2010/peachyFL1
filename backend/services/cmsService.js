const db = require('../db'); // Corrected path to db.js

/**
 * Fetches active hero banners from the database, ordered by sort_order.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of active hero banner objects.
 */
async function getActiveHeroBanners() {
  const query = `
    SELECT
      id,
      title,
      subtitle,
      button_text,
      button_link,
      image_url,
      alt_text,
      is_active,
      sort_order,
      created_at,
      updated_at
    FROM hero_banners
    WHERE is_active = TRUE
    ORDER BY sort_order ASC, created_at DESC;
  `;
  try {
    const { rows } = await db.query(query);
    // Map to camelCase if necessary, or ensure frontend expects snake_case from this specific service
    // For consistency with other services that might map, let's map here.
    return rows.map(banner => ({
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      buttonText: banner.button_text,
      buttonLink: banner.button_link,
      imageUrl: banner.image_url,
      altText: banner.alt_text,
      isActive: banner.is_active,
      sortOrder: banner.sort_order,
      createdAt: banner.created_at,
      updatedAt: banner.updated_at
    }));
  } catch (error) {
    console.error('Error fetching active hero banners:', error);
    throw new Error('Failed to retrieve active hero banners.'); // Or a more specific error type
  }
}

const { AppError, NotFoundError } = require('../utils/AppError'); // Import custom error classes

// Helper to map DB fields to camelCase
const mapBannerToCamelCase = (banner) => {
  if (!banner) return null;
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    buttonText: banner.button_text,
    buttonLink: banner.button_link,
    imageUrl: banner.image_url,
    altText: banner.alt_text,
    isActive: banner.is_active,
    sortOrder: banner.sort_order,
    createdAt: banner.created_at,
    updatedAt: banner.updated_at
  };
};


const { uploadFileToS3, deleteFileFromS3, isS3Configured } = require('../services/s3Service');
const { getS3KeyFromUrl } = require('../utils/productHelpers');

/**
 * Creates a new hero banner.
 * @param {object} bannerData - Data for the new banner.
 * @param {object} [fileData] - Optional file data from multer.
 * @returns {Promise<object>} The created hero banner object.
 */
async function createHeroBanner(bannerData, fileData) {
  let { title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder } = bannerData;
  let s3FileKey = null;

  // Auto-assign sort order if not provided
  if (sortOrder === undefined || sortOrder === null) {
    try {
      const maxSortResult = await db.query('SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM hero_banners');
      sortOrder = maxSortResult.rows[0].max_sort + 1;
    } catch (error) {
      console.error('Error getting max sort order:', error);
      sortOrder = 0; // Fallback to 0
    }
  }

  if (fileData) {
    if (!isS3Configured()) {
      console.warn("S3 not configured, skipping image upload. Banner will be created without image.");
      // For development, we could store the image data in a different way
      // For now, we'll just skip the image upload and continue
      imageUrl = null;
    } else {
      const uniqueFileName = `hero-banners/${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
      try {
        const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
        imageUrl = s3Data.Location; // Override imageUrl with S3 URL
        s3FileKey = s3Data.Key; // Store key for potential future operations (though not stored in DB for banners currently)
      } catch (s3Error) {
        console.error("S3 Upload Error on banner creation:", s3Error);
        throw new AppError("Failed to upload banner image to S3.", 500, "S3_UPLOAD_FAILED");
      }
    }
  } else if (!imageUrl) {
    // If no file and no imageUrl provided, it's an error based on previous validation
    // However, validation now allows optional imageUrl IF a file is expected.
    // If both are missing, the route validation for imageUrl (if made strictly required when no file) should catch it.
    // For now, if imageUrl is null/undefined and no file, DB will get null.
  }

  const query = `
    INSERT INTO hero_banners (title, subtitle, button_text, button_link, image_url, alt_text, is_active, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  try {
    const { rows } = await db.query(query, [title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder]);
    return mapBannerToCamelCase(rows[0]);
  } catch (error) {
    console.error('Error creating hero banner in DB:', error);
    // If S3 upload happened but DB insert failed, attempt to delete from S3
    if (s3FileKey && isS3Configured()) {
      try { await deleteFileFromS3(s3FileKey); }
      catch (s3RollbackError) { console.error(`CRITICAL: Failed to rollback S3 upload for key ${s3FileKey} during banner creation DB error:`, s3RollbackError); }
    }
    throw new AppError('Failed to create hero banner.', 500, 'BANNER_CREATION_FAILED');
  }
}

/**
 * Fetches a single hero banner by its ID.
 * @param {number} bannerId - The ID of the banner.
 * @returns {Promise<object|null>} The hero banner object or null if not found.
 */
async function getHeroBannerById(bannerId) {
  const query = 'SELECT * FROM hero_banners WHERE id = $1;';
  try {
    const { rows } = await db.query(query, [bannerId]);
    if (rows.length === 0) {
      throw new NotFoundError(`Hero banner with ID ${bannerId} not found.`);
    }
    return mapBannerToCamelCase(rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error fetching hero banner with ID ${bannerId}:`, error);
    throw new AppError(`Failed to retrieve hero banner with ID ${bannerId}.`, 500, 'BANNER_FETCH_BY_ID_FAILED');
  }
}

/**
 * Updates an existing hero banner.
 * @param {number} bannerId - The ID of the banner to update.
 * @param {object} updateData - Data to update the banner with.
 * @param {object} [fileData] - Optional new file data from multer.
 * @param {boolean} [removeImageFlag=false] - Flag to indicate if existing image should be removed.
 * @returns {Promise<object|null>} The updated hero banner object or null if not found.
 */
async function updateHeroBanner(bannerId, updateData, fileData, removeImageFlag = false) {
  const currentBanner = await getHeroBannerById(bannerId); // Ensures banner exists, throws NotFoundError if not
  if (!currentBanner) return null; // Should be caught by getHeroBannerById throwing

  let { title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder } = updateData;
  let finalImageUrl = currentBanner.imageUrl; // Start with existing image URL (camelCased from currentBanner)
  let s3NewFileKey = null;
  let s3OldFileKey = null;

  // Keep existing sort order if not provided in update
  if (sortOrder === undefined || sortOrder === null) {
    sortOrder = currentBanner.sortOrder;
  }

  if (fileData) {
    if (!isS3Configured()) {
      console.warn("S3 not configured, skipping image upload. Banner will be updated without new image.");
      // Keep the existing image URL
      finalImageUrl = currentBanner.imageUrl;
    } else {
      if (currentBanner.imageUrl) s3OldFileKey = getS3KeyFromUrl(currentBanner.imageUrl);

      const uniqueFileName = `hero-banners/${bannerId}-${Date.now()}-${fileData.originalname.replace(/\s+/g, '_')}`;
      try {
        const s3Data = await uploadFileToS3(fileData.buffer, uniqueFileName, fileData.mimetype);
        finalImageUrl = s3Data.Location;
        s3NewFileKey = s3Data.Key;
      } catch (s3Error) {
        console.error("S3 Upload Error on banner update:", s3Error);
        throw new AppError("Failed to upload new banner image to S3.", 500, "S3_UPLOAD_FAILED");
      }
    }
  } else if (removeImageFlag) {
    if (currentBanner.imageUrl && isS3Configured()) s3OldFileKey = getS3KeyFromUrl(currentBanner.imageUrl);
    finalImageUrl = null;
  } else if (imageUrl !== undefined) { // If imageUrl is explicitly passed in updateData (e.g. user typed a URL)
    if (currentBanner.imageUrl && currentBanner.imageUrl !== imageUrl && isS3Configured()) {
       s3OldFileKey = getS3KeyFromUrl(currentBanner.imageUrl); // Old image needs deletion if URL changed
    }
    finalImageUrl = imageUrl;
  }
  // If no file, no remove flag, and no imageUrl in updateData, finalImageUrl remains currentBanner.imageUrl

  // Build query dynamically based on fields actually provided in updateData,
  // or update all fields as done previously if that's simpler and acceptable.
  // For now, keeping it simple: update all fields based on incoming updateData, using finalImageUrl.
  const query = `
    UPDATE hero_banners
    SET title = $1, subtitle = $2, button_text = $3, button_link = $4,
        image_url = $5, alt_text = $6, is_active = $7, sort_order = $8,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *;
  `;
  try {
    const { rows } = await db.query(query, [
      title !== undefined ? title : currentBanner.title,
      subtitle !== undefined ? subtitle : currentBanner.subtitle,
      buttonText !== undefined ? buttonText : currentBanner.buttonText,
      buttonLink !== undefined ? buttonLink : currentBanner.buttonLink,
      finalImageUrl, // This is the critical one determined above
      altText !== undefined ? altText : currentBanner.altText,
      isActive !== undefined ? isActive : currentBanner.isActive,
      sortOrder !== undefined ? sortOrder : currentBanner.sortOrder,
      bannerId
    ]);

    if (s3OldFileKey && s3OldFileKey !== s3NewFileKey && isS3Configured()) { // Delete old S3 image if replaced or removed
        try { await deleteFileFromS3(s3OldFileKey); }
        catch (s3DeleteError) { console.error(`Failed to delete old S3 image ${s3OldFileKey} for banner ${bannerId}:`, s3DeleteError); /* Non-critical, log and continue */ }
    }
    return mapBannerToCamelCase(rows[0]);
  } catch (error) {
    // If S3 upload happened but DB update failed, attempt to delete the newly uploaded S3 file
    if (s3NewFileKey && isS3Configured()) {
        try { await deleteFileFromS3(s3NewFileKey); }
        catch (s3RollbackError) { console.error(`CRITICAL: Failed to rollback S3 upload for key ${s3NewFileKey} during banner update DB error:`, s3RollbackError); }
    }
    if (error instanceof NotFoundError) throw error; // Should have been caught by getHeroBannerById
    console.error(`Error updating hero banner DB with ID ${bannerId}:`, error);
    throw new AppError(`Failed to update hero banner DB with ID ${bannerId}.`, 500, 'BANNER_DB_UPDATE_FAILED');
  }
}

/**
 * Deletes a hero banner.
 * @param {number} bannerId - The ID of the banner to delete.
 * @returns {Promise<object|null>} The deleted hero banner object or null if not found.
 */
async function deleteHeroBanner(bannerId) {
  // Fetch the banner first to get the image URL
  let banner = null;
  try {
    banner = await getHeroBannerById(bannerId);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error fetching hero banner for S3 cleanup:`, error);
    throw new AppError(`Failed to fetch hero banner for deletion.`, 500, 'BANNER_FETCH_FOR_DELETE_FAILED');
  }

  // Remove S3 image if present and S3 is configured
  if (banner && banner.imageUrl && isS3Configured()) {
    try {
      const s3Key = getS3KeyFromUrl(banner.imageUrl);
      if (s3Key) {
        await deleteFileFromS3(s3Key);
      }
    } catch (s3Error) {
      console.error(`Failed to delete S3 image for banner ${bannerId}:`, s3Error);
      // Not critical, continue with DB deletion
    }
  }

  // Now delete the DB row
  const query = 'DELETE FROM hero_banners WHERE id = $1 RETURNING *;';
  try {
    const { rows } = await db.query(query, [bannerId]);
    if (rows.length === 0) {
      throw new NotFoundError(`Hero banner with ID ${bannerId} not found, cannot delete.`);
    }
    return mapBannerToCamelCase(rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error deleting hero banner with ID ${bannerId}:`, error);
    throw new AppError(`Failed to delete hero banner with ID ${bannerId}.`, 500, 'BANNER_DELETE_FAILED');
  }
}


module.exports = {
  getActiveHeroBanners,
  getAllHeroBanners,
  createHeroBanner,
  getHeroBannerById,
  updateHeroBanner,
  deleteHeroBanner,
};

/**
 * Fetches all hero banners from the database with pagination and sorting for admin.
 * @param {object} options - Options for pagination and sorting.
 * @param {number} options.page - Current page number (default 1).
 * @param {number} options.limit - Number of items per page (default 10).
 * @param {string} options.sortBy - Column to sort by (default 'sort_order').
 * @param {string} options.sortOrder - Sort order ('ASC' or 'DESC', default 'ASC').
 * @returns {Promise<Object>} A promise that resolves to an object containing banners and pagination info.
 */
async function getAllHeroBanners({ page = 1, limit = 10, sortBy = 'sort_order', sortOrder = 'ASC' } = {}) {
  const offset = (page - 1) * limit;

  // Validate sortBy to prevent SQL injection
  const allowedSortBy = ['id', 'title', 'is_active', 'sort_order', 'created_at', 'updated_at'];
  if (!allowedSortBy.includes(sortBy)) {
    sortBy = 'sort_order'; // Default to a safe column
  }
  // Validate sortOrder
  if (sortOrder.toUpperCase() !== 'ASC' && sortOrder.toUpperCase() !== 'DESC') {
    sortOrder = 'ASC';
  }

  const bannersQuery = `
    SELECT
      id, title, subtitle, button_text, button_link, image_url, alt_text,
      is_active, sort_order, created_at, updated_at
    FROM hero_banners
    ORDER BY ${sortBy} ${sortOrder}, id ${sortOrder} -- Added secondary sort by id for stable ordering
    LIMIT $1 OFFSET $2;
  `;

  const countQuery = `SELECT COUNT(*) FROM hero_banners;`;

  try {
    const [bannersResult, countResult] = await Promise.all([
      db.query(bannersQuery, [limit, offset]),
      db.query(countQuery)
    ]);

    const totalBanners = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalBanners / limit);

    return {
      banners: bannersResult.rows.map(banner => ({
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        buttonText: banner.button_text,
        buttonLink: banner.button_link,
        imageUrl: banner.image_url,
        altText: banner.alt_text,
        isActive: banner.is_active,
        sortOrder: banner.sort_order,
        createdAt: banner.created_at,
        updatedAt: banner.updated_at
      })),
      totalBanners,
      totalPages,
      currentPage: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };
  } catch (error) {
    console.error('Error fetching all hero banners for admin:', error);
    throw new Error('Failed to retrieve hero banners for admin.');
  }
}
