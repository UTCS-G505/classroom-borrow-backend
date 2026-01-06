const pool = require('../db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Cookies = require('js-cookie');

// === 設定 ===
const SSO_API_URL = 'https://algotutor.utaipei.edu.tw:1777/api/v1/auth/login';

// === 輔助函式：產生 Token (JWT) ===
function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(user) {
  return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

// === Middleware：驗證 Token ===
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json({ success: false, message: '未提供 Token' });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err)
      return res
        .status(403)
        .json({ success: false, message: 'Token 無效或過期' });
    req.user = user;
    next();
  });
};

// === Controller Functions ===

// 登入 API (整合 SSO + JWT)
exports.login = async (req, res) => {
  const { account, password } = req.body;
  console.log(`收到登入請求: ${account}`);

  try {
    // A. 準備發送給 SSO 的資料 (application/x-www-form-urlencoded)
    const params = new URLSearchParams();
    params.append('username', account);
    params.append('password', password);

    console.log('正在發送請求至 SSO...');

    // B. 發送請求給學校 SSO
    const ssoResponse = await axios.post(SSO_API_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      withCredentials: true,
    });

    const ssoData = ssoResponse.data;

    // C. 判斷 SSO 結果
    if (ssoData.code === 0) {
      console.log('SSO 驗證成功');

      // Get cookies from response headers
      const cookies = ssoResponse.headers['set-cookie'];

      // Parse specific cookie
      if (cookies === undefined) {
        res.status(500).json({
          success: false,
          message: 'SSO 未回傳必要的 Cookie',
        });
        return;
      }

      const accessToken = ssoData.data.access_token;
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith('refresh_token=')
      );
      const uid = cookies.find((cookie) => cookie.startsWith('uid='));

      if (!accessToken || !refreshTokenCookie || !uid) {
        res.status(500).json({
          success: false,
          message: 'SSO 未回傳必要的驗證資料',
        });
        return;
      }

      res.cookie('access_token', accessToken); // TODO: secure cookies
      if (refreshTokenCookie) {
        const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1];
        res.cookie('refresh_token', refreshToken); // TODO: secure cookies
      }
      if (uid) {
        const uidValue = uid.split(';')[0].split('=')[1];
        res.cookie('uid', uidValue); // TODO: secure cookies
      }

      res.json({
        success: true,
        message: 'SSO 登入成功',
        data: {
          uid: uid.split(';')[0].split('=')[1],
        },
      });
    } else {
      // SSO 回傳 200 但 code 不為 0
      res.status(401).json({
        success: false,
        message: ssoData.message || '帳號或密碼錯誤',
      });
    }
  } catch (error) {
    console.error('SSO 回傳錯誤:', error.message);

    // 處理 SSO 回傳的錯誤狀態 (例如 401)
    if (error.response) {
      console.error('SSO 狀態碼:', error.response.status);

      if (error.response.status === 401) {
        return res.status(401).json({
          success: false,
          message: '帳號或密碼錯誤',
        });
      }
    }

    res.status(500).json({
      success: false,
      message: '系統連線錯誤 (無法連接 SSO)',
    });
  }
};

// Refresh Token API (前端換發新 Token 用)
exports.refreshToken = (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res
      .status(401)
      .json({ success: false, message: '無 Refresh Token' });

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err)
      return res
        .status(403)
        .json({ success: false, message: 'Refresh Token 無效' });
    const userPayload = {
      name: user.name,
      account: user.account,
      role: user.role,
    };
    const accessToken = generateAccessToken(userPayload);
    res.json({ success: true, accessToken });
  });
};

// 取得使用者資料 (需驗證 Token)
exports.getProfile = (req, res) => {
  res.json({ success: true, user: req.user });
};
