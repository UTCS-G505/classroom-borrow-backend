const db = require('../db');
const ssoService = require('../services/ssoService');

/**
 * Sync user from SSO to local database
 * Checks database first - only calls SSO if user is NOT found
 * This optimizes performance for returning users
 *
 * @param {string} userId - SSO user UUID
 * @param {string} accessToken - SSO Access Token
 * @returns {Promise<Object|null>} User object if sync successful, null otherwise
 */
async function syncUserToLocalDB(userId, accessToken) {
  try {
    // 1. Check if user exists in local DB FIRST
    const [existingUsers] = await db.query(
      'SELECT user_id, name, email, role, department FROM users WHERE user_id = ?',
      [userId]
    );

    // 2. If user exists, return existing data (skip SSO call)
    if (existingUsers.length > 0) {
      return existingUsers[0];
    }

    // 3. User not found - fetch profile from SSO (only for new users)
    const response = await ssoService.getUserProfileFromSSO(
      userId,
      accessToken
    );
    const userData = response.data;

    if (userData.code !== 0 || !userData.data) {
      console.error(
        `Failed to get user profile from SSO: code=${userData.code} message=${userData.message}`
      );
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
      [userId, name, email, phone_number, role, department]
    );

    return {
      user_id: userId,
      email,
      name,
      role: role,
      department,
    };
  } catch (error) {
    // 只印 error.message 會得到像 "Request failed with status code 404" 這種
    // 看不出是哪個端點、也看不出是 SSO 還是資料庫出錯的訊息。這裡分流記錄，
    // 讓日誌本身就足以定位問題。
    if (error.response) {
      const method = error.config?.method?.toUpperCase() || 'GET';
      const body =
        typeof error.response.data === 'string'
          ? error.response.data.slice(0, 200)
          : JSON.stringify(error.response.data);
      console.error(
        `Error syncing user to local DB: SSO ${method} ${error.config?.url} 回傳 ${error.response.status} - ${body}`
      );
    } else if (error.code) {
      console.error(
        `Error syncing user to local DB: 資料庫錯誤 ${error.code} - ${error.sqlMessage || error.message}`
      );
    } else {
      console.error('Error syncing user to local DB:', error.message);
    }
    return null;
  }
}

module.exports = { syncUserToLocalDB };
