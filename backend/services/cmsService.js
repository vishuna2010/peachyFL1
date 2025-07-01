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


/**
 * Creates a new hero banner.
 * @param {object} bannerData - Data for the new banner.
 * @returns {Promise<object>} The created hero banner object.
 */
async function createHeroBanner(bannerData) {
  const { title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder } = bannerData;
  const query = `
    INSERT INTO hero_banners (title, subtitle, button_text, button_link, image_url, alt_text, is_active, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  try {
    const { rows } = await db.query(query, [title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder]);
    return mapBannerToCamelCase(rows[0]);
  } catch (error) {
    console.error('Error creating hero banner:', error);
    // Consider specific error for unique constraint violation on 'title' if applicable
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
 * @returns {Promise<object|null>} The updated hero banner object or null if not found.
 */
async function updateHeroBanner(bannerId, updateData) {
  const { title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder } = updateData;
  // Ensure all fields are present for the update, or build query dynamically
  const query = `
    UPDATE hero_banners
    SET title = $1, subtitle = $2, button_text = $3, button_link = $4,
        image_url = $5, alt_text = $6, is_active = $7, sort_order = $8,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *;
  `;
  try {
    const { rows } = await db.query(query, [title, subtitle, buttonText, buttonLink, imageUrl, altText, isActive, sortOrder, bannerId]);
    if (rows.length === 0) {
      throw new NotFoundError(`Hero banner with ID ${bannerId} not found during update.`);
    }
    return mapBannerToCamelCase(rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error(`Error updating hero banner with ID ${bannerId}:`, error);
    throw new AppError(`Failed to update hero banner with ID ${bannerId}.`, 500, 'BANNER_UPDATE_FAILED');
  }
}

/**
 * Deletes a hero banner.
 * @param {number} bannerId - The ID of the banner to delete.
 * @returns {Promise<object|null>} The deleted hero banner object or null if not found.
 */
async function deleteHeroBanner(bannerId) {
  const query = 'DELETE FROM hero_banners WHERE id = $1 RETURNING *;';
  try {
    const { rows } = await db.query(query, [bannerId]);
    if (rows.length === 0) {
      // This means the banner was already deleted or never existed.
      // Depending on desired behavior, could throw NotFoundError or return null silently.
      // For admin operations, throwing NotFoundError is often clearer.
      throw new NotFoundError(`Hero banner with ID ${bannerId} not found, cannot delete.`);
    }
    return mapBannerToCamelCase(rows[0]); // Return the data of the deleted banner
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
