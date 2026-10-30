const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: true
        },
        savedAt: {
            type: Date,
            default: Date.now
        },
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { _id: false }
);

const draftSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        content: {
            type: String,
            default: ""
        },
        // Baseline copy preserved from the initial creation
        originalContent: {
            type: String,
            default: ""
        },
        // Internal history of changes made across edits
        revisions: {
            type: [revisionSchema],
            default: []
        },
        findings: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        },
        findingsCount: {
            type: Number,
            default: 0
        },
        scannedAt: {
            type: Date,
            default: null
        },
        scanStatus: {
            type: String,
            enum: ["not-scanned", "complete", "partial"],
            default: undefined
        },
        scanWarning: {
            type: String,
            default: ""
        },
        channel: {
            type: String,
            default: "Website"
        },
        hasImage: {
            type: Boolean,
            default: false
        },
        altText: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },
        imageUrl: {
            type: String,
            trim: true,
            default: ""
        },
        // Persisted Gemini compliance report for uploaded media
        imageAnalysis: {
            type: String,
            default: ""
        },
        status: {
            type: String,
            enum: [
                "Draft",
                "Pending Approval",
                "Approved",
                "Needs Changes"
            ],
            default: "Draft"
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewComment: {
            type: String,
            trim: true,
            default: ""
        },
        organisationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organisation",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Draft", draftSchema);