
const Draft = require("../models/Draft");

const updateFinding = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const allowedStatuses = ["Accepted", "Rejected", "Disputed"];
        
        if (status === "Disputed" && (!reason || !reason.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please enter a proper reason for dispute"
            });
        }


        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid finding status"
            });
        }

        // The URL ID is the finding's array index.
        const findingIndex = Number(id);

        if (
            !Number.isInteger(findingIndex) ||
            findingIndex < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid finding index"
            });
        }

        // Find the draft containing this finding index.
        // Note: The frontend must also send draftId to identify
        // the correct draft; see the next step below.
        const draftId = req.body.draftId;

        if (!draftId) {
            return res.status(400).json({
                success: false,
                message: "Draft ID is required"
            });
        }

        const draft = await Draft.findOne({
            _id: draftId,
            organisationId: req.user.organisationId
        });

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft not found"
            });
        }

        if (
            !Array.isArray(draft.findings) ||
            findingIndex >= draft.findings.length
        ) {
            return res.status(404).json({
                success: false,
                message: "Finding not found"
            });
        }

        draft.findings[findingIndex].status = status;
        draft.findings[findingIndex].reason = reason || "";

        draft.markModified("findings");
        await draft.save();

        return res.status(200).json({
            success: true,
            message: "Finding updated successfully",
            finding: draft.findings[findingIndex]
        });
    } catch (error) {
        console.error("Update finding error:", error.message);

        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid draft or finding ID"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to update finding"
        });
    }
};

module.exports = { updateFinding };
