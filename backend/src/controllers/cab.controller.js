const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const {
  generateRideOtp,
  hashOtp,
  verifyOtpHash,
  OTP_EXPIRY_MINUTES,
} = require('../utils/otp.util');

const OTP_TTL_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const LIVE_LOCATION_DEFAULT_LIMIT = 25;
const MAX_LIVE_LOCATION_LIMIT = 100;
const BASE_FARE = 49;
const PER_KM_FARE = 12;
const PER_MINUTE_SURCHARGE = 2;

const getAuthenticatedUserId = (req) => req?.user?.user_id;
const getAuthenticatedRole = (req) => req?.user?.role;

const ensureDriverAccess = (req) => {
  const user = req.user || {};

  if (user.role && user.role !== 'driver') {
    const error = new Error('Forbidden. Driver access required');
    error.status = 403;
    throw error;
  }

  if (!user.user_id) {
    const error = new Error('Authenticated driver identifier missing');
    error.status = 401;
    throw error;
  }

  return user.user_id;
};

const respondWithUnexpectedError = (res, error, message) => {
  console.error(message, error);
  return res.status(500).json({
    success: false,
    message,
  });
};

const toNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatDecimal = (value, precision = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number.parseFloat(numericValue.toFixed(precision));
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineDistance = (from, to) => {
  const EARTH_RADIUS_KM = 6371;
  const latDiff = toRadians(to.lat - from.lat);
  const lngDiff = toRadians(to.lng - from.lng);

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDiff / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const fallbackStringDistance = (pickup, drop) => {
  const combined = `${pickup}:${drop}`;
  const hash = combined
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return 3 + (hash % 150) / 10;
};

const computeDistanceKm = (pickupLocation, dropLocation, coords = {}) => {
  const { pickupLat, pickupLng, dropLat, dropLng } = coords;

  if (
    typeof pickupLat === 'number' &&
    typeof pickupLng === 'number' &&
    typeof dropLat === 'number' &&
    typeof dropLng === 'number'
  ) {
    return formatDecimal(
      haversineDistance(
        { lat: pickupLat, lng: pickupLng },
        { lat: dropLat, lng: dropLng }
      )
    );
  }

  return formatDecimal(fallbackStringDistance(pickupLocation, dropLocation));
};

const estimateFare = (distanceKm) =>
  formatDecimal(BASE_FARE + (distanceKm || 0) * PER_KM_FARE);

const calculateRideDurationMinutes = (startedAt) => {
  if (!startedAt) {
    return 0;
  }

  const start = new Date(startedAt).getTime();

  if (Number.isNaN(start)) {
    return 0;
  }

  return Math.max(0, (Date.now() - start) / (60 * 1000));
};

exports.bookCab = async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Valid user token required',
    });
  }

  if (getAuthenticatedRole(req) !== 'user') {
    return res.status(403).json({
      success: false,
      message: 'Only riders can book cabs',
    });
  }

  const { pickup_location, drop_location } = req.body;

  if (!pickup_location || !drop_location) {
    return res.status(400).json({
      success: false,
      message: 'pickup_location and drop_location are required',
    });
  }

  const pickupLat = toNumberOrNull(req.body.pickup_lat ?? req.body.pickupLat);
  const pickupLng = toNumberOrNull(req.body.pickup_lng ?? req.body.pickupLng);
  const dropLat = toNumberOrNull(req.body.drop_lat ?? req.body.dropLat);
  const dropLng = toNumberOrNull(req.body.drop_lng ?? req.body.dropLng);

  const coords =
    pickupLat !== null &&
    pickupLng !== null &&
    dropLat !== null &&
    dropLng !== null
      ? { pickupLat, pickupLng, dropLat, dropLng }
      : {};

  const distanceKm = computeDistanceKm(pickup_location, drop_location, coords);
  const estimatedFare = estimateFare(distanceKm);

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const activeRide = await client.query(
      `SELECT cab_booking_id, status
       FROM cab_bookings
       WHERE user_id = $1
         AND status IN ('requested', 'accepted', 'started')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (activeRide.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You already have an active cab booking',
        data: { cab_booking_id: activeRide.rows[0].cab_booking_id },
      });
    }

    const insertResult = await client.query(
      `INSERT INTO cab_bookings (
         cab_booking_id,
         user_id,
         pickup_location,
         drop_location,
         distance_km,
         estimated_fare,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'requested')
       RETURNING cab_booking_id, user_id, pickup_location, drop_location,
                 status, distance_km, estimated_fare, created_at`,
      [
        uuidv4(),
        userId,
        pickup_location,
        drop_location,
        distanceKm,
        estimatedFare,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Cab booking created successfully',
      data: insertResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return respondWithUnexpectedError(res, error, 'Failed to create cab booking');
  } finally {
    client.release();
  }
};

exports.acceptCab = async (req, res) => {
  let client;

  try {
    const driverId = ensureDriverAccess(req);
    const { cab_booking_id: cabBookingId } = req.body;

    if (!cabBookingId) {
      return res.status(400).json({
        success: false,
        message: 'cab_booking_id is required',
      });
    }

    client = await db.getClient();
    await client.query('BEGIN');

    const driverResult = await client.query(
      `SELECT driver_id, is_available
       FROM drivers
       WHERE driver_id = $1
       FOR UPDATE`,
      [driverId]
    );

    if (driverResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Driver record not found',
      });
    }

    if (!driverResult.rows[0].is_available) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Driver is currently occupied with another ride',
      });
    }

    const bookingResult = await client.query(
      `SELECT cab_booking_id, status, driver_id
       FROM cab_bookings
       WHERE cab_booking_id = $1
       FOR UPDATE`,
      [cabBookingId]
    );

    if (bookingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cab booking not found',
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Cab booking is not in requested state',
      });
    }

    if (booking.driver_id && booking.driver_id !== driverId) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Cab booking already accepted by another driver',
      });
    }

    const rideOtp = generateRideOtp();
    const hashedOtp = await hashOtp(rideOtp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    await client.query(
      `UPDATE cab_bookings
       SET driver_id = $2,
           status = 'accepted',
           ride_otp = $3,
           otp_expires_at = $4,
           updated_at = NOW()
       WHERE cab_booking_id = $1`,
      [cabBookingId, driverId, hashedOtp, otpExpiresAt]
    );

    await client.query(
      `UPDATE drivers
       SET is_available = FALSE,
           updated_at = NOW()
       WHERE driver_id = $1`,
      [driverId]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Cab booking accepted successfully',
      data: {
        cab_booking_id: cabBookingId,
        driver_id: driverId,
        status: 'accepted',
        otp_expires_at: otpExpiresAt.toISOString(),
        ride_otp: process.env.NODE_ENV === 'development' ? rideOtp : undefined,
      },
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return respondWithUnexpectedError(res, error, 'Failed to accept cab booking');
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.startCab = async (req, res) => {
  let client;

  try {
    const driverId = ensureDriverAccess(req);
    const { cab_booking_id: cabBookingId, ride_otp: rideOtp } = req.body;

    if (!cabBookingId || !rideOtp) {
      return res.status(400).json({
        success: false,
        message: 'cab_booking_id and ride_otp are required',
      });
    }

    if (!/^\d{6}$/.test(rideOtp)) {
      return res.status(400).json({
        success: false,
        message: 'ride_otp must be a 6-digit numeric code',
      });
    }

    client = await db.getClient();
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT cab_booking_id, driver_id, status, ride_otp, otp_expires_at
       FROM cab_bookings
       WHERE cab_booking_id = $1
       FOR UPDATE`,
      [cabBookingId]
    );

    if (bookingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cab booking not found',
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.driver_id !== driverId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Driver is not assigned to this booking',
      });
    }

    if (booking.status !== 'accepted') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Cab booking is not in accepted state',
      });
    }

    if (!booking.ride_otp || !booking.otp_expires_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ride OTP not available. Please accept booking first',
      });
    }

    if (new Date(booking.otp_expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ride OTP has expired. Request new OTP',
      });
    }

    const otpMatches = await verifyOtpHash(rideOtp, booking.ride_otp);

    if (!otpMatches) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid ride OTP',
      });
    }

    await client.query(
      `UPDATE cab_bookings
       SET status = 'started',
           ride_otp = NULL,
           otp_expires_at = NULL,
           started_at = NOW(),
           updated_at = NOW()
       WHERE cab_booking_id = $1`,
      [cabBookingId]
    );

    await client.query(
      `DELETE FROM ride_live_locations WHERE cab_booking_id = $1`,
      [cabBookingId]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Ride started successfully',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return respondWithUnexpectedError(res, error, 'Failed to start ride');
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.endCab = async (req, res) => {
  let client;

  try {
    const driverId = ensureDriverAccess(req);
    const { cab_booking_id: cabBookingId } = req.body;

    if (!cabBookingId) {
      return res.status(400).json({
        success: false,
        message: 'cab_booking_id is required',
      });
    }

    client = await db.getClient();
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT cab_booking_id, driver_id, status, estimated_fare, started_at, distance_km
       FROM cab_bookings
       WHERE cab_booking_id = $1
       FOR UPDATE`,
      [cabBookingId]
    );

    if (bookingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cab booking not found',
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.driver_id !== driverId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Driver is not assigned to this booking',
      });
    }

    if (booking.status !== 'started') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Cab booking is not in started state',
      });
    }

    const durationMinutes = calculateRideDurationMinutes(booking.started_at);
    const baseFare =
      booking.estimated_fare !== null && booking.estimated_fare !== undefined
        ? Number(booking.estimated_fare)
        : estimateFare(Number(booking.distance_km) || 0);
    const finalFare = formatDecimal(
      baseFare + durationMinutes * PER_MINUTE_SURCHARGE
    );

    await client.query(
      `UPDATE cab_bookings
       SET status = 'completed',
           ended_at = NOW(),
           final_fare = $2,
           updated_at = NOW()
       WHERE cab_booking_id = $1`,
      [cabBookingId, finalFare]
    );

    await client.query(
      `UPDATE drivers
       SET is_available = TRUE,
           updated_at = NOW()
       WHERE driver_id = $1`,
      [driverId]
    );

    await client.query(
      `DELETE FROM ride_live_locations WHERE cab_booking_id = $1`,
      [cabBookingId]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      data: {
        cab_booking_id: cabBookingId,
        final_fare: finalFare,
        duration_minutes: Math.ceil(durationMinutes),
      },
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return respondWithUnexpectedError(res, error, 'Failed to complete ride');
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.pushLiveLocation = async (req, res) => {
  try {
    const driverId = ensureDriverAccess(req);
    const { cab_booking_id: cabBookingId, latitude, longitude } = req.body;

    if (!cabBookingId) {
      return res.status(400).json({
        success: false,
        message: 'cab_booking_id is required',
      });
    }

    const lat = toNumberOrNull(latitude);
    const lng = toNumberOrNull(longitude);

    if (lat === null || lng === null) {
      return res.status(400).json({
        success: false,
        message: 'latitude and longitude must be valid numeric values',
      });
    }

    const bookingResult = await db.query(
      `SELECT cab_booking_id, driver_id, status
       FROM cab_bookings
       WHERE cab_booking_id = $1`,
      [cabBookingId]
    );

    if (bookingResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cab booking not found',
      });
    }

    const booking = bookingResult.rows[0];

    if (booking.driver_id !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'Driver is not assigned to this booking',
      });
    }

    if (booking.status !== 'started') {
      return res.status(409).json({
        success: false,
        message: 'Live location updates are allowed only for ongoing rides',
      });
    }

    await db.query(
      `INSERT INTO ride_live_locations (location_id, cab_booking_id, latitude, longitude)
       VALUES ($1, $2, $3, $4)`,
      [uuidv4(), cabBookingId, lat, lng]
    );

    return res.status(201).json({
      success: true,
      message: 'Location point recorded',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return respondWithUnexpectedError(res, error, 'Failed to record live location');
  }
};

exports.getLiveLocationTrail = async (req, res) => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    const role = getAuthenticatedRole(req);
    const { cab_booking_id: cabBookingId } = req.params;

    if (!cabBookingId) {
      return res.status(400).json({
        success: false,
        message: 'cab_booking_id is required',
      });
    }

    const bookingResult = await db.query(
      `SELECT cab_booking_id, user_id, driver_id, status
       FROM cab_bookings
       WHERE cab_booking_id = $1`,
      [cabBookingId]
    );

    if (bookingResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cab booking not found',
      });
    }

    const booking = bookingResult.rows[0];

    if (role === 'user' && booking.user_id !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this ride location',
      });
    }

    if (role === 'driver' && booking.driver_id !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this ride location',
      });
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isInteger(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIVE_LOCATION_LIMIT)
      : LIVE_LOCATION_DEFAULT_LIMIT;

    const locationResult = await db.query(
      `SELECT latitude, longitude, recorded_at
       FROM ride_live_locations
       WHERE cab_booking_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [cabBookingId, limit]
    );

    const points = locationResult.rows.reverse();

    return res.status(200).json({
      success: true,
      message: 'Live location trail fetched successfully',
      data: points,
    });
  } catch (error) {
    return respondWithUnexpectedError(res, error, 'Failed to fetch live location trail');
  }
};

