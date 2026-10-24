
const Draft = require("../models/Draft");
const { scanContent } = require("../services/geminiService");
const AuditLog = require("../models/AuditLog");

// Create a new draft
const createDraft = async (req, res) => {
    try {
        const { title, content, channel } = req.body;

        if (typeof title !== "string" || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Draft title is required"
            });
        }

        if (content !== undefined && typeof content !== "string") {
            return res.status(400).json({
                success: false,
                message: "Draft content must be a string"
            });
        }

        const draft = await Draft.create({
            title: title.trim(),
            content: content || "",
            channel: channel || "Website",
            author: req.user.userId,
            organisationId: req.user.organisationId
        });

        return res.status(201).json({
            success: true,
            message: "Draft created successfully",
            draft
        });
    } catch (error) {
        console.error("Create draft error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to create draft"
        });
    }
};

// Get all drafts

const getDrafts = async (req, res) => {
    try {
        const query = {
            organisationId: req.user.organisationId
        };
        if (String(req.user.role).toLowerCase() === "creator") {
            query.author = req.user.userId;
        } else if (String(req.user.role).toLowerCase() === "reviewer") {
            query.status = { $ne: "Draft" };
        }

        const drafts = await Draft.find(query)
            .populate("author", "name email")
            .sort({ updatedAt: -1 })
            .lean();

        const updatedDrafts = drafts.map((draft) => {
            const findings = Array.isArray(draft.findings)
                ? draft.findings
                : [];

            const openFindingsCount = findings.filter((finding) => {
                const status = String(finding.status || "Open").toLowerCase();
                return status === "open";
            }).length;

            return {
                ...draft,
                findings,
                findingsCount: openFindingsCount
            };
        });

        return res.status(200).json({
            success: true,
            drafts: updatedDrafts
        });
    } catch (error) {
        console.error("Get drafts error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch drafts"
        });
    }
};


// Get one draft by ID
const getDraftById = async (req, res) => {
    try {
        const draft = await Draft.findOne({
            _id: req.params.id,
            organisationId: req.user.organisationId
        }).populate("author", "name email");

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        if (
            (String(req.user.role).toLowerCase() === "creator" &&
                String(draft.author?._id || draft.author) !== String(req.user.userId)) ||
            (String(req.user.role).toLowerCase() === "reviewer" &&
                draft.status === "Draft")
        ) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        return res.status(200).json({
            success: true,
            draft
        });
    } catch (error) {
        console.error("Get draft error:", error.message);

        return res.status(error.name === "CastError" ? 400 : 500).json({
            success: false,
            message: error.name === "CastError"
                ? "Invalid draft ID"
                : "Unable to fetch draft"
        });
    }
};


const updateDraft = async (req, res) => {
    try {
        const { title, content, channel } = req.body;

        if (typeof title !== "string" || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Draft title is required"
            });
        }

        if (content !== undefined && typeof content !== "string") {
            return res.status(400).json({
                success: false,
                message: "Draft content must be a string"
            });
        }

        // Find draft belonging to the user's organisation
        const draft = await Draft.findOne({
            _id: req.params.id,
            organisationId: req.user.organisationId
        });

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        if (String(draft.author) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the draft author can update this content"
            });
        }

        if (!["Draft", "Needs Changes"].includes(draft.status)) {
            return res.status(409).json({
                success: false,
                message: "Only drafts or content returned for changes can be edited"
            });
        }

        const newContent = content || "";
        const newTitle = title.trim();
        const newChannel = channel || "Website";

        // Check whether the actual draft content changed
        const contentChanged =
            draft.title !== newTitle ||
            draft.content !== newContent ||
            draft.channel !== newChannel;

        draft.title = newTitle;
        draft.content = newContent;
        draft.channel = newChannel;

        // Reset scan and approval data only when something changes
        
        if (contentChanged) {
            draft.findings = [];
            draft.findingsCount = 0;
            draft.scannedAt = null;
            draft.status = "Draft";
        }


        await draft.save();

        return res.status(200).json({
            success: true,
            message: contentChanged
                ? "Draft updated. Please scan it again."
                : "Draft updated successfully",
            draft
        });
    } catch (error) {
        console.error("Update draft error:", error.message);

        return res.status(
            error.name === "CastError" ? 400 : 500
        ).json({
            success: false,
            message: error.name === "CastError"
                ? "Invalid draft ID"
                : "Unable to update draft"
        });
    }
};


