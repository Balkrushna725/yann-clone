const express = require('express');
const driverAuthController = require('../controllers/driverAuth.controller');

const router = express.Router();

router.post('/request-otp', driverAuthController.requestOtp);
router.post('/verify-otp', driverAuthController.verifyOtp);

module.exports = router;
