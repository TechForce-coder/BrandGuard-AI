
const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");

const {
    createDraft,
    getDrafts,
    getDraftById,
    updateDraft,
    scanDraft,
    submitDraft,
    reviewDraft,
    addDraftComment
} = require("../controllers/draftController");

router.post("/", authenticate, authorizeRoles("creator"), createDraft);
router.get("/", authenticate, authorizeRoles("creator", "reviewer", "manager", "admin"), getDrafts);

router.get("/:id", authenticate, authorizeRoles("creator", "reviewer", "manager", "admin"), getDraftById);
router.put("/:id", authenticate, authorizeRoles("creator"), updateDraft);

router.post("/:id/scan", authenticate, authorizeRoles("creator"), scanDraft);
router.post("/:id/submit", authenticate, authorizeRoles("creator"), submitDraft);
router.post("/:id/comments", authenticate, authorizeRoles("reviewer", "manager", "admin"), addDraftComment);

router.post("/:id/approve", authenticate, authorizeRoles("reviewer", "manager", "admin"), (req, res, next) => {
    req.body.action = "approve";
    reviewDraft(req, res, next);
});

router.post("/:id/request-changes", authenticate, authorizeRoles("reviewer", "manager", "admin"), (req, res, next) => {
    req.body.action = "request-changes";
    reviewDraft(req, res, next);
});


module.exports = router;
