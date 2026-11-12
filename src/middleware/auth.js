const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      issuer: "ssp-api", audience: "ssp-client"
    });
    const user = await User.findById(payload.sub).select("_id name email role");
    if (!user) return res.status(401).json({ message: "Invalid authentication" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
