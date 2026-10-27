
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");

const {
    register,
    login,
    getMe,
    logout
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);

module.exports = router;
