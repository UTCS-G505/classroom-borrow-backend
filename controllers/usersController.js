const pool = require('../db');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// === 設定 ===
const SSO_API_URL =
  process.env.SSO_API_URL || 'https://algotutor.utaipei.edu.tw:1777/api/v1';

// 讀取公鑰
const PUBLIC_KEY = fs.readFileSync(
  path.join(__dirname, '../keys/public.pem'),
  'utf8'
);

// Cookie 配置 - 開發環境跨域設定
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // 允許同站請求帶 cookie
  path: '/', // Cookie 對所有路徑有效
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
};

// === Middleware：驗證 Token ===
exports.authenticateToken = (req, res, next) => {
  // 從 Authorization header 中取得 token
  const authHeader = req.headers['authorization'];
  const accessToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      message: '未提供 access token',
    });
  }

  // 使用公鑰驗證 JWT
  jwt.verify(
    accessToken,
    PUBLIC_KEY,
    { algorithms: ['RS256'] },
    (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          console.log('Token 已過期');
          return res.status(401).json({
            success: false,
            message: 'access token 過期',
          });
        }
        console.log('Token 驗證失敗:', err.message);
        return res.status(403).json({
          success: false,
          message: 'access token 無效',
          error: err.message,
        });
      }

      next();
    }
  );
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
    const ssoResponse = await axios.post(SSO_API_URL + '/auth/login', params, {
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

      if (refreshTokenCookie) {
        const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1];
        res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
      }
      if (uid) {
        const uidValue = uid.split(';')[0].split('=')[1];
        res.cookie('uid', uidValue, { ...COOKIE_OPTIONS, httpOnly: false }); // uid 可讓前端讀取
      }

      res.json({
        success: true,
        message: 'SSO 登入成功',
        data: {
          uid: uid.split(';')[0].split('=')[1],
          accessToken: accessToken,
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

exports.refreshToken = async (req, res) => {
  const refreshToken = req.cookies['refresh_token'];

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: '未提供 refresh token',
    });
  }

  try {
    const response = await axios.post(
      `${SSO_API_URL}/auth/refresh`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refresh_token=${refreshToken}`,
        },
        withCredentials: true,
      }
    );
    const data = response.data;

    if (data.code === 0) {
      const accessToken = data.data.access_token;

      if (!accessToken) {
        res.status(500).json({
          success: false,
          message: 'SSO 未回傳必要的驗證資料',
        });
        return;
      }

      res.json({
        success: true,
        message: 'SSO refresh token 成功',
        data: {
          accessToken: accessToken,
        },
      });
    } else {
      res.status(401).json({
        success: false,
        message: data.message || 'Refresh token 無效',
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

exports.logout = async (req, res) => {
  const refreshToken = req.cookies['refresh_token'];

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: '未提供 refresh token',
    });
  }
  try {
    const response = await axios.post(
      `${SSO_API_URL}/auth/logout`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refresh_token=${refreshToken}`,
        },
        withCredentials: true,
      }
    );
    const data = response.data;

    if (data.code === 0) {
      res.clearCookie('refresh_token', COOKIE_OPTIONS);
      res.clearCookie('uid', { ...COOKIE_OPTIONS, httpOnly: false });

      res.json({
        success: true,
        message: '登出成功',
      });
    } else {
      res.status(500).json({
        success: false,
        message: '無法登出',
      });
    }
  } catch (error) {
    console.error('SSO 回傳錯誤:', error.message);
    res.status(500).json({
      success: false,
      message: '系統連線錯誤 (無法連接 SSO)',
    });
  }
};

exports.getProfile = async (req, res) => {
  const uid = req.query.uid;
  const accessToken = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;
  console.log(`取得使用者資料請求，UID: ${uid}`);

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      message: '未提供 access token',
    });
  }

  try {
    const response = await axios.get(SSO_API_URL + `/user/get/${uid}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      withCredentials: true,
    });
    const userData = response.data;

    if (userData.code === 0) {
      res.json({
        success: true,
        data: userData.data,
      });
    } else {
      res.status(500).json({
        success: false,
        message: '無法取得使用者資料',
      });
    }
  } catch (error) {
    console.error('SSO 回傳錯誤:', error.message);
    res.status(500).json({
      success: false,
      message: '系統連線錯誤 (無法連接 SSO)',
    });
  }
};
