const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/yaan_auth', {
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries
});

module.exports = sequelize;
