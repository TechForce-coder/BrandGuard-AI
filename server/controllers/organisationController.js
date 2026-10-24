
const Organisation = require("../models/Organisation");

const createOrganisation = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Organisation name is required"
            });
        }

        const existing = await Organisation.findOne({
            name: name.trim()
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Organisation already exists"
            });
        }

        const organisation = await Organisation.create({
            name: name.trim()
        });

        return res.status(201).json({
            success: true,
            message: "Organisation created successfully",
            organisation
        });
    } catch (error) {
        console.error("Create organisation error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create organisation"
        });
    }
};

module.exports = { createOrganisation };
