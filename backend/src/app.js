const express = require('express');
const cors = require('cors');

const { authMiddleware } = require('./middleware/auth.middleware');
const authRoutes = require('./routes/auth.Routes');
const cabRoutes = require('./routes/cab.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'YANN Cab Booking API',
  });
});

app.use('/auth', authRoutes);
app.use('/cab', authMiddleware, cabRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
