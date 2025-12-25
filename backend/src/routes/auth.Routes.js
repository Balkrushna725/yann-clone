// const express = require("express");
// const jwt = require("jsonwebtoken");
// const pool = require("../utils/postgres"); // ✅ correct path

// const router = express.Router();

// /* =========================
//    STEP 1: REQUEST OTP
// ========================= */
// router.post("/request-otp", async (req, res) => {
//   try {
//     const { phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({ message: "Phone required" });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

//     // delete old OTP (simple & safe)
//     await pool.query(
//       `DELETE FROM otp_verification WHERE phone = $1`,
//       [phone]
//     );

//     // insert new OTP
//     await pool.query(
//       `
//       INSERT INTO otp_verification (phone, otp_code, expires_at)
//       VALUES ($1, $2, $3)
//       `,
//       [phone, otp, expiresAt]
//     );

//     // check if user exists
//     const userResult = await pool.query(
//       `SELECT user_id FROM users WHERE phone = $1`,
//       [phone]
//     );

//     console.log("YAAN OTP:", otp); // dev only

//     res.status(200).json({
//       message: "OTP sent",
//       isNewUser: userResult.rows.length === 0
//     });

//   } catch (err) {
//     console.error("REQUEST OTP ERROR:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// /* =========================
//    STEP 2: VERIFY OTP
// ========================= */
// router.post("/verify-otp", async (req, res) => {
//   try {
//     const { phone, otp, full_name } = req.body;

//     if (!phone || !otp) {
//       return res.status(400).json({ message: "Phone & OTP required" });
//     }

//     const otpResult = await pool.query(
//       `
//       SELECT * FROM otp_verification
//       WHERE phone = $1 AND otp_code = $2
//       `,
//       [phone, otp]
//     );

//     if (otpResult.rows.length === 0) {
//       return res.status(400).json({ message: "Invalid OTP" });
//     }

//     if (new Date(otpResult.rows[0].expires_at) < new Date()) {
//       return res.status(400).json({ message: "OTP expired" });
//     }

//     // find user
//     let userResult = await pool.query(
//       `SELECT * FROM users WHERE phone = $1`,
//       [phone]
//     );

//     // create user if not exists
//     if (userResult.rows.length === 0) {
//       userResult = await pool.query(
//         `
//         INSERT INTO users (phone, full_name, created_at)
//         VALUES ($1, $2, NOW())
//         RETURNING *
//         `,
//         [phone, full_name || null]
//       );
//     }

//     const user = userResult.rows[0];

//     // delete OTP after successful login
//     await pool.query(
//       `DELETE FROM otp_verification WHERE phone = $1`,
//       [phone]
//     );

//     const token = jwt.sign(
//       { userId: user.user_id },
//       process.env.JWT_SECRET || "yaan_secret",
//       { expiresIn: "7d" }
//     );

//     res.status(200).json({
//       message: "Login successful",
//       token,
//       user
//     });

//   } catch (err) {
//     console.error("VERIFY OTP ERROR:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;

const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../utils/postgres");

const router = express.Router();

/* =========================
   STEP 1: REQUEST OTP
========================= */
router.post("/request-otp", async (req, res) => {
  try {
    const { phone, email } = req.body;

    if (!phone && !email) {
      return res.status(400).json({ message: "Phone or Email required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // delete old OTP
    await pool.query(
      `DELETE FROM otp_verification WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    // insert new OTP
    await pool.query(
      `
      INSERT INTO otp_verification (phone, email, otp_code, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [phone || null, email || null, otp, expiresAt]
    );

    // check if user exists
    const userResult = await pool.query(
      `SELECT user_id FROM users WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    console.log("YAAN OTP:", otp); // dev only

    res.status(200).json({
      message: "OTP sent",
      isNewUser: userResult.rows.length === 0
    });

  } catch (err) {
    console.error("REQUEST OTP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   STEP 2: VERIFY OTP
========================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, email, otp, full_name } = req.body;

    if ((!phone && !email) || !otp) {
      return res.status(400).json({ message: "Identifier & OTP required" });
    }

    const otpResult = await pool.query(
      `
      SELECT * FROM otp_verification
      WHERE otp_code = $3 AND (phone = $1 OR email = $2)
      `,
      [phone || null, email || null, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date(otpResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // find user
    let userResult = await pool.query(
      `SELECT * FROM users WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    // create user if not exists
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        `
        INSERT INTO users (phone, email, full_name, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
        `,
        [phone || null, email || null, full_name || null]
      );
    }

    const user = userResult.rows[0];

    // delete OTP
    await pool.query(
      `DELETE FROM otp_verification WHERE phone = $1 OR email = $2`,
      [phone || null, email || null]
    );

    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET || "yaan_secret",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user
    });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;




