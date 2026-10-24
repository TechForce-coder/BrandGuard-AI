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


// Test route
app.get("/", (req, res) => {
    if (process.env.NODE_ENV === "production") {
        return res.sendFile(
            path.join(__dirname, "../client/dist/index.html")
        );
    }

    res.json({ message: "Welcome to BrandGuard AI API" });
});
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
