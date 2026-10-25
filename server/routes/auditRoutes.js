const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");
const { getAudit } = require("../controllers/auditController");

router.get("/", authenticate, authorizeRoles("reviewer", "manager", "admin"), getAudit);

module.exports = router;
