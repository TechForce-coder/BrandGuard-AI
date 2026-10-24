
const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");

const {
    createDraft,
    getDrafts,
    getDraftById,
    updateDraft,
    scanDraft,
    submitDraft,
    reviewDraft
} = require("../controllers/draftController");

router.post("/", authenticate, createDraft);
router.get("/", authenticate, getDrafts);

router.get("/:id", authenticate, getDraftById);
router.put("/:id", authenticate, updateDraft);

router.post("/:id/scan", authenticate, scanDraft);
router.post("/:id/submit", authenticate, submitDraft);

router.post("/:id/approve", authenticate, (req, res, next) => {
    req.body.action = "approve";
    reviewDraft(req, res, next);
});

router.post("/:id/request-changes", authenticate, (req, res, next) => {
    req.body.action = "request-changes";
    reviewDraft(req, res, next);
});


module.exports = router;
