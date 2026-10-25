const AuditLog = require("../models/AuditLog");

const getAudit = async (req, res) => {
    try {
        const logs = await AuditLog.find({
            organisationId: req.user.organisationId
        })
            .populate("draft", "title")
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.status(200).json({
            success: true,
            logs: logs.map((log) => ({
                id: log._id,
                action: log.action,
                item: log.draft?.title || log.resourceName || "Content item",
                resourceType: log.resourceType || "draft",
                resourceId: log.resourceId || log.draft?._id,
                actor: log.user?.name || log.user?.email || "Workspace user",
                comment: log.comment || "",
                previousStatus: log.previousStatus,
                newStatus: log.newStatus,
                createdAt: log.createdAt
            }))
        });
    } catch (error) {
        console.error("Get audit log error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch audit events"
        });
    }
};

module.exports = { getAudit };
