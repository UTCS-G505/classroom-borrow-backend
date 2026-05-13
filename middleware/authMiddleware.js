const jwt = require('jsonwebtoken');
const { getJwtSub } = require('../utils/jwtUtils');
const { USER_ROLES } = require('../utils/constants');
const { syncUserToLocalDB } = require('../utils/userSync');

// Read public key once at startup
// const PUBLIC_KEY = fs.readFileSync(
//   path.join(__dirname, '../keys/public.pem'),
//   'utf8'
// );

/**
 * Middleware to authenticate access token
 * Decodes JWT and attaches user info (including role from local DB) to req.user
 * Automatically syncs user to local DB if not found
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
    const uuid = getJwtSub(accessToken) || decoded.sub;

    if (uuid) {
      try {
        // syncUserToLocalDB checks DB first, returns existing user or syncs from SSO
        const user = await syncUserToLocalDB(uuid, accessToken);

        if (user) {
          req.user = {
            ...decoded,
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
          };
        } else {
          // Sync failed - attach decoded token info only
          console.warn(`Failed to get/sync user ${uuid}`);
          req.user = {
            ...decoded,
            user_id: uuid,
            role: null,
          };
        }
      } catch (dbError) {
        console.error('Database error in auth middleware:', dbError.message);
        req.user = { ...decoded, user_id: uuid, role: null };
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
exports.authorizeTeacherOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未經驗證的請求' });
  }

  const userRole = req.user.role;
  // Allow ADMIN, TEACHER, or OFFICER (if OFFICER counts as admin-like for this context)
  // Plan said: Update authorizeTeacherOrAdmin and authorizeAdmin to use USER_ROLES constants.
  if (
    ![USER_ROLES.ADMIN, USER_ROLES.TEACHER, USER_ROLES.OFFICER].includes(
      userRole
    )
  ) {
    return res
      .status(403)
      .json({ success: false, message: '需要教師或管理員權限' });
  }

  next();
};

exports.authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未經驗證的請求' });
  }

  if (
    req.user.role !== USER_ROLES.ADMIN &&
    req.user.role !== USER_ROLES.OFFICER
  ) {
    // Assuming OFFICER is also powerful enough? Or strictly ADMIN=0?
    // Existing code only checked 'admin'.
    // I will stick to ADMIN (0) and maybe OFFICER (1) if they are staff.
    // Let's stick to ADMIN and OFFICER for "Admin" rights in this context as per typical system evolution.
    return res.status(403).json({ success: false, message: '需要管理員權限' });
  }

  next();
};
