const mongoose = require("mongoose");

const factSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        owner: {
            type: String,
            trim: true,
            maxlength: 160,
            default: ""
        },
        validUntil: {
            type: Date,
            default: null
        },
        status: {
            type: String,
            enum: ["Active", "Valid", "Expired", "Inactive"],
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

module.exports = mongoose.model("Fact", factSchema);
