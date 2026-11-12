const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { signAccessToken, signRefreshToken, hashToken } = require("../utils/tokens");

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "strict",
  path: "/api/auth"
});

function setRefreshCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  res.cookie("refreshToken", token, { ...cookieOptions(), maxAge });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "Email is already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: "user" });
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({
      message: "Registration successful",
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash +refreshTokenHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    return res.json({
      message: "Login successful",
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
};

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "Refresh token missing" });
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: "ssp-api", audience: "ssp-client"
    });
    if (payload.type !== "refresh") return res.status(401).json({ message: "Invalid refresh token" });

    const user = await User.findById(payload.sub).select("+refreshTokenHash");
    if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
      return res.status(401).json({ message: "Refresh token is no longer valid" });
    }

    // Rotate refresh tokens: old token becomes invalid after this request.
    const newRefreshToken = signRefreshToken(user);
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();
    setRefreshCookie(res, newRefreshToken);

    return res.json({ accessToken: signAccessToken(user) });
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
          issuer: "ssp-api", audience: "ssp-client"
        });
        await User.findByIdAndUpdate(payload.sub, { $set: { refreshTokenHash: null } });
      } catch (_) { /* Expired token: still clear the browser cookie. */ }
    }
    res.clearCookie("refreshToken", { ...cookieOptions() });
    return res.json({ message: "Logged out; refresh session invalidated" });
  } catch (err) { next(err); }
};

exports.requestPasswordReset = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    // Same response for known/unknown emails avoids account enumeration.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = hashToken(rawToken);
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      // Demo only: deliver this URL through a real email provider in production.
      console.log(`DEMO PASSWORD RESET URL: http://localhost:${process.env.PORT || 5000}/reset-password?token=${rawToken}`);
    }
    return res.json({ message: "If the account exists, password reset instructions will be sent" });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetExpires: { $gt: new Date() }
    }).select("+passwordResetTokenHash +refreshTokenHash");
    if (!user) return res.status(400).json({ message: "Reset token is invalid or expired" });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.refreshTokenHash = null; // invalidate existing refresh session
    await user.save();
    res.clearCookie("refreshToken", { ...cookieOptions() });
    return res.json({ message: "Password reset successful. Please log in again." });
  } catch (err) { next(err); }
};

exports.me = async (req, res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
};
