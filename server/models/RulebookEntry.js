const mongoose = require("mongoose");

const rulebookEntrySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active"
        },
        organisationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organisation",
            required: true,
            index: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("RulebookEntry", rulebookEntrySchema);
