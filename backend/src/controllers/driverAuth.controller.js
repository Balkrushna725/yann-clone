const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { signToken } = require('../config/jwt');
const {
  generateRideOtp,
  hashOtp,
  verifyOtpHash,
  OTP_EXPIRY_MINUTES,
} = require('../utils/otp.util');
const { normalisePhone, validatePhone } = require('../utils/phone.util');

const DRIVER_ROLE = 'driver';

const buildDriverProfile = (driver) => ({
  id: driver.driver_id,
  full_name: driver.full_name,
  phone: driver.phone,
  email: driver.email,
  is_verified: driver.is_verified,
  role: DRIVER_ROLE,
  is_available: driver.is_available,
});

exports.requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'A valid phone number is required',
      });
    }

    const normalisedPhone = normalisePhone(phone);
    const otp = generateRideOtp();
    const hashedOtp = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.query(
      `DELETE FROM otp_verification WHERE phone = $1 AND user_type = $2`,
      [normalisedPhone, DRIVER_ROLE]
    );

    await db.query(
      `INSERT INTO otp_verification (phone, otp_hash, user_type, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalisedPhone, hashedOtp, DRIVER_ROLE, expiresAt]
    );

    const driverResult = await db.query(
      `SELECT driver_id FROM drivers WHERE phone = $1`,
      [normalisedPhone]
    );

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        is_new_account: driverResult.rowCount === 0,
        expires_at: expiresAt.toISOString(),
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      },
    });
  } catch (error) {
    console.error('driver.requestOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};

exports.verifyOtp = async (req, res) => {
  const client = await db.getClient();

  try {
    const { phone, otp, full_name, email } = req.body;

    if (!phone || !validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'A valid phone number is required',
      });
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'A valid 6-digit OTP is required',
      });
    }

    const normalisedPhone = normalisePhone(phone);

    const otpResult = await db.query(
      `SELECT otp_hash, expires_at
       FROM otp_verification
       WHERE phone = $1 AND user_type = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalisedPhone, DRIVER_ROLE]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or already used',
      });
    }

    const otpRecord = otpResult.rows[0];

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired',
      });
    }

    const isValidOtp = await verifyOtpHash(otp, otpRecord.otp_hash);

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    await client.query('BEGIN');

    const driverResult = await client.query(
      `SELECT driver_id, full_name, email, is_available, is_verified
       FROM drivers
       WHERE phone = $1
       FOR UPDATE`,
      [normalisedPhone]
    );

    let driver;

    if (driverResult.rowCount === 0) {
      const insertResult = await client.query(
        `INSERT INTO drivers (driver_id, phone, full_name, email, is_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING driver_id, phone, full_name, email, is_available, is_verified`,
        [uuidv4(), normalisedPhone, full_name || null, email || null]
      );

      driver = insertResult.rows[0];
    } else {
      const existingDriver = driverResult.rows[0];

      const updateResult = await client.query(
        `UPDATE drivers
         SET full_name = COALESCE($2, full_name),
             email = COALESCE($3, email),
             is_verified = TRUE,
             updated_at = NOW()
         WHERE driver_id = $1
         RETURNING driver_id, phone, full_name, email, is_available, is_verified`,
        [existingDriver.driver_id, full_name || null, email || null]
      );

      driver = updateResult.rows[0];
    }

    await client.query(
      `DELETE FROM otp_verification WHERE phone = $1 AND user_type = $2`,
      [normalisedPhone, DRIVER_ROLE]
    );

    await client.query('COMMIT');

    const payload = {
      id: driver.driver_id,
      user_id: driver.driver_id,
      role: DRIVER_ROLE,
    };

    const token = signToken(payload);
    const profile = buildDriverProfile({ ...driver, phone: normalisedPhone });

    return res.status(200).json({
      success: true,
      message: 'Driver login successful',
      data: {
        token,
        profile,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('driver.verifyOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  } finally {
    client.release();
  }
};
