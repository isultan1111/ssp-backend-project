const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const controller = require("../controllers/paymentController");

router.post("/orders", authenticate, controller.createOrder);
router.post("/verify", authenticate, controller.verifyPayment);
router.get("/mine", authenticate, controller.myPayments);

module.exports = router;
