const db = require('../db');

/**
 * Records an audit event.
 *
 * @param {string} actionType - Type of action (e.g., 'CREATE_CATEGORY', 'LOGIN_SUCCESS').
 * @param {object} actor - Information about the user performing the action.
 * @param {number | null} actor.userId - The ID of the user, or null if system/unauthenticated.
 * @param {string | null} actor.userEmail - The email of the user, or relevant identifier.
 * @param {object} [resource] - Optional. Information about the resource being affected.
 * @param {string} [resource.resourceType] - Type of resource (e.g., 'PRODUCT', 'CATEGORY').
 * @param {number | string} [resource.resourceId] - ID of the resource.
 * @param {object} [details] - Optional. Any additional details to log (e.g., changed fields, error messages).
 * @param {object} [requestContext] - Optional. Express request object to extract IP and User-Agent.
 * @param {string} [requestContext.ip] - IP address from request.
 * @param {object} [requestContext.headers] - Headers from request for User-Agent.
 */
async function recordAuditEvent(
  actionType,
  actor,
  resource = {},
  details = null,
  requestContext = null
) {
  let ipAddress = null;
  let userAgent = null;

  if (requestContext) {
    ipAddress = requestContext.ip || (requestContext.connection && requestContext.connection.remoteAddress);
    if (requestContext.headers && requestContext.headers['user-agent']) {
      userAgent = requestContext.headers['user-agent'];
    }
  }

  // Ensure actor properties are safely accessed
  const userId = actor && actor.userId !== undefined ? actor.userId : null;
  const userEmail = actor && actor.userEmail !== undefined ? actor.userEmail : null;

  // Ensure resource properties are safely accessed
  const resourceType = resource && resource.resourceType !== undefined ? resource.resourceType : null;
  const resourceId = resource && resource.resourceId !== undefined ? resource.resourceId : null;

  try {
    const query = `
      INSERT INTO audit_logs
        (user_id, user_email, action_type, resource_type, resource_id, details, ip_address, user_agent)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;
    const values = [
      userId,
      userEmail,
      actionType,
      resourceType,
      resourceId,
      details ? JSON.stringify(details) : null, // Ensure details is stringified if it's an object
      ipAddress,
      userAgent
    ];

    const result = await db.query(query, values);
    // console.log('Audit event recorded:', result.rows[0].id); // Optional: log success
    return result.rows[0].id;
  } catch (error) {
    console.error('Failed to record audit event:', {
      actionType,
      userId,
      userEmail,
      resourceType,
      resourceId,
      error: error.message,
      // stack: error.stack // Avoid logging full stack for audit failures unless in debug mode
    });
    // Decide if this error should propagate or be swallowed.
    // For audit logs, often it's preferred to not let logging failure break the main operation.
  }
}

module.exports = {
  recordAuditEvent,
};
