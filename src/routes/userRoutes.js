const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/userController");

router.get("/", authenticate, authorize("admin"), controller.listUsers);
router.patch("/:id/role", authenticate, authorize("admin"), controller.updateRole);

module.exports = router;
