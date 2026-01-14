const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Read key once at startup
// const PUBLIC_KEY = fs.readFileSync(
//   path.join(__dirname, '../keys/public.pem'),
//   'utf8'
// );

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const accessToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

  if (!accessToken)
    return res
      .status(401)
      .json({ success: false, message: '未提供 access token' });

  // jwt.verify(
  //   accessToken,
  //   PUBLIC_KEY,
  //   { algorithms: ['RS256'] },
  //   (err, decoded) => {
  //     if (err) {
  //       // ... error handling logic ...
  //       return res
  //         .status(403)
  //         .json({ success: false, message: 'Invalid Token' });
  //     }
  //     req.user = decoded; // Attach user info to request
  //     next();
  //   }
  // );
  next();
};
