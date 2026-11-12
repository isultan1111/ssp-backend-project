const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/authController");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { registerSchema, loginSchema, resetRequestSchema, resetPasswordSchema } = require("../validators/authSchemas");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

router.post("/register", authLimiter, validate(registerSchema), controller.register);
router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/refresh", authLimiter, controller.refresh);
router.post("/logout", controller.logout);
router.post("/forgot-password", authLimiter, validate(resetRequestSchema), controller.requestPasswordReset);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), controller.resetPassword);
router.get("/me", authenticate, controller.me);

module.exports = router;
