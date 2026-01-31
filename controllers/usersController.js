const ssoService = require('../services/ssoService');
const db = require('../db');
const { getJwtSub } = require('../utils/jwtUtils');

// Cookie 配置 - 開發環境跨域設定
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // 允許同站請求帶 cookie
  path: '/', // Cookie 對所有路徑有效
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
};

/**
 * Sync user from SSO to local database
 * Creates new user or updates existing user based on email
 */
async function syncUserToLocalDB(uid, accessToken) {
  try {
    // Get user profile from SSO
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

    // Check if user exists in local DB
    const [existingUsers] = await db.query(
      'SELECT user_id, role FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      // Update existing user (preserve role)
      await db.query(
        'UPDATE users SET name = ?, department = ? WHERE email = ?',
        [name, department, email]
      );
      return {
        user_id: existingUsers[0].user_id,
        email,
        name,
        role: existingUsers[0].role,
        department,
      };
    } else {
      const [result] = await db.query(
        'INSERT INTO users (name, email, phone_number, role, department) VALUES (?, ?, ?, ?, ?)',
        [name, email, phone_number, role, department]
      );
      console.log(`Created new user: ${email} with ID: ${result.insertId}`);
      return {
        user_id: result.insertId,
        email,
        name,
        role: role,
        department,
      };
    }
  } catch (error) {
    console.error('Error syncing user to local DB:', error.message);
    return null;
  }
}

// 登入 API (整合 SSO + JWT)
exports.login = async (req, res) => {
  const { account, password } = req.body;
  console.log(`收到登入請求: ${account}`);

  try {
    // 發送請求給學校 SSO
    const ssoResponse = await ssoService.loginToSSO(account, password);
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
      
      if (!accessToken || !refreshTokenCookie) {
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

      const uidValue = getJwtSub(accessToken);
      if (uidValue) {
        res.cookie('uid', uidValue, { ...COOKIE_OPTIONS, httpOnly: false }); // uid 可讓前端讀取
      }

      // Sync user to local database
      const localUser = await syncUserToLocalDB(uidValue, accessToken);

      res.json({
        success: true,
        message: 'SSO 登入成功',
        data: {
          uid: uidValue,
          accessToken: accessToken,
          user: localUser, // Include local user info with role
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
    const response = await ssoService.refreshTokenFromSSO(refreshToken);
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
    const response = await ssoService.logoutFromSSO(refreshToken);
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
    const response = await ssoService.getUserProfileFromSSO(uid, accessToken);
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
