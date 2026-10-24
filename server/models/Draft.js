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
        channel: {
            type: String,
            default: "Website"
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
        organisationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organisation",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Draft", draftSchema);