const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const scanRoutes = require("./routes/scanRoutes");
const authenticate = require("./middleware/authMiddleware");
const authRoutes = require("./routes/authRoutes");
const draftRoutes = require("./routes/draftRoutes");
const organisationRoutes = require("./routes/organisationRoutes");
const findingRoutes = require("./routes/findingRoutes");
const auditRoutes = require("./routes/auditRoutes");
const rulebookRoutes = require("./routes/rulebookRoutes");
const factRoutes = require("./routes/factRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validate JSON object payloads
app.use("/api", (req, res, next) => {
    if (
        req.body !== undefined &&
        (req.body === null || typeof req.body !== "object" || Array.isArray(req.body))
    ) {
        return res.status(400).json({
            success: false,
            message: "Request body must be a JSON object"
        });
    }
    return next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/organisations", organisationRoutes);
app.use("/api/findings", findingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/rulebook", rulebookRoutes);
app.use("/api/facts", factRoutes);
app.use("/api", scanRoutes);

app.get("/api/protected", authenticate, (req, res) => {
    res.json({
        success: true,
        message: "You accessed a protected route!",
        user: req.user
    });
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend is connected successfully!"
    });
});

// 404 handler for API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

// Locate compiled static frontend assets
const clientDistPath = path.resolve(__dirname, "../client/dist");
const clientBuildPath = path.resolve(__dirname, "../client/build");
const staticDir = fs.existsSync(clientDistPath) ? clientDistPath : clientBuildPath;

// Serve static bundles (.js, .css, images, fonts)
app.use(express.static(staticDir));

// Root route: Serve SPA for browser navigation, JSON ping for API checks
app.get("/", (req, res) => {
    const indexPath = path.join(staticDir, "index.html");
    if (req.accepts("html") && fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    return res.json({
        success: true,
        message: "BrandGuard AI Backend API is running"
    });
});

// SPA Fallback: Return index.html for direct frontend routes (e.g., /login, /drafts)
// Pathless middleware is used here to ensure compatibility across all Express versions
app.use((req, res, next) => {
    if (req.method !== "GET") return next();

    const indexPath = path.join(staticDir, "index.html");

    // Only serve index.html for route paths without a file extension when HTML is requested
    if (!path.extname(req.path) && req.accepts("html") && fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }

    return next();
});

// Global 404 handler for missing assets or unhandled routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Resource not found"
    });
});

// Global error handler
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Request body contains invalid JSON"
        });
    }

    console.error("Request failed:", error.message);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

module.exports = app;