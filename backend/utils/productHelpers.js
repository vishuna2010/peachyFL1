// Helper function to get or create tag IDs
async function getOrCreateTagIds(tagNames, client) {
  const tagIds = [];
  if (!tagNames || tagNames.length === 0) { return tagIds; }
  for (const tagName of tagNames) {
    let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName.trim()]);
    if (tagResult.rows.length > 0) {
      tagIds.push(tagResult.rows[0].id);
    } else {
      tagResult = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName.trim()]);
      tagIds.push(tagResult.rows[0].id);
      console.log(`Created new tag: ${tagName.trim()}`);
    }
  }
  return tagIds;
}

// Helper function to parse S3 Key from URL
function getS3KeyFromUrl(url) {
    if (!url) return null;
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.substring(1) : parsedUrl.pathname;
    } catch (error) {
        console.warn("Could not parse S3 URL, might be a local path or already a key:", url, error);
        if (url.startsWith('product-images/') || url.startsWith('/uploads/')) {
             return url.startsWith('/') ? url.substring(1) : url;
        }
        return null;
    }
}

module.exports = {
  getOrCreateTagIds,
  getS3KeyFromUrl,
};
