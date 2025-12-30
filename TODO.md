# Migration from MongoDB to PostgreSQL - TODO

## Completed Tasks
- [x] Update package.json: Remove mongoose, add sequelize and pg
- [x] Create database configuration for Sequelize (src/config/database.js)
- [x] Convert User model to Sequelize model (src/models/User.js)
- [x] Convert Otp model to Sequelize model (src/models/Otp.model.js)
- [x] Update server.js to connect to PostgreSQL instead of MongoDB
- [x] Modify routes to use Sequelize methods instead of Mongoose (src/routes/auth.Routes.js)
- [x] Update tests to work with Sequelize (test/auth.test.js)
- [x] Update smoke test to work with Sequelize (smoke_test.js)
- [x] Install new dependencies

## Remaining Tasks
- [ ] Set up PostgreSQL database
- [ ] Update environment variables (change MONGO_URI to DATABASE_URL)
- [ ] Run migrations to create tables
- [ ] Test the application
- [ ] Update documentation if needed
