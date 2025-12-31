const { Sequelize } = require('sequelize');
// require('dotenv').config(); // Commented out to avoid .env override

const sequelize = new Sequelize('postgresql://postgres:Mayu@1702@localhost:5432/yaan_db', {
  logging: false, // Set to console.log to see SQL queries
});

module.exports = sequelize;
