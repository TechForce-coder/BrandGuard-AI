const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Organisation = require("../models/Organisation");

// Register a new user

const register = async (req, res) => {
    try {
        const { name, email, password, organisationId } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof email !== "string" || !email.trim() ||
            typeof password !== "string" || !password ||
            typeof organisationId !== "string" || !organisationId.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields"
            });
        }

        if (name.trim().length < 2 || name.trim().length > 120) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 120 characters"
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must be between 8 and 72 characters"
            });
        }

        if (!mongoose.isValidObjectId(organisationId.trim())) {
            return res.status(400).json({
                success: false,
                message: "Invalid organisation ID"
            });
        }

        const organisation = await Organisation.findById(
            organisationId.trim()
        );

        if (!organisation) {
            return res.status(404).json({
                success: false,
                message: "Organisation not found"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "creator",
            organisationId: organisation._id
        });

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({
                success: false,
                message: "Server authentication is not configured"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                organisationId: user.organisationId.toString(),
                role: user.role,
                tokenVersion: user.tokenVersion || 0
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                organisationId: user.organisationId
            }
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to register user"
        });
    }
};



const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" || !email.trim() ||
            typeof password !== "string" || !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Generate JWT token here
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                organisationId: user.organisationId.toString(),
                role: user.role,
                tokenVersion: user.tokenVersion || 0
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Send token in response
        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                organisationId: user.organisationId
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to login"
        });
    }
};
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("-password -tokenVersion");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to get user details"
        });
    }
};

const logout = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $inc: { tokenVersion: 1 } },
            { new: true }
        );
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session"
            });
        }
        return res.status(204).end();
    } catch (error) {
        console.error("Logout error:", error.message);
        return res.status(503).json({
            success: false,
            message: "Unable to invalidate the session. Please try again."
        });
    }
};

module.exports = { register, login, getMe, logout };
