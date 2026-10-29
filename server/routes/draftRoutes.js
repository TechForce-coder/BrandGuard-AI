const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");

const {
    createDraft,
    getDrafts,
    getCreatorActivity,
    getDashboardStats,
    getDraftById,
    updateDraft,
    scanDraft,
    submitDraft,
    reviewDraft,
    addDraftComment
} = require("../controllers/draftController");

// Create draft
router.post(
    "/",
    authenticate,
    authorizeRoles("creator"),
    createDraft
);

// Get all drafts
router.get(
    "/",
    authenticate,
    authorizeRoles("creator", "reviewer", "manager", "admin"),
    getDrafts
);

// Dashboard statistics — must be before /:id
router.get(
    "/dashboard",
    authenticate,
    authorizeRoles("creator", "reviewer", "manager", "admin"),
    getDashboardStats
);

// Creator activity
router.get(
    "/activity",
    authenticate,
    authorizeRoles("creator"),
    getCreatorActivity
);

// Get draft by ID
router.get(
    "/:id",
    authenticate,
    authorizeRoles("creator", "reviewer", "manager", "admin"),
    getDraftById
);

// Update draft
router.put(
    "/:id",
    authenticate,
    authorizeRoles("creator"),
    updateDraft
);

// Scan draft
router.post(
    "/:id/scan",
    authenticate,
    authorizeRoles("creator"),
    scanDraft
);

// Submit draft
router.post(
    "/:id/submit",
    authenticate,
    authorizeRoles("creator"),
    submitDraft
);

// Add comment
router.post(
    "/:id/comments",
    authenticate,
    authorizeRoles("manager"),
    addDraftComment
);

// Approve draft
router.post(
    "/:id/approve",
    authenticate,
    authorizeRoles("manager"),
    (req, res, next) => {
        req.body.action = "approve";
        reviewDraft(req, res, next);
    }
);

// Request changes
router.post(
    "/:id/request-changes",
    authenticate,
    authorizeRoles("manager"),
    (req, res, next) => {
        req.body.action = "request-changes";
        reviewDraft(req, res, next);
    }
);

module.exports = router;