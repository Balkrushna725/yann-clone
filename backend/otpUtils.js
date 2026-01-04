const db = require('../config/db');
const OTP_EXPIRY_MINUTES = process.env.OTP_EXPIRY_MINUTES || 5;

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP in the database
const storeOTP = async (phone, otp) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(OTP_EXPIRY_MINUTES));

  // Delete any existing OTP for this phone number
  await db.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);
  
  // Store the new OTP
  await db.query(
    'INSERT INTO otp_verification (phone, otp, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [phone, otp, expiresAt]
  );
};

// Verify OTP
const verifyOTP = async (phone, otp) => {
  const result = await db.query(
    'SELECT * FROM otp_verification WHERE phone = $1 AND otp = $2 AND expires_at > NOW()',
    [phone, otp]
  );

  if (result.rows.length === 0) {
    return { isValid: false, message: 'Invalid or expired OTP' };
  }

  // Delete the used OTP
  await db.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);
  
  return { isValid: true, message: 'OTP verified successfully' };
};

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
};
