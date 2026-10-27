const mongoose = require("mongoose");

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