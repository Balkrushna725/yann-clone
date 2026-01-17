const db = require('../config/db');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const storeOTP = async (phone, otp) => {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);

  await db.query(
    'INSERT INTO otp_verification (phone, otp, expires_at) VALUES ($1, $2, $3)',
    [phone, otp, expiresAt]
  );
};

const verifyOTP = async (phone, otp) => {
  const result = await db.query(
    'SELECT * FROM otp_verification WHERE phone = $1 AND otp = $2 AND expires_at > NOW()',
    [phone, otp]
  );

  if (result.rows.length === 0) {
    return { isValid: false, message: 'Invalid or expired OTP' };
  }

  await db.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);

  return { isValid: true, message: 'OTP verified successfully' };
};

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
};
