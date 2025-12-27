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
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ❌ No token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach user to request
    req.user = decoded;

    next(); // allow request

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

module.exports = authMiddleware;
