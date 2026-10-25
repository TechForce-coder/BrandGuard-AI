const mongoose = require("mongoose");
const { recordAudit } = require("../services/auditService");

const configurations = {
    rules: {
        Model: require("../models/RulebookEntry"),
        resourceType: "rule",
        auditLabel: "Rule",
        responseKey: "rules",
        fields: ["title", "description", "status"],
        requiredStrings: ["title", "description"],
        defaults: { status: "Active" }
    },
    facts: {
        Model: require("../models/Fact"),
        resourceType: "fact",
        auditLabel: "Fact",
        responseKey: "facts",
        fields: ["title", "owner", "validUntil", "status"],
        requiredStrings: ["title"],
        defaults: { owner: "", validUntil: null, status: "Active" }
    }
};

function getConfiguration(resource) {
    const config = configurations[resource];
    if (!config) throw new Error("Unknown catalog resource");
    return config;
}

function validatePayload(config, body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { message: "A JSON object is required" };
    }

    for (const field of config.requiredStrings) {
        if ((!partial || Object.hasOwn(body, field)) &&
            (typeof body[field] !== "string" || !body[field].trim())) {
            return { message: `${field} is required` };
        }
    }

    for (const field of config.fields) {
        if (!Object.hasOwn(body, field)) continue;
        const value = body[field];
        if (field === "validUntil" && value !== null && value !== "") {
            if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
                return { message: "validUntil must be a valid date" };
            }
        } else if (field !== "validUntil" && typeof value !== "string") {
            return { message: `${field} must be a string` };
        }
    }

    const status = body.status;
    const allowedStatuses = config.resourceType === "rule"
        ? ["Active", "Inactive"]
        : ["Active", "Valid", "Expired", "Inactive"];
    if (status !== undefined && !allowedStatuses.includes(status)) {
        return { message: "Invalid status" };
    }

    return null;
}

function normalizePayload(config, body, partial = false) {
    const payload = {};
    for (const field of config.fields) {
        if (!Object.hasOwn(body, field)) {
            if (!partial && Object.hasOwn(config.defaults, field)) {
                payload[field] = config.defaults[field];
            }
            continue;
        }

        const value = body[field];
        payload[field] = field === "validUntil" && value === ""
            ? null
            : typeof value === "string" ? value.trim() : value;
    }
    return payload;
}

const listResource = (resource) => async (req, res) => {
    const config = getConfiguration(resource);
    try {
        const records = await config.Model.find({
            organisationId: req.user.organisationId
        }).sort({ updatedAt: -1 }).lean();
        return res.status(200).json({
            success: true,
            [config.responseKey]: records
        });
    } catch (error) {
        console.error(`List ${resource} error:`, error.message);
        return res.status(500).json({
            success: false,
            message: `Unable to fetch ${resource}`
        });
    }
};

const createResource = (resource) => async (req, res) => {
    const config = getConfiguration(resource);
    const validationError = validatePayload(config, req.body);
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError.message });
    }

    try {
        const record = await config.Model.create({
            ...normalizePayload(config, req.body),
            organisationId: req.user.organisationId,
            createdBy: req.user.userId
        });
        await recordAudit({
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: `${config.auditLabel} Created`,
            resourceType: config.resourceType,
            resourceId: record._id,
            resourceName: record.title
        });
        return res.status(201).json({
            success: true,
            message: `${config.auditLabel} created`,
            [resource === "rules" ? "rule" : "fact"]: record
        });
    } catch (error) {
        console.error(`Create ${resource} error:`, error.message);
        return res.status(500).json({
            success: false,
            message: `Unable to create ${resource === "rules" ? "rule" : "fact"}`
        });
    }
};

const updateResource = (resource) => async (req, res) => {
    const config = getConfiguration(resource);
    const validationError = validatePayload(config, req.body, true);
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError.message });
    }

    try {
        const record = await config.Model.findOneAndUpdate(
            { _id: req.params.id, organisationId: req.user.organisationId },
            normalizePayload(config, req.body, true),
            { new: true, runValidators: true }
        );
        if (!record) {
            return res.status(404).json({
                success: false,
                message: `${config.auditLabel} not found`
            });
        }
        await recordAudit({
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: `${config.auditLabel} Updated`,
            resourceType: config.resourceType,
            resourceId: record._id,
            resourceName: record.title
        });
        return res.status(200).json({
            success: true,
            message: `${config.auditLabel} updated`,
            [resource === "rules" ? "rule" : "fact"]: record
        });
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ success: false, message: "Invalid resource ID" });
        }
        console.error(`Update ${resource} error:`, error.message);
        return res.status(500).json({
            success: false,
            message: `Unable to update ${resource === "rules" ? "rule" : "fact"}`
        });
    }
};

const deleteResource = (resource) => async (req, res) => {
    const config = getConfiguration(resource);
    try {
        const record = await config.Model.findOneAndDelete({
            _id: req.params.id,
            organisationId: req.user.organisationId
        });
        if (!record) {
            return res.status(404).json({
                success: false,
                message: `${config.auditLabel} not found`
            });
        }
        await recordAudit({
            user: req.user.userId,
            organisationId: req.user.organisationId,
            action: `${config.auditLabel} Deleted`,
            resourceType: config.resourceType,
            resourceId: record._id,
            resourceName: record.title
        });
        return res.status(200).json({
            success: true,
            message: `${config.auditLabel} deleted`
        });
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ success: false, message: "Invalid resource ID" });
        }
        console.error(`Delete ${resource} error:`, error.message);
        return res.status(500).json({
            success: false,
            message: `Unable to delete ${resource === "rules" ? "rule" : "fact"}`
        });
    }
};

module.exports = { listResource, createResource, updateResource, deleteResource };
