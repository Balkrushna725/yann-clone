# YANN Cab Booking API

A secure RESTful backend for the YANN travel platform built with Node.js, Express, and PostgreSQL.

## Feature Highlights

1. OTP-based authentication for riders and drivers with bcrypt hashing and expiry handling.
2. Role-aware JWT sessions (`user`, `driver`) guarding every API.
3. End-to-end cab lifecycle – `requested → accepted → started → completed` – with driver availability management.
4. Emergency contact capture and enforcement for female riders.
5. Live ride location tracking with historical trail retrieval.
6. Comprehensive error handling and Postman-friendly responses.

## Prerequisites

- Node.js (v16 or newer recommended)
- PostgreSQL (v12 or newer)
- npm or yarn

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd yann-cab-booking
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** – create a `.env` file inside `backend/`:
   ```ini
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=yann_db
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Server
   PORT=3000
   NODE_ENV=development

   # Authentication / OTP
   JWT_SECRET=super_secret_value
   OTP_EXPIRY_MINUTES=5
   OTP_SALT_ROUNDS=10
   ```

4. **Provision the database schema** – run the SQL below on `yann_db`:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   CREATE TABLE IF NOT EXISTS users (
     user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     full_name VARCHAR(120),
     phone VARCHAR(20) UNIQUE NOT NULL,
     gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say') OR gender IS NULL),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS drivers (
     driver_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     full_name VARCHAR(120),
     phone VARCHAR(20) UNIQUE NOT NULL,
     is_available BOOLEAN NOT NULL DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TYPE cab_status AS ENUM ('requested', 'accepted', 'started', 'completed', 'cancelled');

   CREATE TABLE IF NOT EXISTS cab_bookings (
     cab_booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
     driver_id UUID REFERENCES drivers(driver_id) ON DELETE SET NULL,
     pickup_location TEXT NOT NULL,
     drop_location TEXT NOT NULL,
     status cab_status NOT NULL DEFAULT 'requested',
     ride_otp TEXT,
     otp_expires_at TIMESTAMP WITH TIME ZONE,
     distance_km NUMERIC(6, 2),
     estimated_fare NUMERIC(10, 2),
     final_fare NUMERIC(10, 2),
     started_at TIMESTAMP WITH TIME ZONE,
     ended_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS login_otps (
     login_otp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     phone VARCHAR(20) NOT NULL,
     role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'driver')),
     otp_hash TEXT NOT NULL,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS emergency_contacts (
     contact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
     name VARCHAR(120) NOT NULL,
     phone VARCHAR(20) NOT NULL,
     relation VARCHAR(80),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS ride_live_locations (
     location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     cab_booking_id UUID NOT NULL REFERENCES cab_bookings(cab_booking_id) ON DELETE CASCADE,
     latitude NUMERIC(9, 6) NOT NULL,
     longitude NUMERIC(9, 6) NOT NULL,
     recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_cab_bookings_user ON cab_bookings(user_id);
   CREATE INDEX IF NOT EXISTS idx_cab_bookings_driver ON cab_bookings(driver_id);
   CREATE INDEX IF NOT EXISTS idx_live_locations_booking ON ride_live_locations(cab_booking_id);
   CREATE INDEX IF NOT EXISTS idx_login_otps_phone_role ON login_otps(phone, role);
   ```

   > **Tip:** schedule a cron to purge expired rows from `login_otps` to keep the table lean.

5. **Run the development server**
   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:3000` by default.

## API Surface

All endpoints require `Authorization: Bearer <JWT>` except the OTP endpoints.

### Authentication (`/auth`)

| Method | Route                 | Description |
|--------|-----------------------|-------------|
| POST   | `/otp/request`        | Request an OTP for a rider or driver (development mode echoes OTP in response). |
| POST   | `/otp/verify`         | Verify OTP, upsert the account, enforce emergency contacts (female riders), return JWT. |

### Cab Lifecycle (`/cab`)

| Method | Route                     | Role    | Description |
|--------|---------------------------|---------|-------------|
| POST   | `/book`                   | user    | Create a cab booking in `requested` state. |
| POST   | `/accept`                 | driver  | Accept a booking, mark driver unavailable, hash & return ride OTP. |
| POST   | `/start`                  | driver  | Verify passenger OTP and move ride to `started`. |
| POST   | `/end`                    | driver  | Complete the ride, mark driver available. |
| POST   | `/location`               | driver  | Stream live GPS coordinates while ride is active. |
| GET    | `/location/:cab_booking_id` | user/driver | Fetch the latest live location trail for an active ride. |
| POST   | `/emergency`              | user    | Trigger an emergency alert for the active ride (notifies emergency contacts). |

Each API returns `{ success, message, data }` for easy Postman automation.

## Development Scripts

- `npm run dev` – start with Nodemon.
- `npm run start` – start in production mode.
- `npm run lint` / `npm run format` – quality tooling.

## Testing with Postman / HTTPie

1. `POST /auth/otp/request` → capture `otp` (returned only in `development`).
2. `POST /auth/otp/verify` → receive `token`.
3. Include `Authorization: Bearer <token>` for all `/cab` calls.
4. Follow lifecycle: `/cab/book` → `/cab/accept` → `/cab/start` → loop over `/cab/location` while en route → `/cab/end`.
5. If the rider identifies as female, include an `emergency_contacts` array during OTP verification. Subsequent verifications can omit contacts unless you want to update them.

### Sample Request Payloads

```jsonc
// POST /auth/otp/request
{
  "phone": "+911234567890",
  "role": "user"
}

// POST /auth/otp/verify
{
  "phone": "+911234567890",
  "otp": "123456",
  "role": "user",
  "full_name": "Asha Singh",
  "gender": "female",
  "emergency_contacts": [
    { "name": "Priya", "phone": "+911234567891", "relation": "sister" }
  ]
}

// POST /cab/book (Authorization: Bearer <user-token>)
{
  "pickup_location": "Mumbai Central",
  "drop_location": "Bandra Terminus",
  "pickup_lat": 18.9707,
  "pickup_lng": 72.8194,
  "drop_lat": 19.0544,
  "drop_lng": 72.8402
}

// POST /cab/accept (Authorization: Bearer <driver-token>)
{
  "cab_booking_id": "<returned-from-booking>"
}

// POST /cab/start (Authorization: Bearer <driver-token>)
{
  "cab_booking_id": "<same-booking-id>",
  "ride_otp": "<otp-shown-when-accepted>"
}

// POST /cab/location (Authorization: Bearer <driver-token>)
{
  "cab_booking_id": "<same-booking-id>",
  "latitude": 19.0316,
  "longitude": 72.8410
}

// GET /cab/location/<cab_booking_id>?limit=20 (Authorization: Bearer <rider-token>)

// POST /cab/emergency (Authorization: Bearer <rider-token>)
{
  "cab_booking_id": "<same-booking-id>",
  "reason": "Driver deviated from planned route",
  "latitude": 19.0411,
  "longitude": 72.8530
}
```

## Production Notes

- Set `NODE_ENV=production` and a strong `JWT_SECRET`.
- Serve behind HTTPS and configure CORS appropriately.
- Enable automated tasks to clean `login_otps` and archive `ride_live_locations` as needed.

```bash
npm ci --omit=dev
NODE_ENV=production npm start
```

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit with context-rich messages.
4. Push and open a Pull Request.

---

Built for the YANN travel platform.
