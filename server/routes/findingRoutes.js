
const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");
const { updateFinding } = require("../controllers/findingController");

router.patch("/:id", authenticate, authorizeRoles("creator"), updateFinding);

module.exports = router;
