const express = require("express");
const cors = require("cors");
const authenticate = require("./middleware/authMiddleware");
const authRoutes = require("./routes/authRoutes");
const draftRoutes = require("./routes/draftRoutes");
const organisationRoutes = require("./routes/organisationRoutes");
const findingRoutes = require("./routes/findingRoutes");
const auditRoutes = require("./routes/auditRoutes");
const rulebookRoutes = require("./routes/rulebookRoutes");
const factRoutes = require("./routes/factRoutes");
const path = require("path");

const app = express();
const frontendPath = path.join(__dirname, "../client/dist");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use("/api/auth", authRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/organisations", organisationRoutes);
app.use("/api/findings", findingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/rulebook", rulebookRoutes);
app.use("/api/facts", factRoutes);
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

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

app.use(express.static(frontendPath, {
    dotfiles: "deny",
    index: "index.html"
}));

app.get(/.*/, (req, res, next) => {
    if (
        req.method !== "GET" ||
        path.extname(req.path) ||
        !req.accepts("html")
    ) {
        return next();
    }

    res.sendFile(path.join(frontendPath, "index.html"), (error) => {
        if (error) next(error);
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Resource not found"
    });
});

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
