const mongoose = require("mongoose");

const organisationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "Organisation",
    organisationSchema
);
