const db = require('../config/db'); // Assuming db.js exports the query function

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
};
