const { generateOTP, storeOTP, verifyOTP } = require('../utils/otpUtils');
const db = require('../config/db');

// Generate and send OTP
exports.generateOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP in the database
    await storeOTP(phone, otp);

    // In a real application, you would send the OTP via SMS here
    console.log(`OTP for ${phone}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // In production, don't send OTP in response
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to generate OTP' });
  }
};

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

    // Check if user exists, if not create a new user
    const userResult = await db.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    let user = userResult.rows[0];

    if (!user) {
      // Create a new user with just the phone number
      const newUser = await db.query(
        'INSERT INTO users (phone) VALUES ($1) RETURNING *',
        [phone]
      );
      user = newUser.rows[0];
    }

    // In a real application, you would generate a JWT token here
    // For now, we'll just return the user ID
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
