const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const db = require('../db');

// Read public key once at startup
// const PUBLIC_KEY = fs.readFileSync(
//   path.join(__dirname, '../keys/public.pem'),
//   'utf8'
// );

/**
 * Middleware to authenticate access token
 * Decodes JWT and attaches user info (including role from local DB) to req.user
 */
exports.authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const accessToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

  if (!accessToken) {
    return res
      .status(401)
      .json({ success: false, message: '未提供 access token' });
  }

  try {
    // TODO: Enable signature verification when SSO public key is available
    // const decoded = jwt.verify(accessToken, PUBLIC_KEY, { algorithms: ['RS256'] });

    // For now, decode without verification (TEMPORARY - for development only)
    const decoded = jwt.decode(accessToken);

    if (!decoded) {
      return res.status(403).json({ success: false, message: 'Invalid Token' });
    }

    // Get user from local database to include role information
    const uid = req.cookies['uid'] || decoded.sub || decoded.uid;

    if (uid) {
      try {
        const [users] = await db.query(
          'SELECT user_id, name, email, role, department FROM users WHERE user_id = ? OR email = ?',
          [uid, decoded.email || '']
        );

        if (users.length > 0) {
          req.user = {
            ...decoded,
            user_id: users[0].user_id,
            name: users[0].name,
            email: users[0].email,
            role: users[0].role,
            department: users[0].department,
          };
        } else {
          // User not in local DB yet - attach decoded token info only
          req.user = {
            ...decoded,
            uid: uid,
            role: null, // No role until user is synced to local DB
          };
        }
      } catch (dbError) {
        console.error('Database error in auth middleware:', dbError.message);
        req.user = { ...decoded, uid: uid, role: null };
      }
    } else {
      req.user = decoded;
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(403).json({ success: false, message: 'Invalid Token' });
  }
};

/**
 * Middleware to authorize admin users only
 * Must be used after authenticateToken middleware
 */
exports.authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未經驗證的請求' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '需要管理員權限' });
  }

  next();
};

/**
 * Middleware to authorize teacher or admin users
 * Must be used after authenticateToken middleware
 */
exports.authorizeTeacherOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未經驗證的請求' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res
      .status(403)
      .json({ success: false, message: '需要教師或管理員權限' });
  }

  next();
};