// Scan a saved draft using Gemini AI

const scanDraft = async (req, res) => {
    try {
        const draft = await Draft.findOne({
            _id: req.params.id,
            organisationId: req.user.organisationId
        });

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        if (String(draft.author) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the draft author can scan this content"
            });
        }

        if (!draft.content || !draft.content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Add content before scanning"
            });
        }

        if (!["Draft", "Needs Changes"].includes(draft.status)) {
            return res.status(409).json({
                success: false,
                message: "Only drafts or content returned for changes can be scanned"
            });
        }

        // Scan draft content using Gemini AI
        const result = await scanContent(draft.content, draft.title);

        // Safely handle the findings returned by Gemini
        const findings = Array.isArray(result?.findings)
            ? result.findings
            : [];

        // Save scan results in MongoDB
        draft.findings = findings;
        draft.findingsCount = findings.length;
        draft.scannedAt = new Date();

        await draft.save();

        return res.status(200).json({
            success: true,
            message: "Content scan completed",
            draftId: draft._id,
            findings: draft.findings,
            findingsCount: draft.findingsCount,
            summary: result?.summary || ""
        });
    } catch (error) {
        console.error("Scan draft error:", error.message);

        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid draft ID"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to scan content. Check the Gemini API configuration."
        });
    }
};


const submitDraft = async (req, res) => {
    try {
        const draft = await Draft.findOne({
            _id: req.params.id,
            organisationId: req.user.organisationId
        });

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        if (String(draft.author) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the draft author can submit this content"
            });
        }

        if (!["Draft", "Needs Changes"].includes(draft.status)) {
            return res.status(409).json({
                success: false,
                message: "Only drafts or content returned for changes can be submitted"
            });
        }

        if (!draft.title.trim() || !draft.content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required"
            });
        }

        if (!draft.scannedAt) {
            return res.status(400).json({
                success: false,
                message: "Run a content scan before submitting"
            });
        }

        if (draft.findings.some((finding) => !finding.status || finding.status === "Open")) {
            return res.status(400).json({
                success: false,
                message: "Resolve all scan findings before submitting"
            });
        }

        // Store the previous status
        const previousStatus = draft.status;

        // Update draft status
        draft.status = "Pending Approval";
        await draft.save();

        // Save audit history
        await AuditLog.create({
            draft: draft._id,
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: "Submitted",
            previousStatus,
            newStatus: draft.status
        });

        return res.status(200).json({
            success: true,
            message: "Draft submitted for review",
            draft
        });

    } catch (error) {
        console.error("Submit draft error:", error.message);

        return res.status(
            error.name === "CastError" ? 400 : 500
        ).json({
            success: false,
            message: "Unable to submit draft"
        });
    }
};



const reviewDraft = async (req, res) => {
    try {
        const { action, comment = "" } = req.body;

        if (!["approve", "request-changes"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid review action"
            });
        }

        const draft = await Draft.findOne({
            _id: req.params.id,
            organisationId: req.user.organisationId
        });

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        if (String(draft.author) === String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: "Users cannot review their own content"
            });
        }

        if (draft.status !== "Pending Approval") {
            return res.status(400).json({
                success: false,
                message: "Only pending drafts can be reviewed"
            });
        }

        if (
            action === "request-changes" &&
            (typeof comment !== "string" || !comment.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Add a comment explaining the requested changes"
            });
        }

        const previousStatus = draft.status;

        draft.status =
            action === "approve"
                ? "Approved"
                : "Needs Changes";

        await draft.save();

        // Save the review action in the audit log
        
        await AuditLog.create({
            draft: draft._id,
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: action === "approve" ? "Approved" : "Changes Requested",
            comment: typeof comment === "string" ? comment.trim() : "",
            previousStatus,
            newStatus: draft.status
        });
        return res.status(200).json({
            success: true,
            message:
                action === "approve"
                    ? "Draft approved successfully"
                    : "Changes requested successfully",
            draft
        });

    } catch (error) {
        console.error("Review draft error:", error.message);

        return res.status(
            error.name === "CastError" ? 400 : 500
        ).json({
            success: false,
            message: "Unable to review draft"
        });
    }
};



module.exports = {
    createDraft,
    getDrafts,
    getDraftById,
    updateDraft,
    scanDraft,
    submitDraft,
    reviewDraft
};
