const request = require('supertest');
const sequelize = require('./src/config/database');

const app = require('./server');
const User = require('./src/models/User');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');

    // Sync models to create tables
    await sequelize.sync({ force: false });
    console.log('Database synced');

    const email = `smoketest+${Date.now()}@example.com`;

    // Clean previous
    await User.destroy({ where: { email } });

    // Intercept console logs to capture the printed OTP
    let capturedOtp = null;
    const _origLog = console.log.bind(console);
    console.log = (...args) => {
      try {
        const text = args.join(' ');
        const m = text.match(/YAAN OTP:\s*(\d{4,6})/);
        if (m) capturedOtp = m[1];
      } catch (e) {}
      _origLog(...args);
    };

    console.log('Requesting OTP for', email);
    const reqRes = await request(app).post('/api/auth/request-otp').send({ email });
    console.log('request-otp response:', reqRes.status, reqRes.body);

    // Restore original console.log
    console.log = _origLog;

    if (!capturedOtp) {
      console.error('Could not capture OTP from logs');
      process.exit(2);
    }

    console.log('Captured OTP:', capturedOtp);

    console.log('Verifying OTP...');
    const verifyRes = await request(app).post('/api/auth/verify-otp').send({ email, otp: capturedOtp });
    console.log('verify-otp response:', verifyRes.status, verifyRes.body);

    const token = verifyRes.body && verifyRes.body.token;
    if (!token) {
      console.error('No token returned; cannot update profile');
      process.exit(2);
    }

    console.log('Updating profile with gender=female and emergency number');
    const profileRes = await request(app)
      .post('/api/auth/update-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ gender: 'female', emergencyNumber: '+911234567890' });

    console.log('update-profile response:', profileRes.status, profileRes.body);

    const updated = await User.findOne({ where: { email } });
    if (updated) {
      console.log('Updated user document:', { gender: updated.gender, emergencyNumber: updated.emergencyNumber });
    } else {
      console.log('User not found after update');
    }

    await sequelize.close();
    console.log('Smoke test completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed', err);
    try { await sequelize.close(); } catch(e){}
    process.exit(2);
  }
})();
