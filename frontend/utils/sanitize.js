export function stripHtmlComments(str) {
  if (typeof str !== 'string' || !str) return str === null ? null : ''; // Handle null or empty string input
  // This regex removes <!-- ... --> comments.
  // It's basic and might not cover all edge cases of malformed comments
  // or comments within comments, but should handle standard ones.
  return str.replace(/<!--[\s\S]*?-->/g, "");
}

export function sanitizeAttributeValue(str) {
  // A more general sanitizer for attribute values if needed,
  // for now, just stripping comments.
  // Could also replace quotes, etc., if that becomes an issue.
  return stripHtmlComments(str);
}
