const AuditLog = require("../models/AuditLog");

async function recordAudit({
    draft,
    user,
    organisationId,
    action,
    comment = "",
    previousStatus = "",
    newStatus = "",
    metadata,
    resourceType = "draft",
    resourceId,
    resourceName = ""
}) {
    return AuditLog.create({
        draft,
        user,
        organisationId,
        action,
        comment,
        previousStatus,
        newStatus,
        metadata,
        resourceType,
        resourceId,
        resourceName
    });
}

module.exports = { recordAudit };
