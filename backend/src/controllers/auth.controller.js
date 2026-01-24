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

const USER_ROLE = 'user';

const buildEmergencyContacts = (contacts) => {
  if (!Array.isArray(contacts)) {
    return [];
  }

  return contacts
    .map((contact) => ({
      name: contact?.name?.trim(),
      phone: contact?.phone ? normalisePhone(contact.phone) : null,
      relation: contact?.relation?.trim() || null,
    }))
    .filter((contact) => contact.name && contact.phone);
};

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
      `DELETE FROM login_otps WHERE phone = $1 AND role = $2`,
      [normalisedPhone, USER_ROLE]
    );

    await db.query(
      `INSERT INTO login_otps (login_otp_id, phone, role, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), normalisedPhone, USER_ROLE, hashedOtp, expiresAt]
    );

    const accountResult = await db.query(
      `SELECT user_id FROM users WHERE phone = $1`,
      [normalisedPhone]
    );
    const isNewAccount = accountResult.rowCount === 0;

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        is_new_account: isNewAccount,
        expires_at: expiresAt.toISOString(),
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      },
    });
  } catch (error) {
    console.error('requestOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
};

exports.verifyOtp = async (req, res) => {
  const client = await db.getClient();

  try {
    const {
      phone,
      otp,
      full_name,
      gender,
      emergency_contacts: emergencyContacts,
    } = req.body;

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
       FROM login_otps
       WHERE phone = $1 AND role = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalisedPhone, USER_ROLE]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or already used',
      });
    }

    const record = otpResult.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired',
      });
    }

    const isValidOtp = await verifyOtpHash(otp, record.otp_hash);

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    await client.query('BEGIN');

    let account;

    const cleanedContacts = buildEmergencyContacts(emergencyContacts);
    let emergencyContactsSnapshot = [];

    const userResult = await client.query(
      `SELECT user_id, full_name, gender
       FROM users
       WHERE phone = $1`,
      [normalisedPhone]
    );

    if (userResult.rowCount === 0) {
      const insertResult = await client.query(
        `INSERT INTO users (user_id, phone, full_name, gender)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, full_name, gender`,
        [uuidv4(), normalisedPhone, full_name || null, gender || null]
      );

      account = insertResult.rows[0];
    } else {
      const existing = userResult.rows[0];
      const nextGender = gender || existing.gender;
      const nextFullName = full_name || existing.full_name;

      const updateResult = await client.query(
        `UPDATE users
         SET full_name = $2,
             gender = $3,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, full_name, gender`,
        [existing.user_id, nextFullName, nextGender]
      );

      account = updateResult.rows[0];
    }

    const effectiveGender = account.gender ? account.gender.toLowerCase() : null;

    if (effectiveGender === 'female') {
      const existingContactsResult = await client.query(
        `SELECT contact_id, name, phone, relation
         FROM emergency_contacts
         WHERE user_id = $1`,
        [account.user_id]
      );

      const existingContacts = existingContactsResult.rows;

      if (cleanedContacts.length > 0) {
        await client.query(
          `DELETE FROM emergency_contacts WHERE user_id = $1`,
          [account.user_id]
        );

        if (cleanedContacts.length > 0) {
          const insertResults = await Promise.all(
            cleanedContacts.map((contact) =>
              client.query(
                `INSERT INTO emergency_contacts (contact_id, user_id, name, phone, relation)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING contact_id, name, phone, relation`,
                [uuidv4(), account.user_id, contact.name, contact.phone, contact.relation]
              )
            )
          );

          emergencyContactsSnapshot = insertResults.map((result) => result.rows[0]);
        }
      } else {
        emergencyContactsSnapshot = existingContacts;
      }

      if (emergencyContactsSnapshot.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Female users must provide emergency contacts',
        });
      }

      account.emergency_contacts = emergencyContactsSnapshot;
    }

    await client.query(
      `DELETE FROM login_otps WHERE phone = $1 AND role = $2`,
      [normalisedPhone, USER_ROLE]
    );

    await client.query('COMMIT');

    const payload = {
      id: account.user_id,
      user_id: account.user_id,
      role: USER_ROLE,
    };

    const token = signToken(payload);

    const profile = {
      id: payload.id,
      full_name: account.full_name,
      phone: normalisedPhone,
      role: USER_ROLE,
    };

    if (Array.isArray(account.emergency_contacts)) {
      profile.emergency_contacts = account.emergency_contacts.map((contact) => ({
        name: contact.name,
        phone: contact.phone,
        relation: contact.relation,
      }));
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        profile,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('verifyOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
    });
  } finally {
    client.release();
  }
};

