const request = require('supertest');
const mongoose = require('mongoose');

process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/yaan-auth';

const app = require('./server');
const User = require('./src/models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const email = `smoketest+${Date.now()}@example.com`;

    // Clean previous
    await User.deleteMany({ email });

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

    const updated = await User.findOne({ email });
    console.log('Updated user document:', { gender: updated.gender, emergencyNumber: updated.emergencyNumber });

    await mongoose.disconnect();
    console.log('Smoke test completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed', err);
    try { await mongoose.disconnect(); } catch(e){}
    process.exit(2);
  }
})();
