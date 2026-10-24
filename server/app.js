const path = require("path");
const express = require("express");
const cors = require("cors");
const authenticate = require("./middleware/authMiddleware");
const authRoutes = require("./routes/authRoutes");
const draftRoutes = require("./routes/draftRoutes");
const organisationRoutes = require("./routes/organisationRoutes");
const findingRoutes = require("./routes/findingRoutes");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/organisations", organisationRoutes);
app.use("/api/findings", findingRoutes);


// Serve React frontend in production
if (process.env.NODE_ENV === "production") {
    const frontendPath = path.join(__dirname, "../client/dist");
    const indexFile = path.join(frontendPath, "index.html");

    app.use(express.static(frontendPath));

    // Unknown API endpoints must return JSON, not React HTML.
    app.use("/api", (req, res) => {
        res.status(404).json({
            success: false,
            message: "API endpoint not found"
        });
    });

    // Serve React for frontend routes (including refresh/direct navigation).
    app.get(/.*/, (req, res, next) => {
        res.sendFile(indexFile, (err) => {
            if (err) next(err);
        });
    });
}
app.get("/api/protected", authenticate, (req, res) => {
    res.json({
        success: true,
        message: "You accessed a protected route!",
        user: req.user
    });
});

// Health-check API
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend is connected successfully!"
    });
});

// Serve React frontend in production
if (process.env.NODE_ENV === "production") {
    const frontendPath = path.join(__dirname, "../client/dist");

    app.use(express.static(frontendPath));

    // Keep API routes working; send React app for frontend routes
    app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith("/api/")) {
            return next();
        }

        res.sendFile(path.join(frontendPath, "index.html"));
    });
}

module.exports = app;
