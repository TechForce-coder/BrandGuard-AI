const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }

    try {
        const user = await User.findById(decoded.userId)
            .select("role organisationId");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        req.user = {
            userId: String(user._id),
            organisationId: String(user.organisationId),
            role: user.role
        };
        return next();
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        console.error("Authentication account lookup failed");
        return res.status(503).json({
            success: false,
            message: "Authentication service temporarily unavailable"
        });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(String(req.user.role || "").toLowerCase())) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to perform this action"
        });
    }

    return next();
};

module.exports = authenticate;
module.exports.authorizeRoles = authorizeRoles;