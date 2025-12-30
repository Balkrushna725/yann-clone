const request = require('supertest');
const mongoose = require('mongoose');

// Use a test DB so we don't clash with development data
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/yaan-auth-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'yaan_secret_test';

const app = require('../server');
const User = require('../src/models/User');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await User.deleteMany({ email: /@example.com$/ });
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('request-otp and verify-otp flow', async () => {
  const email = `test+${Date.now()}@example.com`;

  // Request OTP
  const reqRes = await request(app)
    .post('/api/auth/request-otp')
    .send({ email })
    .expect(200);

  expect(reqRes.body.message).toBe('OTP sent');

  // Read OTP from DB
  const user = await User.findOne({ where: { email } });
  expect(user).toBeTruthy();
  expect(user.otp).toBeTruthy();

  // Verify OTP
  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email, otp: user.otp, firstName: 'Test', lastName: 'User' })
    .expect(200);

  expect(verifyRes.body.message).toBe('Login successful');
  expect(verifyRes.body.token).toBeTruthy();
  expect(verifyRes.body.user).toBeTruthy();
  const token = verifyRes.body.token;

  // Update profile (gender + emergencyNumber)
  const profileRes = await request(app)
    .post('/api/auth/update-profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ gender: 'female', emergencyNumber: '+911234567890' })
    .expect(200);

  expect(profileRes.body.message).toBe('Profile updated');
  expect(profileRes.body.user.gender).toBe('female');
  expect(profileRes.body.user.emergencyNumber).toBe('+911234567890');
});
