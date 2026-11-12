const User = require("../models/User");

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 }).limit(100);
    res.json({ count: users.length, users });
  } catch (err) { next(err); }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Role must be user or admin" });
    const user = await User.findByIdAndUpdate(
      req.params.id, { role }, { new: true, runValidators: true }
    ).select("name email role");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Role updated", user });
  } catch (err) { next(err); }
};
