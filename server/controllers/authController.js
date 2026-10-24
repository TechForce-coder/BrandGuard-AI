const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Organisation = require("../models/Organisation");

// Register a new user
const register = async (req, res) => {
    try {
        const { name, email, password, organisationId } = req.body;

        if (!name || !email || !password || !organisationId) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        // Validate organisation ID
        if (!mongoose.isValidObjectId(organisationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid organisation ID"
            });
        }

        const organisation = await Organisation.findById(organisationId);

        if (!organisation) {
            return res.status(404).json({
                success: false,
                message: "Organisation not found"
            });
        }

        // Check whether user already exists
        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: "creator",
            organisationId
        });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Registration error:", error.message);
        console.error("Registration error:", error.message);
        

        return res.status(500).json({
            success: false,
            message: "Unable to register user"
        });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
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
                role: user.role
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
        const User = require("../models/User");

        const user = await User.findById(req.user.userId)
            .select("-password");

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

module.exports = { register , login, getMe};
