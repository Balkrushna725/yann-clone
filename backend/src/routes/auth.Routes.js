const authMiddleware = require("../middleware/auth.middleware");




const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../utils/postgres");

const router = express.Router();

// ======================
// HELPERS
// ======================
const isValidPhone = (phone) => /^\d{10}$/.test(phone);
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ======================
// REQUEST OTP
// ======================
router.post("/request-otp", async (req, res) => {
  try {
    const { phone, email } = req.body;

    // 🔐 Input validation
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: "Phone or email is required",
        data: null
      });
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
        data: null
      });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        data: null
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // Delete old OTP
    await pool.query(
      `DELETE FROM otp_verification WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    // Insert new OTP
    await pool.query(
      `INSERT INTO otp_verification (phone, email, otp_code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [phone || null, email || null, otp, expiresAt]
    );

    // Check user exists
    const userResult = await pool.query(
      `SELECT user_id FROM users WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    console.log("DEV OTP:", otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent",
      data: {
        isNewUser: userResult.rows.length === 0
      }
    });

  } catch (error) {
    console.error("REQUEST OTP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null
    });
  }
});

// ======================
// VERIFY OTP
// ======================
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, email, otp, full_name } = req.body;

    // 🔐 Input validation
    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: "Phone or email required",
        data: null
      });
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
        data: null
      });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        data: null
      });
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Valid 6-digit OTP required",
        data: null
      });
    }

    // Fetch OTP
    const otpResult = await pool.query(
      `SELECT * FROM otp_verification
       WHERE otp_code = $3 AND (phone = $1 OR email = $2)`,
      [phone || null, email || null, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        data: null
      });
    }

    // ⏱ OTP expiry
    if (new Date(otpResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
        data: null
      });
    }

    // Find user
    let userResult = await pool.query(
      `SELECT * FROM users WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    // Create user if not exists
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        `INSERT INTO users (phone, email, full_name, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [phone || null, email || null, full_name || null]
      );
    }

    const user = userResult.rows[0];

    // Delete OTP
    await pool.query(
      `DELETE FROM otp_verification WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    // JWT token
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user
      }
    });

  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null
    });
  }
});
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Profile fetched",
      data: {
        userId: req.user.userId
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      data: null
    });
  }
});


module.exports = router;

