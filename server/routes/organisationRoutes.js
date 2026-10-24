
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");

const {
    createOrganisation
} = require("../controllers/organisationController");

router.post("/", authenticate, authorizeRoles("admin"), createOrganisation);

module.exports = router;
