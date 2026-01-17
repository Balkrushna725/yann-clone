// const jwt = require("jsonwebtoken");

// const authMiddleware = (req, res, next) => {
//   try {
//     // 1. Get token from header
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         success: false,
//         message: "Authorization token missing",
//         data: null
//       });
//     }

//     // 2. Format: "Bearer TOKEN"
//     const token = authHeader.split(" ")[1];

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token format",
//         data: null
//       });
//     }

//     // 3. Verify token
//     const decoded = jwt.verify(
//       token,
//       process.env.JWT_SECRET || "yaan_secret"
//     );

//     // 4. Attach user to request
//     req.user = decoded;

//     next(); // allow request

//   } catch (err) {
//     return res.status(401).json({
//       success: false,
//       message: "Unauthorized or token expired",
//       data: null
//     });
//   }
// };

// module.exports = authMiddleware;
const { verifyToken } = require('../config/jwt');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authorization token missing',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format',
      });
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.user_id) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token payload',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.length) {
    return next();
  }

  const { user } = req;

  if (!user || !user.role || !allowedRoles.includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Insufficient permissions',
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  authorizeRoles,
};
