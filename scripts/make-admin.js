require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = process.argv[2]?.toLowerCase();
    if (!email) throw new Error("Usage: node scripts/make-admin.js user@example.com");
    const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
    if (!user) throw new Error("User not found. Register the account first.");
    console.log(`${user.email} is now an admin`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
