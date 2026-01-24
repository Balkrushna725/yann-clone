CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users represent riders on the platform
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120),
  phone VARCHAR(20) UNIQUE NOT NULL,
  gender VARCHAR(20) CHECK (
    gender IN ('male', 'female', 'other', 'prefer_not_to_say')
    OR gender IS NULL
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers are contractors that can accept rides
CREATE TABLE IF NOT EXISTS drivers (
  driver_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Possible lifecycle states for cab bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'cab_status'
  ) THEN
    CREATE TYPE cab_status AS ENUM ('requested', 'accepted', 'started', 'completed', 'cancelled');
  END IF;
END
$$;

-- Booking record linking riders and drivers
CREATE TABLE IF NOT EXISTS cab_bookings (
  cab_booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(driver_id) ON DELETE SET NULL,
  pickup_location TEXT NOT NULL,
  drop_location TEXT NOT NULL,
  status cab_status NOT NULL DEFAULT 'requested',
  ride_otp TEXT,
  otp_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login OTPs for riders and drivers
CREATE TABLE IF NOT EXISTS login_otps (
  login_otp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'driver')),
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_verification (
  otp_id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('user', 'driver')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency contacts stored for riders, enforced for female riders
CREATE TABLE IF NOT EXISTS emergency_contacts (
  contact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  relation VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live location pings captured during an active ride
CREATE TABLE IF NOT EXISTS ride_live_locations (
  location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cab_booking_id UUID NOT NULL REFERENCES cab_bookings(cab_booking_id) ON DELETE CASCADE,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supporting indexes for common lookup patterns
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);
CREATE INDEX IF NOT EXISTS idx_cab_bookings_user ON cab_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_cab_bookings_driver ON cab_bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_cab_bookings_status ON cab_bookings(status);
CREATE INDEX IF NOT EXISTS idx_login_otps_phone_role ON login_otps(phone, role);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_booking ON ride_live_locations(cab_booking_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_otp_verification_phone_type ON otp_verification(phone, user_type);
