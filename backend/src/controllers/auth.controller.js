const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

exports.requestOtp = async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ message: "Email or phone required" });
  }

  let user = await User.findOne({
    $or: [{ email }, { phone }]
  });

  const otp = generateOtp();

  if (!user) {
    user = new User({ email, phone });
  }

  user.otp = otp;
  user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  console.log("YAAN OTP:", otp); // testing only

  res.json({
    message: "OTP sent",
    isNewUser: !user.firstName
  });
};
exports.verifyOtp = async (req, res) => {
  const { email, phone, otp, firstName, lastName } = req.body;

  const user = await User.findOne({
    $or: [{ email }, { phone }]
  });

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  if (
    user.otp !== otp ||
    user.otpExpiresAt < new Date()
  ) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // If new user, save name (SCREEN 3)
  if (!user.firstName && firstName) {
    user.firstName = firstName;
    user.lastName = lastName;
  }

  user.otp = null;
  user.otpExpiresAt = null;
  await user.save();

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET || "yaan_secret",
    { expiresIn: "7d" }
  );

  res.json({
    message: "Login successful",
    token,
    user
  });
};

