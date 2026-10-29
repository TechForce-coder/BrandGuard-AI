
const mongoose = require("mongoose");
const User = require("../models/User");

// Get users belonging to the logged-in admin's organisation
const getUsers = async (req, res) => {
    try {
        const users = await User.find({
            organisationId: req.user.organisationId
        })
            .select("name email role organisationId createdAt")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            users
        });
    } catch (error) {
        console.error("Get users failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users"
        });
    }
};

// Update a user's role
const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const role = typeof req.body?.role === "string"
            ? req.body.role.toLowerCase()
            : "";

        const allowedRoles = ["creator", "reviewer", "manager", "admin"];

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        // Only update users in this admin's organisation
        const user = await User.findOne({
            _id: userId,
            organisationId: req.user.organisationId
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found in your organisation"
            });
        }

        // Prevent changing your own admin role accidentally
        if (String(user._id) === req.user.userId && role !== "admin") {
            return res.status(400).json({
                success: false,
                message: "You cannot remove your own admin role"
            });
        }

        if (user.role !== role) {
            user.role = role;
            user.tokenVersion = (user.tokenVersion || 0) + 1;
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: "User role updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Role update failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update user role"
        });
    }
};

module.exports = { getUsers, updateUserRole };
