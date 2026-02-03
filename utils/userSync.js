const db = require('../db');
const ssoService = require('../services/ssoService');

/**
 * Sync user from SSO to local database
 * Checks database first - only calls SSO if user is NOT found
 * This optimizes performance for returning users
 *
 * @param {string} uid - SSO User ID
 * @param {string} accessToken - SSO Access Token
 * @returns {Promise<Object|null>} User object if sync successful, null otherwise
 */
async function syncUserToLocalDB(uid, accessToken) {
  try {
    // 1. Check if user exists in local DB FIRST
    const [existingUsers] = await db.query(
      'SELECT user_id, name, email, role, department FROM users WHERE user_id = ?',
      [uid]
    );

    // 2. If user exists, return existing data (skip SSO call)
    if (existingUsers.length > 0) {
      return existingUsers[0];
    }

    // 3. User not found - fetch profile from SSO (only for new users)
    const response = await ssoService.getUserProfileFromSSO(uid, accessToken);
    const userData = response.data;

    if (userData.code !== 0 || !userData.data) {
      console.error('Failed to get user profile from SSO');
      return null;
    }

    const profile = userData.data;
    const email = profile.primary_email;
    const name = profile.name || profile.username || email.split('@')[0];
    const role = profile.role || 6;
    const department = role <= 4 ? '資科系' : null;
    const phone_number = profile.phone_number || null;

    // 4. Insert new user
    await db.query(
      'INSERT INTO users (user_id, name, email, phone_number, role, department) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, name, email, phone_number, role, department]
    );

    return {
      user_id: uid,
      email,
      name,
      role: role,
      department,
    };
  } catch (error) {
    console.error('Error syncing user to local DB:', error.message);
    return null;
  }
}

module.exports = { syncUserToLocalDB };
