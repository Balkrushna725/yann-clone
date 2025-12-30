const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

// use centralized User model to avoid duplicate schema compilation
const User = require("../models/User");

const router = express.Router();

/* Using shared User model (src/models/User.js) */

/* ---------------- STEP 1: REQUEST OTP ---------------- */
router.post("/request-otp", async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email ? email : null },
          { phone: phone ? phone : null }
        ]
      }
    });

    if (!user) {
      user = await User.create({ email, phone });
    }

    user.otp = otp;
    user.otpExpiresAt = expires;
    await user.save();

    console.log("YAAN OTP:", otp); // testing only

    res.json({
      message: "OTP sent",
      isNewUser: !user.firstName
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- STEP 1.5: RESEND OTP ---------------- */
router.post("/resend-otp", async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({ $or: [{ email }, { phone }] });

    if (!user) {
      user = new User({ email, phone });
    }

    user.otp = otp;
    user.otpExpiresAt = expires;
    await user.save();

    console.log("YAAN OTP:", otp); // testing only

    res.json({
      message: "OTP resent",
      isNewUser: !user.firstName
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- STEP 2: VERIFY OTP + NAME ---------------- */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, phone, otp, firstName, lastName } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email ? email : null },
          { phone: phone ? phone : null }
        ]
      }
    });

    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (!user.firstName && firstName) {
      user.firstName = firstName;
      user.lastName = lastName;
    }

    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "yaan_secret",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- STEP 3: UPDATE PROFILE (GENDER / EMERGENCY) ---------------- */
router.post('/update-profile', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'yaan_secret');
    } catch (e) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const userId = payload.userId;
    const { gender, emergencyNumber, firstName, lastName, email } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (gender) user.gender = gender;
    if (emergencyNumber) user.emergencyNumber = emergencyNumber;
    if (email) user.email = email;

    await user.save();

    res.json({ message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
