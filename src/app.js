const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const paymentController = require("./controllers/paymentController");

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(cookieParser());

// Razorpay webhook needs the exact raw bytes for HMAC verification.
// Register before express.json().
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), paymentController.webhook);
app.use(express.json({ limit: "20kb" }));

app.get("/health", (req, res) => res.json({ status: "ok", service: "ssp-backend-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
