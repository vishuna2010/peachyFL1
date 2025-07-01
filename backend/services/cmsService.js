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

module.exports = {
  getActiveHeroBanners,
  getAllHeroBanners, // Added new function
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
