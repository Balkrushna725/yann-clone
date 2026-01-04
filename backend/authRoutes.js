const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Generate OTP
router.post('/otp/generate', authController.generateOTP);

// Verify OTP
router.post('/otp/verify', authController.verifyOTP);

module.exports = router;
