const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String },
  phone: { type: String },
  firstName: String,
  lastName: String,
  gender: String,
  emergencyNumber: String,
  otp: String,
  otpExpiresAt: Date
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
