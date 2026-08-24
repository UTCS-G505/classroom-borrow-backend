const axios = require('axios');

// === 設定 ===
const SSO_API_URL =
  process.env.SSO_API_URL || 'https://csportal.utaipei.edu.tw/api/v1';
const USER_AGENT = 'ClassroomBorrowBackend';

/**
 * 向 SSO 發送登入請求
 * @param {string} account - 使用者帳號
 * @param {string} password - 使用者密碼
 * @returns {Promise<Object>} SSO 回應資料
 */
exports.loginToSSO = async (account, password) => {
  const params = new URLSearchParams();
  params.append('username', account);
  params.append('password', password);

  console.log('正在發送請求至 SSO...');

  const response = await axios.post(SSO_API_URL + '/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    withCredentials: true,
  });

  return response;
};

/**
 * 向 SSO 發送 refresh token 請求
 * @param {string} refreshToken - refresh token
 * @returns {Promise<Object>} SSO 回應資料
 */
exports.refreshTokenFromSSO = async (refreshToken) => {
  const response = await axios.post(
    `${SSO_API_URL}/refresh`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
        'User-Agent': USER_AGENT,
      },
      withCredentials: true,
    }
  );

  return response;
};

/**
 * 向 SSO 發送登出請求
 * @param {string} refreshToken - refresh token
 * @returns {Promise<Object>} SSO 回應資料
 */
exports.logoutFromSSO = async (refreshToken) => {
  const response = await axios.post(
    `${SSO_API_URL}/logout`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
        'User-Agent': USER_AGENT,
      },
      withCredentials: true,
    }
  );

  return response;
};

/**
 * 從 SSO 取得使用者資料
 * @param {string} userId - SSO user UUID
 * @param {string} accessToken - access token
 * @returns {Promise<Object>} SSO 回應資料
 */
exports.getUserProfileFromSSO = async (userId, accessToken) => {
  const response = await axios.get(SSO_API_URL + `/user/${userId}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT,
    },
    withCredentials: true,
  });

  return response;
};
