const bcrypt = require('bcryptjs');

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_SALT_ROUNDS = Number(process.env.OTP_SALT_ROUNDS || 10);

const generateRideOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = async (otp) => bcrypt.hash(otp, OTP_SALT_ROUNDS);

const verifyOtpHash = async (otp, hash) => bcrypt.compare(otp, hash);

module.exports = {
  OTP_EXPIRY_MINUTES,
  generateRideOtp,
  hashOtp,
  verifyOtpHash,
};
