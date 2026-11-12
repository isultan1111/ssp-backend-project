const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  refreshTokenHash: { type: String, select: false, default: null },
  passwordResetTokenHash: { type: String, select: false, default: null },
  passwordResetExpires: { type: Date, default: null, select: false }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
