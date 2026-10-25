
const Draft = require("../models/Draft");
const Fact = require("../models/Fact");
const RulebookEntry = require("../models/RulebookEntry");
const AuditLog = require("../models/AuditLog");
const geminiService = require("../services/geminiService");
const { recordAudit } = require("../services/auditService");

const allowedChannels = new Set([
    "Website",
    "Social Media",
    "Email",
    "Blog",
    "Advertisement",
    "Other"
]);

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
        if (channel !== undefined && (typeof channel !== "string" || !allowedChannels.has(channel))) {
            return res.status(400).json({
                success: false,
                message: "Select a supported content channel"
            });
        }

        const draft = await Draft.create({
            title: title.trim(),
            content: content || "",
            channel: channel || "Website",
            author: req.user.userId,
            organisationId: req.user.organisationId
        });

        await recordAudit({
            draft: draft._id,
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: "Created",
            newStatus: draft.status
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
        const role = String(req.user.role || "").toLowerCase();
        if (!["creator", "reviewer", "manager", "admin"].includes(role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to view drafts"
            });
        }

        const query = {
            organisationId: req.user.organisationId
        };
        if (role === "creator") {
            query.author = req.user.userId;
        } else {
            query.status = { $in: ["Pending Approval", "Needs Changes", "Approved"] };
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

const getCreatorActivity = async (req, res) => {
    try {
        const ownedDrafts = await Draft.find({
            author: req.user.userId,
            organisationId: req.user.organisationId
        }).select("_id").lean();
        const draftIds = ownedDrafts.map((draft) => draft._id);
        const activity = await AuditLog.find({
            organisationId: req.user.organisationId,
            draft: { $in: draftIds },
            action: { $in: ["Approved", "Changes Requested", "Commented"] }
        })
            .populate("draft", "title status")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return res.status(200).json({ success: true, activity });
    } catch (error) {
        console.error("Get creator activity error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch recent review activity"
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

        const role = String(req.user.role || "").toLowerCase();
        const isCreator = role === "creator";
        const isAuthor = String(draft.author?._id || draft.author) === String(req.user.userId);
        const isOwnedCreatorDraft = isCreator && isAuthor;
        const isSubmittedForReview = ["reviewer", "manager", "admin"].includes(role) &&
            ["Pending Approval", "Needs Changes", "Approved"].includes(draft.status);

        if (!isOwnedCreatorDraft && !isSubmittedForReview) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        const reviewHistory = await AuditLog.find({
            draft: draft._id,
            organisationId: req.user.organisationId,
            action: { $in: ["Submitted", "Commented", "Approved", "Changes Requested"] }
        })
            .populate("user", "name email")
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            draft: {
                ...(typeof draft.toObject === "function" ? draft.toObject() : draft),
                reviewHistory
            }
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

        if (typeof content !== "string") {
            return res.status(400).json({
                success: false,
                message: "Draft content must be a string"
            });
        }
        if (channel !== undefined && (typeof channel !== "string" || !allowedChannels.has(channel))) {
            return res.status(400).json({
                success: false,
                message: "Select a supported content channel"
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
        const previousStatus = draft.status;

        draft.title = newTitle;
        draft.content = newContent;
        draft.channel = newChannel;

        // Reset scan and approval data only when something changes

        if (contentChanged) {
            draft.findings = [];
            draft.findingsCount = 0;
            draft.scannedAt = null;
            draft.scanStatus = "not-scanned";
            draft.scanWarning = "";
            draft.status = "Draft";
        }


        await draft.save();

        if (contentChanged) {
            await recordAudit({
                draft: draft._id,
                user: req.user.userId,
                organisationId: req.user.organisationId,
                action: "Updated",
                previousStatus,
                newStatus: draft.status
            });
        }

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

        let result;
        try {
            const [facts, rules] = await Promise.all([
                Fact.find({
                    organisationId: req.user.organisationId,
                    status: { $in: ["Active", "Valid"] },
                    $or: [
                        { validUntil: null },
                        { validUntil: { $exists: false } },
                        { validUntil: { $gt: new Date() } }
                    ]
                }).select("title owner validUntil status").lean(),
                RulebookEntry.find({
                    organisationId: req.user.organisationId,
                    status: "Active"
                }).select("title description status").lean()
            ]);
            result = await geminiService.scanContent(draft.content, draft.title, {
                facts,
                rules
            });
        } catch (error) {
            await recordAudit({
                draft: draft._id,
                user: req.user.userId,
                organisationId: req.user.organisationId,
                action: "Scan Failed"
            });
            throw error;
        }

        // Safely handle the findings returned by Gemini
        const findings = Array.isArray(result?.findings)
            ? result.findings
            : [];

        // Save scan results in MongoDB
        draft.findings = findings;
        draft.findingsCount = findings.filter((finding) =>
            !finding.status || finding.status === "Open"
        ).length;
        draft.scannedAt = new Date();
        draft.scanStatus = result?.scanStatus === "partial" ? "partial" : "complete";
        draft.scanWarning = typeof result?.warning === "string" ? result.warning : "";

        await draft.save();
        await recordAudit({
            draft: draft._id,
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: draft.scanStatus === "partial" ? "Scan Partial" : "Scan Completed",
            metadata: { findingsCount: draft.findingsCount, scanStatus: draft.scanStatus }
        });

        return res.status(200).json({
            success: true,
            message: draft.scanStatus === "partial"
                ? "AI scan was incomplete. Only supported deterministic checks ran."
                : "Content scan completed",
            draftId: draft._id,
            findings: draft.findings,
            findingsCount: draft.findingsCount,
            summary: result?.summary || "",
            scanStatus: draft.scanStatus,
            warning: draft.scanWarning,
            scannedAt: draft.scannedAt
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

        if (!draft.scannedAt || draft.scanStatus === "partial") {
            return res.status(400).json({
                success: false,
                message: draft.scanStatus === "partial"
                    ? "A complete AI scan is required before submitting"
                    : "Run a content scan before submitting"
            });
        }

        if (draft.findings.some((finding) => !finding.status || finding.status === "Open")) {
            return res.status(400).json({
                success: false,
                message: "Resolve all scan findings before submitting"
            });
        }

        const previousStatus = draft.status;

        const submittedDraft = await Draft.findOneAndUpdate(
            {
                _id: draft._id,
                organisationId: req.user.organisationId,
                author: req.user.userId,
                status: previousStatus,
                scannedAt: { $ne: null }
            },
            {
                $set: {
                    status: "Pending Approval",
                    reviewedBy: null,
                    reviewedAt: null,
                    reviewComment: ""
                }
            },
            { new: true, runValidators: true }
        );
        if (!submittedDraft) {
            return res.status(409).json({
                success: false,
                message: "Draft changed while submitting. Reload and try again."
            });
        }

        // Save audit history
        await recordAudit({
            draft: submittedDraft._id,
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: "Submitted",
            previousStatus,
            newStatus: submittedDraft.status
        });

        return res.status(200).json({
            success: true,
            message: "Draft submitted for review",
            draft: submittedDraft
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
        const previousReview = {
            reviewedBy: draft.reviewedBy || null,
            reviewedAt: draft.reviewedAt || null,
            reviewComment: draft.reviewComment || ""
        };
        const newStatus = action === "approve" ? "Approved" : "Needs Changes";
        const reviewComment = typeof comment === "string" ? comment.trim() : "";
        const reviewedAt = new Date();
        const reviewedDraft = await Draft.findOneAndUpdate(
            {
                _id: draft._id,
                organisationId: req.user.organisationId,
                author: { $ne: req.user.userId },
                status: "Pending Approval"
            },
            {
                $set: {
                    status: newStatus,
                    reviewedBy: req.user.userId,
                    reviewedAt,
                    reviewComment
                }
            },
            { new: true, runValidators: true }
        );
        if (!reviewedDraft) {
            return res.status(409).json({
                success: false,
                message: "Draft has already been reviewed. Refresh the queue."
            });
        }

        // Save the review action in the audit log

        try {
            await recordAudit({
                draft: reviewedDraft._id,
                user: req.user.userId,
                organisationId: req.user.organisationId,
                action: action === "approve" ? "Approved" : "Changes Requested",
                comment: reviewComment,
                previousStatus,
                newStatus: reviewedDraft.status
            });
        } catch (auditError) {
            console.error("Review audit persistence failed:", auditError.message);

            try {
                const revertedDraft = await Draft.findOneAndUpdate(
                    {
                        _id: reviewedDraft._id,
                        organisationId: req.user.organisationId,
                        status: newStatus,
                        reviewedBy: req.user.userId,
                        reviewedAt,
                        reviewComment
                    },
                    {
                        $set: {
                            status: previousStatus,
                            ...previousReview
                        }
                    },
                    { new: true, runValidators: true }
                );

                if (!revertedDraft) {
                    console.error("Review status rollback did not match the updated draft");
                    return res.status(500).json({
                        success: false,
                        message: "Review history could not be saved. Reload the draft to verify its status before retrying."
                    });
                }
            } catch (rollbackError) {
                console.error("Review status rollback failed:", rollbackError.message);
                return res.status(500).json({
                    success: false,
                    message: "Review history could not be saved. Reload the draft to verify its status before retrying."
                });
            }

            return res.status(503).json({
                success: false,
                message: "The review was not saved because its audit history could not be recorded. Please retry."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                action === "approve"
                    ? "Draft approved successfully"
                    : "Changes requested successfully",
            draft: reviewedDraft
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

const addDraftComment = async (req, res) => {
    try {
        const { comment } = req.body;
        if (typeof comment !== "string" || !comment.trim()) {
            return res.status(400).json({
                success: false,
                message: "A comment is required"
            });
        }
        if (comment.trim().length > 4000) {
            return res.status(400).json({
                success: false,
                message: "Comment must be 4,000 characters or fewer"
            });
        }

        const draft = await Draft.findOne({
            _id: req.params.id,
            organisationId: req.user.organisationId,
            status: { $in: ["Pending Approval", "Needs Changes", "Approved"] }
        });
        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Submitted draft not found"
            });
        }
        if (String(draft.author) === String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: "Authors cannot comment through the review workflow"
            });
        }

        await recordAudit({
            draft: draft._id,
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: "Commented",
            comment: comment.trim(),
            previousStatus: draft.status,
            newStatus: draft.status
        });

        return res.status(201).json({
            success: true,
            message: "Comment recorded"
        });
    } catch (error) {
        console.error("Add draft comment error:", error.message);
        return res.status(error.name === "CastError" ? 400 : 500).json({
            success: false,
            message: error.name === "CastError" ? "Invalid draft ID" : "Unable to record comment"
        });
    }
};



module.exports = {
    createDraft,
    getDrafts,
    getCreatorActivity,
    getDraftById,
    updateDraft,
    scanDraft,
    submitDraft,
    reviewDraft,
    addDraftComment
};
