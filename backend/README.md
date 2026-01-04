# YANN Cab Booking API

A RESTful API for managing cab bookings built with Node.js, Express, and PostgreSQL.

## Features

- User authentication with OTP
- Cab booking management
- Real-time ride status updates
- Emergency support
- Transaction management

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
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

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=yann_db
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # OTP Configuration
   OTP_EXPIRY_MINUTES=5
   ```

4. **Database setup**
   Run the following SQL script in your PostgreSQL database:
   ```sql
   -- Create database
   CREATE DATABASE yann_db;

   -- Connect to the database
   \c yann_db

   -- Create users table
   CREATE TABLE users (
       user_id SERIAL PRIMARY KEY,
       full_name VARCHAR(100),
       phone VARCHAR(20) UNIQUE NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Create drivers table
   CREATE TABLE drivers (
       driver_id SERIAL PRIMARY KEY,
       full_name VARCHAR(100) NOT NULL,
       phone VARCHAR(20) UNIQUE NOT NULL,
       is_available BOOLEAN DEFAULT true,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Create cab_rides table
   CREATE TABLE cab_rides (
       ride_id SERIAL PRIMARY KEY,
       user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
       driver_id INTEGER REFERENCES drivers(driver_id) ON DELETE SET NULL,
       pickup_location TEXT NOT NULL,
       drop_location TEXT NOT NULL,
       status VARCHAR(20) NOT NULL CHECK (status IN ('requested', 'accepted', 'ongoing', 'completed', 'cancelled')),
       fare DECIMAL(10, 2) NOT NULL,
       start_time TIMESTAMP,
       end_time TIMESTAMP,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Create otp_verification table
   CREATE TABLE otp_verification (
       id SERIAL PRIMARY KEY,
       phone VARCHAR(20) NOT NULL,
       otp VARCHAR(6) NOT NULL,
       expires_at TIMESTAMP NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(phone, otp)
   );

   -- Create indexes for better performance
   CREATE INDEX idx_cab_rides_user_id ON cab_rides(user_id);
   CREATE INDEX idx_cab_rides_driver_id ON cab_rides(driver_id);
   CREATE INDEX idx_cab_rides_status ON cab_rides(status);
   CREATE INDEX idx_otp_verification_phone ON otp_verification(phone);
   CREATE INDEX idx_otp_verification_expires ON otp_verification(expires_at);
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication

- `POST /api/auth/otp/generate` - Generate OTP for a phone number
- `POST /api/auth/otp/verify` - Verify OTP and authenticate user

### Cab Booking

- `POST /api/cab/book` - Book a new cab ride
- `POST /api/cab/accept` - Driver accepts a ride request
- `POST /api/cab/start` - Start a ride
- `POST /api/cab/end` - End a ride
- `POST /api/cab/emergency` - Report an emergency during a ride

## Development

- `npm run dev` - Start the development server with nodemon
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Production

```bash
npm install --production
NODE_ENV=production npm start
```

## Environment Variables

- `NODE_ENV` - Application environment (development, production)
- `PORT` - Port to run the server on
- `DB_*` - Database connection details
- `OTP_EXPIRY_MINUTES` - OTP expiration time in minutes

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
