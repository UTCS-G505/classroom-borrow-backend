/**
 * Extract 'sub' claim from JWT access token
 * @param {string|null} accessToken - The JWT access token
 * @returns {string|null} The 'sub' claim value or null
 */
function getJwtSub(accessToken) {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    // Handle base64url
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

module.exports = { getJwtSub };
