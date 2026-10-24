const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        draft: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Draft",
            required: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        organisationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organisation",
            required: true
        },

        action: {
            type: String,
            enum: [
                "Submitted",
                "Approved",
                "Changes Requested"
            ],
            required: true
        },

        comment: {
            type: String,
            trim: true,
            default: ""
        },

        previousStatus: {
            type: String,
            default: ""
        },

        newStatus: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
