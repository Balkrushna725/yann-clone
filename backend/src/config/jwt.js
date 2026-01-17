const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set. Using an insecure default secret.');
}

const getSecret = () => JWT_SECRET || 'yaan_insecure_dev_secret';

const signToken = (payload, options = {}) =>
  jwt.sign(payload, getSecret(), { expiresIn: '7d', ...options });

const verifyToken = (token) => jwt.verify(token, getSecret());

module.exports = {
  signToken,
  verifyToken,
};
