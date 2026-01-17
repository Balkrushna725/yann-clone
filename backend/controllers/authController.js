const { generateOTP, storeOTP, verifyOTP } = require('../utils/otpUtils');
const db = require('../config/db');

const sendOtpResponse = (res, otp) =>
  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    otp: process.env.NODE_ENV === 'development' ? otp : undefined
  });

// Generate and send OTP
exports.generateOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const otp = generateOTP();

    await storeOTP(phone, otp);

    console.log(`OTP for ${phone}: ${otp}`);

    sendOtpResponse(res, otp);
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to generate OTP' });
  }
};

// Resend OTP simply reuses generate logic
exports.resendOTP = (req, res) => exports.generateOTP(req, res);

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
    }

    const result = await verifyOTP(phone, otp);

    if (!result.isValid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user = userResult.rows[0];

    if (!user) {
      const newUser = await db.query(
        'INSERT INTO users (phone) VALUES ($1) RETURNING *',
        [phone]
      );
      user = newUser.rows[0];
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        userId: user.user_id,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
};
