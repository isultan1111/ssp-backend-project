const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const WebhookEvent = require("../models/WebhookEvent");

function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const err = new Error("Razorpay test credentials are not configured");
    err.status = 503;
    throw err;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

exports.createOrder = async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 100 || amount > 10000000) {
      return res.status(400).json({ message: "Amount must be an integer number of paise between 100 and 10000000" });
    }

    const receipt = `rcpt_${req.user._id}_${Date.now()}`;
    const order = await razorpayClient().orders.create({
      amount, currency: "INR", receipt,
      notes: { userId: req.user._id.toString() }
    });

    const record = await Payment.create({
      user: req.user._id, orderId: order.id, amount, currency: "INR", receipt, status: "created"
    });

    res.status(201).json({
      message: "Order created",
      order: { id: order.id, amount: order.amount, currency: order.currency, receipt: order.receipt },
      paymentRecordId: record._id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) { next(err); }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const record = await Payment.findOne({ orderId: razorpay_order_id, user: req.user._id });
    if (!record) return res.status(404).json({ message: "Order not found" });

    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");

    const actualBuffer = Buffer.from(razorpay_signature || "", "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (actualBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    if (record.status === "paid") {
      return res.json({ message: "Payment already verified", status: record.status });
    }

    record.paymentId = razorpay_payment_id;
    record.status = "paid";
    await record.save();
    res.json({ message: "Payment verified", status: record.status });
  } catch (err) { next(err); }
};

// Razorpay sends the raw request body; express.raw is configured for this route.
exports.webhook = async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: "Webhook secret is not configured" });

    const signature = req.headers["x-razorpay-signature"] || "";
    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString("utf8"));
    const eventId = req.headers["x-razorpay-event-id"];
    if (!eventId) return res.status(400).json({ message: "Missing webhook event ID" });

    // Unique eventId index makes duplicate delivery safe across API instances.
    try {
      await WebhookEvent.create({ eventId, eventType: event.event });
    } catch (err) {
      if (err.code === 11000) return res.json({ received: true, duplicate: true });
      throw err;
    }

    try {
      const paymentEntity = event.payload?.payment?.entity;
      if (paymentEntity?.order_id) {
        const status = event.event === "payment.captured" ? "paid" :
          event.event === "payment.failed" ? "failed" : null;
        if (status) {
          // Never downgrade a captured payment because of a delayed failure event.
          await Payment.updateOne(
            { orderId: paymentEntity.order_id, status: { $ne: "paid" } },
            { $set: { status, paymentId: paymentEntity.id } }
          );
        }
      }
      return res.json({ received: true, eventId });
    } catch (processingError) {
      // Remove the idempotency record so Razorpay can retry after a processing failure.
      await WebhookEvent.deleteOne({ eventId });
      throw processingError;
    }
  } catch (err) { next(err); }
};

exports.myPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ payments });
  } catch (err) { next(err); }
};
