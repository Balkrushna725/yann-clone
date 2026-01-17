require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

let server;

if (require.main === module) {
  server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`YAAN Server running on port ${PORT}`);
    console.log('Listening address:', server.address());
    console.log('PID:', process.pid);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });
}

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandledRejection at:', promise, 'reason:', reason);
});

module.exports = app;
