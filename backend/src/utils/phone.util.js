const normalisePhone = (phone = '') => phone.replace(/\s+/g, '').trim();

const validatePhone = (phone = '') => /^\+?[1-9]\d{7,14}$/.test(phone);

module.exports = {
  normalisePhone,
  validatePhone,
};
