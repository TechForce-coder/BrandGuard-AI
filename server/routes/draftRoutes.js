
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
    reviewDraft
} = require("../controllers/draftController");

router.post("/", authenticate, authorizeRoles("creator"), createDraft);
router.get("/", authenticate, getDrafts);

router.get("/:id", authenticate, getDraftById);
router.put("/:id", authenticate, authorizeRoles("creator"), updateDraft);

router.post("/:id/scan", authenticate, authorizeRoles("creator"), scanDraft);
router.post("/:id/submit", authenticate, authorizeRoles("creator"), submitDraft);

router.post("/:id/approve", authenticate, authorizeRoles("reviewer", "manager", "admin"), (req, res, next) => {
    req.body.action = "approve";
    reviewDraft(req, res, next);
});

router.post("/:id/request-changes", authenticate, authorizeRoles("reviewer", "manager", "admin"), (req, res, next) => {
    req.body.action = "request-changes";
    reviewDraft(req, res, next);
});


module.exports = router;
