const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        draft: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Draft",
            required: false
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
                "Created",
                "Updated",
                "Scan Completed",
                "Scan Failed",
                "Finding Accepted",
                "Finding Rejected",
                "Finding Disputed",
                "Submitted",
                "Commented",
                "Approved",
                "Changes Requested",
                "Rule Created",
                "Rule Updated",
                "Rule Deleted",
                "Fact Created",
                "Fact Updated",
                "Fact Deleted"
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
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: undefined
        },

        resourceType: {
            type: String,
            enum: ["draft", "rule", "fact"],
            default: "draft"
        },

        resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: undefined
        },

        resourceName: {
            type: String,
            trim: true,
            default: ""
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