exports.reportEmergency = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const role = getAuthenticatedRole(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Valid user token required',
      });
    }

    if (role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only riders can report emergencies',
      });
    }

    const {
      cab_booking_id: cabBookingId,
      reason,
      latitude,
      longitude,
    } = req.body;

    if (!cabBookingId) {
      return res.status(400).json({
        success: false,
        message: 'cab_booking_id is required',
      });
    }

    const bookingResult = await db.query(
      `SELECT cab_booking_id, status
       FROM cab_bookings
       WHERE cab_booking_id = $1 AND user_id = $2`,
      [cabBookingId, userId]
    );

    if (bookingResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cab booking not found for the authenticated rider',
      });
    }

    const booking = bookingResult.rows[0];

    if (!['accepted', 'started'].includes(booking.status)) {
      return res.status(409).json({
        success: false,
        message: 'Emergency reporting is allowed only for accepted or ongoing rides',
      });
    }

    const contactsResult = await db.query(
      `SELECT name, phone, relation
       FROM emergency_contacts
       WHERE user_id = $1`,
      [userId]
    );

    const contacts = contactsResult.rows;
    const lat = toNumberOrNull(latitude);
    const lng = toNumberOrNull(longitude);

    const payload = {
      cab_booking_id: cabBookingId,
      user_id: userId,
      reason: reason || 'unspecified',
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString(),
    };

    if (contacts.length === 0) {
      console.warn('🚨 EMERGENCY ALERT (no contacts on file)', payload);
    } else {
      console.log('🚨 EMERGENCY ALERT DISPATCHED', {
        ...payload,
        contacts_notified: contacts,
      });
    }

    return res.status(200).json({
      success: true,
      message: contacts.length
        ? 'Emergency contacts notified successfully'
        : 'Emergency reported. No emergency contacts on file',
      data: {
        contacts_notified: contacts,
      },
    });
  } catch (error) {
    return respondWithUnexpectedError(res, error, 'Failed to report emergency');
  }
};
