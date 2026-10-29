
const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");

const {
    register,
    login,
    getMe,
    logout
} = require("../controllers/authController");

const {
    getUsers,
    updateUserRole
} = require("../controllers/adminController");

router.post("/register", register);
router.post("/login", login);

router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);

// Only admins can view users
router.get(
    "/users",
    authenticate,
    authorizeRoles("admin"),
    getUsers
);

// Only admins can update user roles
router.patch(
    "/users/:userId/role",
    authenticate,
    authorizeRoles("admin"),
    updateUserRole
);

module.exports = router;
