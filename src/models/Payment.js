const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  paymentId: { type: String, default: null, index: true },
  amount: { type: Number, required: true }, // amount in paise
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  receipt: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
