const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const Draft = require("../models/Draft");
const AuditLog = require("../models/AuditLog");
const RulebookEntry = require("../models/RulebookEntry");
const Fact = require("../models/Fact");
const User = require("../models/User");
const geminiService = require("../services/geminiService");

process.env.JWT_SECRET = "brandguard-test-signing-key";
const testUsers = new Map();
const originalUserFindById = User.findById;
User.findById = (userId) => ({
    select: async () => testUsers.get(String(userId)) || null
});
const app = require("../app");

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        server.close();
        await once(server, "close");
    }
    User.findById = originalUserFindById;
});

const tokenForRole = (role, userId = "test-user", organisationId = "test-organisation") => {
    testUsers.set(userId, {
        _id: userId,
        organisationId,
        role
    });
    return jwt.sign({
        userId,
        organisationId,
        role
    }, process.env.JWT_SECRET);
};

async function withStubs(stubs, callback) {
    const originals = [];
    for (const [target, methods] of stubs) {
        for (const [name, implementation] of Object.entries(methods)) {
            originals.push([target, name, target[name]]);
            target[name] = implementation;
        }
    }

    try {
        return await callback();
    } finally {
        for (const [target, name, original] of originals.reverse()) {
            target[name] = original;
        }
    }
}

test("health endpoint responds with JSON", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type").split(";")[0], "application/json");
    assert.equal((await response.json()).success, true);
});

test("draft list API rejects successful responses with an unexpected shape", async () => {
    const { api } = await import("../../client/src/api/api.js");
    const originalFetch = global.fetch;
    const originalLocalStorage = global.localStorage;
    global.localStorage = { getItem: () => null };
    global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
    });

    try {
        await assert.rejects(
            api.getDrafts(),
            /Drafts response was not in the expected format/
        );
    } finally {
        global.fetch = originalFetch;
        if (originalLocalStorage === undefined) {
            delete global.localStorage;
        } else {
            global.localStorage = originalLocalStorage;
        }
    }
});

test("frontend login uses the verified profile returned by the authenticated session endpoint", async () => {
    const { api } = await import("../../client/src/api/api.js");
    const originalFetch = global.fetch;
    const originalLocalStorage = global.localStorage;
    const values = new Map();
    global.localStorage = {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    const requests = [];
    global.fetch = async (url, options) => {
        requests.push({ url, options });
        return {
            ok: true,
            status: 200,
            json: async () => url.endsWith("/auth/login")
                ? { success: true, token: "verified-session-token", user: { role: "creator" } }
                : { success: true, user: { id: "manager-account", role: "manager" } }
        };
    };

    try {
        const result = await api.login("member@example.test", "valid-password");
        assert.equal(result.user.id, "manager-account");
        assert.equal(result.user.role, "manager");
        assert.equal(values.get("brandguard-token"), "verified-session-token");
        assert.equal(requests.length, 2);
        assert.equal(requests[0].url, "/api/auth/login");
        assert.equal(requests[1].url, "/api/auth/me");
        assert.equal(requests[1].options.headers.Authorization, "Bearer verified-session-token");
    } finally {
        global.fetch = originalFetch;
        if (originalLocalStorage === undefined) delete global.localStorage;
        else global.localStorage = originalLocalStorage;
    }
});

test("frontend login clears a token when the authenticated profile cannot be verified", async () => {
    const { api } = await import("../../client/src/api/api.js");
    const originalFetch = global.fetch;
    const originalLocalStorage = global.localStorage;
    const values = new Map();
    global.localStorage = {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    global.fetch = async url => ({
        ok: url.endsWith("/auth/login"),
        status: url.endsWith("/auth/login") ? 200 : 503,
        json: async () => url.endsWith("/auth/login")
            ? { success: true, token: "unverified-session-token" }
            : { success: false, message: "Profile unavailable" }
    });

    try {
        await assert.rejects(api.login("member@example.test", "valid-password"), /Profile unavailable/);
        assert.equal(values.has("brandguard-token"), false);
    } finally {
        global.fetch = originalFetch;
        if (originalLocalStorage === undefined) delete global.localStorage;
        else global.localStorage = originalLocalStorage;
    }
});

test("development workspace selection is presentation-only and disables preview mutations", async () => {
    const {
        canMutateInWorkspace,
        isWorkspacePreviewEnabled,
        resolveWorkspaceSelection
    } = await import("../../client/src/utils/workspacePreview.js");

    assert.equal(isWorkspacePreviewEnabled(true, "true"), true);
    assert.equal(isWorkspacePreviewEnabled(true, "false"), false);
    assert.equal(isWorkspacePreviewEnabled(true, undefined), false);
    assert.equal(isWorkspacePreviewEnabled(false, "true"), false);

    const managerPreview = resolveWorkspaceSelection("creator", "Manager", true);
    assert.deepEqual(managerPreview, {
        actualRole: "Creator",
        workspaceRole: "Manager",
        previewMode: true
    });
    assert.equal(canMutateInWorkspace(managerPreview.previewMode), false);
    for (const role of ["Creator", "Reviewer", "Manager", "Admin"]) {
        const selection = resolveWorkspaceSelection("creator", role, true);
        assert.equal(selection.actualRole, "Creator");
        assert.equal(selection.workspaceRole, role);
        assert.equal(selection.previewMode, role !== "Creator");
        assert.equal(canMutateInWorkspace(selection.previewMode), role === "Creator");
    }
    assert.deepEqual(resolveWorkspaceSelection("manager", "Manager", true), {
        actualRole: "Manager",
        workspaceRole: "Manager",
        previewMode: false
    });
    assert.deepEqual(resolveWorkspaceSelection("creator", "Manager", false), {
        actualRole: "Creator",
        workspaceRole: "Creator",
        previewMode: false
    });
    assert.equal(canMutateInWorkspace(false), true);

    const { WORKSPACE_CONFIG } = await import("../../client/src/utils/workspacePreview.js");
    const expectedNavigation = {
        Creator: [["/", "Dashboard"], ["/drafts", "My Drafts"], ["/drafts/new", "Submit Content"]],
        Reviewer: [["/", "Dashboard"], ["/review", "Review Queue"], ["/drafts", "Submitted Content"], ["/audit", "Audit Log"]],
        Manager: [["/", "Dashboard"], ["/review", "Approval Workflow"], ["/rulebook", "Guideline Library"], ["/facts", "Facts"], ["/audit", "Privacy & Audit Log"]],
        Admin: [["/", "Dashboard"], ["/drafts", "Content"], ["/rulebook", "Guideline Library"], ["/facts", "Facts"], ["/audit", "Audit Log"], ["/settings", "Administration"]]
    };
    for (const role of ["Creator", "Reviewer", "Manager", "Admin"]) {
        const selectedWorkspace = resolveWorkspaceSelection("creator", role, true).workspaceRole;
        const config = WORKSPACE_CONFIG[selectedWorkspace];
        assert.ok(config.dashboardTitle);
        assert.deepEqual(config.navigation.map(item => [item.to, item.label]), expectedNavigation[role]);
    }
    assert.equal(WORKSPACE_CONFIG.Manager.dashboardTitle, "Governance Overview");
    assert.ok(WORKSPACE_CONFIG.Manager.navigation.some(item =>
        item.to === "/review" && item.label === "Approval Workflow"
    ));
    assert.ok(WORKSPACE_CONFIG.Manager.navigation.some(item => item.to === "/rulebook"));
    assert.ok(WORKSPACE_CONFIG.Manager.navigation.some(item => item.to === "/facts"));
    assert.ok(WORKSPACE_CONFIG.Manager.navigation.some(item => item.to === "/audit"));
    assert.notEqual(WORKSPACE_CONFIG.Manager.dashboardTitle, WORKSPACE_CONFIG.Creator.dashboardTitle);

    const creatorToken = tokenForRole("creator", "preview-creator");
    const protectedMutation = await fetch(`${baseUrl}/api/facts`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${creatorToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "Not authorized by preview selection" })
    });
    assert.equal(protectedMutation.status, 403);
});

test("unknown API routes return JSON 404 instead of the SPA", async () => {
    const response = await fetch(`${baseUrl}/api/not-implemented`, {
        headers: { Accept: "text/html" }
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type").split(";")[0], "application/json");
    assert.equal((await response.json()).message, "API endpoint not found");
});

test("draft, audit, rulebook, and facts routes enforce authentication and role gates", async () => {
    const deniedRequests = [
        ["creator", "POST", "/api/drafts/x/approve"],
        ["creator", "POST", "/api/drafts/x/comments"],
        ["reviewer", "GET", "/api/drafts/activity"],
        ["manager", "GET", "/api/drafts/activity"],
        ["admin", "GET", "/api/drafts/activity"],
        ["creator", "GET", "/api/audit"],
        ["creator", "POST", "/api/rulebook"],
        ["creator", "POST", "/api/facts"],
        ["creator", "PUT", "/api/rulebook/x"],
        ["creator", "DELETE", "/api/rulebook/x"],
        ["creator", "PUT", "/api/facts/x"],
        ["creator", "DELETE", "/api/facts/x"],
        ["reviewer", "POST", "/api/drafts"],
        ["reviewer", "PUT", "/api/drafts/x"],
        ["reviewer", "POST", "/api/drafts/x/scan"],
        ["reviewer", "POST", "/api/drafts/x/submit"],
        ["reviewer", "PATCH", "/api/findings/0"],
        ["reviewer", "POST", "/api/rulebook"],
        ["reviewer", "POST", "/api/facts"],
        ["reviewer", "PUT", "/api/rulebook/x"],
        ["reviewer", "DELETE", "/api/rulebook/x"],
        ["reviewer", "PUT", "/api/facts/x"],
        ["reviewer", "DELETE", "/api/facts/x"],
        ["manager", "POST", "/api/drafts"],
        ["manager", "PUT", "/api/drafts/x"],
        ["manager", "POST", "/api/drafts/x/scan"],
        ["manager", "POST", "/api/drafts/x/submit"],
        ["manager", "PATCH", "/api/findings/0"],
        ["admin", "POST", "/api/drafts"],
        ["admin", "PUT", "/api/drafts/x"],
        ["admin", "POST", "/api/drafts/x/scan"],
        ["admin", "POST", "/api/drafts/x/submit"],
        ["admin", "PATCH", "/api/findings/0"]
    ];

    for (const [role, method, endpoint] of deniedRequests) {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: {
                Authorization: `Bearer ${tokenForRole(role)}`,
                "Content-Type": "application/json"
            },
            body: method === "GET" ? undefined : JSON.stringify({})
        });
        assert.equal(response.status, 403, `${role} must be denied ${method} ${endpoint}`);
    }

    for (const endpoint of ["/api/drafts", "/api/audit", "/api/rulebook", "/api/facts"]) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        assert.equal(response.status, 401, `${endpoint} must require authentication`);
    }
});

test("authorization uses the current database role instead of stale JWT claims", async () => {
    const creatorUserId = "stale-admin-token-user";
    testUsers.set(creatorUserId, {
        _id: creatorUserId,
        organisationId: "current-organisation",
        role: "creator"
    });
    const staleAdminToken = jwt.sign({
        userId: creatorUserId,
        organisationId: "old-organisation",
        role: "admin"
    }, process.env.JWT_SECRET);
    const creatorDenied = await fetch(`${baseUrl}/api/facts`, {
        headers: { Authorization: `Bearer ${staleAdminToken}` }
    });
    assert.equal(creatorDenied.status, 403);

    const adminUserId = "stale-creator-token-user";
    testUsers.set(adminUserId, {
        _id: adminUserId,
        organisationId: "current-organisation",
        role: "admin"
    });
    const staleCreatorToken = jwt.sign({
        userId: adminUserId,
        organisationId: "old-organisation",
        role: "creator"
    }, process.env.JWT_SECRET);
    const listQuery = {
        sort() { return this; },
        async lean() { return []; }
    };
    let organizationId;
    await withStubs([
        [Fact, {
            find: query => {
                organizationId = query.organisationId;
                return listQuery;
            }
        }]
    ], async () => {
        const adminAllowed = await fetch(`${baseUrl}/api/facts`, {
            headers: { Authorization: `Bearer ${staleCreatorToken}` }
        });
        assert.equal(adminAllowed.status, 200);
    });
    assert.equal(organizationId, "current-organisation");
});

test("authentication reports an account lookup outage instead of treating it as a valid session", async () => {
    await withStubs([
        [User, {
            findById: () => ({
                select: async () => {
                    throw new Error("database unavailable");
                }
            })
        }]
    ], async () => {
        const response = await fetch(`${baseUrl}/api/audit`, {
            headers: { Authorization: `Bearer ${tokenForRole("reviewer", "lookup-failure-user")}` }
        });
        assert.equal(response.status, 503);
        assert.equal((await response.json()).message, "Authentication service temporarily unavailable");
    });
});

test("authenticated logout revokes the current token on the server", async () => {
    const userId = "logout-test-user";
    const organisationId = "logout-test-organisation";
    const account = { _id: userId, organisationId, role: "creator", tokenVersion: 0 };
    testUsers.set(userId, account);
    const token = jwt.sign({
        userId,
        organisationId,
        role: "creator",
        tokenVersion: account.tokenVersion
    }, process.env.JWT_SECRET);

    await withStubs([
        [User, {
            findByIdAndUpdate: async (id, update) => {
                assert.equal(String(id), userId);
                account.tokenVersion += update.$inc.tokenVersion;
                return account;
            }
        }]
    ], async () => {
        const signedOut = await fetch(`${baseUrl}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(signedOut.status, 204);

        const reusedToken = await fetch(`${baseUrl}/api/drafts`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(reusedToken.status, 401);
    });
});

test("manager and admin catalog writes validate input before persistence", async () => {
    for (const role of ["manager", "admin"]) {
        for (const endpoint of ["/api/rulebook", "/api/facts"]) {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokenForRole(role)}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });
            assert.equal(response.status, 400, `${role} must reach validation for ${endpoint}`);
        }
    }

    const invalidFactDate = await fetch(`${baseUrl}/api/facts`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokenForRole("manager")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "Unsupported date", validUntil: "not-a-date" })
    });
    assert.equal(invalidFactDate.status, 400);
});

test("authorized roles receive organization-scoped submitted drafts and audit history", async () => {
    let draftQuery;
    let auditQuery;
    const draftQueryBuilder = {
        populate() { return this; },
        sort() { return this; },
        async lean() { return []; }
    };
    const auditQueryBuilder = {
        populate() { return this; },
        sort() { return this; },
        limit() { return this; },
        async lean() { return []; }
    };

    await withStubs([
        [Draft, { find: query => { draftQuery = query; return draftQueryBuilder; } }],
        [AuditLog, { find: query => { auditQuery = query; return auditQueryBuilder; } }]
    ], async () => {
        for (const role of ["creator", "reviewer", "manager", "admin"]) {
            const response = await fetch(`${baseUrl}/api/drafts`, {
                headers: { Authorization: `Bearer ${tokenForRole(role)}` }
            });
            assert.equal(response.status, 200);
            assert.equal(String(draftQuery.organisationId), "test-organisation");
            if (role === "creator") {
                assert.equal(String(draftQuery.author), "test-user");
                assert.equal(draftQuery.status, undefined);
            } else {
                assert.deepEqual(draftQuery.status.$in, ["Pending Approval", "Needs Changes", "Approved"]);
            }
        }

        for (const role of ["reviewer", "manager", "admin"]) {
            const response = await fetch(`${baseUrl}/api/audit`, {
                headers: { Authorization: `Bearer ${tokenForRole(role)}` }
            });
            assert.equal(response.status, 200);
            assert.equal(String(auditQuery.organisationId), "test-organisation");
        }
    });
});

test("creator can view owned drafts at every status while other roles retain submission restrictions", async () => {
    let record = { author: "creator-id", status: "Pending Approval" };
    const draftQuery = {
        async populate() { return record; }
    };
    await withStubs([
        [Draft, { findOne: () => draftQuery }],
        [AuditLog, { find: () => ({
            populate() { return this; },
            sort() { return this; },
            async lean() { return []; }
        }) }]
    ], async () => {
        const creatorPending = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001`, {
            headers: { Authorization: `Bearer ${tokenForRole("creator", "creator-id")}` }
        });
        assert.equal(creatorPending.status, 200);

        record = { author: "creator-id", status: "Draft" };
        const creatorOwnDraft = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001`, {
            headers: { Authorization: `Bearer ${tokenForRole("creator", "creator-id")}` }
        });
        assert.equal(creatorOwnDraft.status, 200);

        const creatorOtherDraft = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001`, {
            headers: { Authorization: `Bearer ${tokenForRole("creator", "another-creator")}` }
        });
        assert.equal(creatorOtherDraft.status, 404);

        const reviewerDraft = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001`, {
            headers: { Authorization: `Bearer ${tokenForRole("reviewer")}` }
        });
        assert.equal(reviewerDraft.status, 404);

        const managerDraft = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001`, {
            headers: { Authorization: `Bearer ${tokenForRole("manager")}` }
        });
        assert.equal(managerDraft.status, 404);

        record = { author: "creator-id", status: "Pending Approval" };
        const reviewerSubmitted = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001`, {
            headers: { Authorization: `Bearer ${tokenForRole("reviewer")}` }
        });
        assert.equal(reviewerSubmitted.status, 200);
    });
});

test("invalid comment and finding requests fail before database access", async () => {
    const comment = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001/comments`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokenForRole("reviewer")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ comment: "  " })
    });
    assert.equal(comment.status, 400);

    const finding = await fetch(`${baseUrl}/api/findings/not-an-index`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${tokenForRole("creator")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "Accepted", draftId: "64f000000000000000000001" })
    });
    assert.equal(finding.status, 400);

    const malformedBody = await fetch(`${baseUrl}/api/drafts/64f000000000000000000001/comments`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokenForRole("reviewer")}`,
            "Content-Type": "application/json"
        },
        body: "null"
    });
    assert.equal(malformedBody.status, 400);
});

test("manager and admin can persist organization-scoped rules and facts", async () => {
    const createdAudit = [];
    const createdResources = [];
    const record = (payload) => ({ ...payload, _id: "64f000000000000000000002" });
    await withStubs([
        [RulebookEntry, {
            create: async payload => {
                createdResources.push(payload);
                return record(payload);
            }
        }],
        [Fact, {
            create: async payload => {
                createdResources.push(payload);
                return record(payload);
            }
        }],
        [AuditLog, {
            create: async payload => {
                createdAudit.push(payload);
                return payload;
            }
        }]
    ], async () => {
        for (const role of ["manager", "admin"]) {
            const rule = await fetch(`${baseUrl}/api/rulebook`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokenForRole(role)}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ title: `Rule ${role}`, description: "Workspace guidance" })
            });
            assert.equal(rule.status, 201);

            const fact = await fetch(`${baseUrl}/api/facts`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokenForRole(role)}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ title: `Fact ${role}`, owner: "Legal", validUntil: null })
            });
            assert.equal(fact.status, 201);
        }
    });

    assert.equal(createdResources.length, 4);
    assert.ok(createdResources.every(resource => String(resource.organisationId) === "test-organisation"));
    assert.equal(createdAudit.length, 4);
});

test("catalog list, update, and delete remain organization scoped and audited", async () => {
    const operations = [];
    const auditEvents = [];
    const makeModelStubs = (resource) => ({
        find: query => {
            operations.push({ resource, action: "list", query });
            return { sort() { return this; }, async lean() { return []; } };
        },
        findOneAndUpdate: async (query, update) => {
            operations.push({ resource, action: "update", query, update });
            return { _id: "64f000000000000000000004", title: `Updated ${resource}` };
        },
        findOneAndDelete: async query => {
            operations.push({ resource, action: "delete", query });
            return { _id: "64f000000000000000000004", title: `Deleted ${resource}` };
        }
    });

    await withStubs([
        [RulebookEntry, makeModelStubs("rules")],
        [Fact, makeModelStubs("facts")],
        [AuditLog, { create: async payload => { auditEvents.push(payload); return payload; } }]
    ], async () => {
        for (const resource of ["rulebook", "facts"]) {
            const root = `${baseUrl}/api/${resource}`;
            const headers = {
                Authorization: `Bearer ${tokenForRole("manager")}`,
                "Content-Type": "application/json"
            };
            assert.equal((await fetch(root, { headers })).status, 200);
            assert.equal((await fetch(`${root}/64f000000000000000000004`, {
                method: "PUT",
                headers,
                body: JSON.stringify(resource === "rulebook"
                    ? { title: "Updated rules", description: "Updated guidance" }
                    : { title: "Updated fact", owner: "Compliance" })
            })).status, 200);
            assert.equal((await fetch(`${root}/64f000000000000000000004`, {
                method: "DELETE",
                headers
            })).status, 200);
        }
    });

    assert.equal(operations.length, 6);
    assert.ok(operations.every(operation => String(operation.query.organisationId) === "test-organisation"));
    assert.deepEqual(auditEvents.map(event => event.action), [
        "Rule Updated",
        "Rule Deleted",
        "Fact Updated",
        "Fact Deleted"
    ]);
});

test("draft lifecycle enforces roles and records workflow history", async () => {
    const events = [];
    let draft;
    let scanContext;
    await withStubs([
        [Draft, {
            create: async payload => {
                draft = {
                    ...payload,
                    _id: "64f000000000000000000003",
                    findings: [],
                    findingsCount: 0,
                    scannedAt: null,
                    status: "Draft",
                    markModified() {},
                    async save() { return this; }
                };
                return draft;
            },
            findOne: query => ({
                populate() { return this; },
                then(resolve, reject) {
                    const organizationMatches =
                        !query.organisationId ||
                        String(query.organisationId) === String(draft.organisationId);
                    const idMatches = !query._id || String(query._id) === String(draft._id);
                    const authorMatches =
                        !query.author || String(query.author) === String(draft.author);
                    return Promise.resolve(
                        organizationMatches && idMatches && authorMatches ? draft : null
                    ).then(resolve, reject);
                }
            }),
            find: query => ({
                populate() { return this; },
                sort() { return this; },
                async lean() {
                    const statusMatches = !query.status || query.status.$in.includes(draft.status);
                    const authorMatches = !query.author || String(query.author) === String(draft.author);
                    const organizationMatches =
                        String(query.organisationId) === String(draft.organisationId);
                    return statusMatches && authorMatches && organizationMatches ? [draft] : [];
                }
            }),
            findOneAndUpdate: async (query, update) => {
                if (query.organisationId && String(query.organisationId) !== String(draft.organisationId)) return null;
                if (query._id && String(query._id) !== String(draft._id)) return null;
                if (query.status && draft.status !== query.status) return null;
                if (query.author?.$ne && String(query.author.$ne) === String(draft.author)) return null;
                if (query.author && !query.author.$ne && String(query.author) !== String(draft.author)) return null;
                if (query.reviewedBy && String(query.reviewedBy) !== String(draft.reviewedBy)) return null;
                if (query.reviewedAt && query.reviewedAt !== draft.reviewedAt) return null;
                if (query.reviewComment !== undefined && query.reviewComment !== draft.reviewComment) return null;
                Object.assign(draft, update.$set || {});
                for (const field of Object.keys(update.$unset || {})) {
                    delete draft[field];
                }
                return draft;
            }
        }],
        [AuditLog, {
            create: async payload => {
                events.push(payload);
                return payload;
            },
            find: () => ({
                populate() { return this; },
                sort() { return this; },
                async lean() { return events; }
            })
        }],
        [Fact, {
            find: () => ({
                select() { return this; },
                async lean() { return []; }
            })
        }],
        [RulebookEntry, {
            find: () => ({
                select() { return this; },
                async lean() { return []; }
            })
        }],
        [geminiService, {
            scanContent: async (content, title, context) => {
                scanContext = context;
                return ({
                findings: [{
                    type: "Unsupported claim",
                    quote: "Guaranteed result",
                    explanation: "The claim requires evidence.",
                    status: "Open"
                }]
                });
            }
        }]
    ], async () => {
        const send = (role, endpoint, method, body, userId, organisationId = "test-organisation") => fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: {
                Authorization: ["Bearer", tokenForRole(role, userId, organisationId)].join(" "),
                "Content-Type": "application/json"
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });

        const created = await send("creator", "/api/drafts", "POST", {
            title: "Launch announcement",
            content: "Initial content",
            channel: "Website",
            hasImage: true,
            altText: "image"
        }, "creator-id");
        assert.equal(created.status, 201);
        assert.equal(draft.hasImage, true);
        assert.equal(draft.altText, "image");

        const managerCannotSeeUnsubmittedDraft = await send(
            "manager",
            "/api/drafts",
            "GET",
            undefined,
            "manager-id"
        );
        assert.deepEqual((await managerCannotSeeUnsubmittedDraft.json()).drafts, []);

        const draftOrganization = draft.organisationId;
        draft.organisationId = "another-organisation";
        const managerCannotSeeOtherOrganization = await send(
            "manager",
            "/api/drafts",
            "GET",
            undefined,
            "manager-id"
        );
        assert.deepEqual((await managerCannotSeeOtherOrganization.json()).drafts, []);
        draft.organisationId = draftOrganization;

        const saved = await send("creator", `/api/drafts/${draft._id}`, "PUT", {
            title: "Launch announcement",
            content: "Updated content",
            channel: "Website",
            hasImage: true,
            altText: "Updated image alt-text"
        }, "creator-id");
        assert.equal(saved.status, 200);
        assert.equal(draft.altText, "Updated image alt-text");

        const scanned = await send("creator", `/api/drafts/${draft._id}/scan`, "POST", {}, "creator-id");
        assert.equal(scanned.status, 200);
        assert.equal(draft.findings.length, 1);
        assert.equal(scanContext.hasImage, true);
        assert.equal(scanContext.altText, "Updated image alt-text");

        const finding = await send("creator", "/api/findings/0", "PATCH", {
            draftId: draft._id,
            status: "Accepted",
            reason: ""
        }, "creator-id");
        assert.equal(finding.status, 200);

        const submitted = await send("creator", `/api/drafts/${draft._id}/submit`, "POST", {}, "creator-id");
        assert.equal(submitted.status, 200);
        assert.equal(draft.status, "Pending Approval");

        const managerPendingQueue = await send("manager", "/api/drafts", "GET", undefined, "manager-id");
        const pendingQueueBody = await managerPendingQueue.json();
        assert.equal(managerPendingQueue.status, 200);
        assert.equal(pendingQueueBody.drafts.length, 1);
        assert.equal(pendingQueueBody.drafts[0].status, "Pending Approval");

        const nonManagerCannotApprove = await send(
            "creator",
            `/api/drafts/${draft._id}/approve`,
            "POST",
            {},
            "unrelated-creator"
        );
        assert.equal(nonManagerCannotApprove.status, 403);
        assert.equal(draft.status, "Pending Approval");

        const crossOrganizationApproval = await send(
            "manager",
            `/api/drafts/${draft._id}/approve`,
            "POST",
            {},
            "foreign-manager",
            "another-organisation"
        );
        assert.equal(crossOrganizationApproval.status, 404);
        assert.equal(draft.status, "Pending Approval");

        const selfApproval = await send(
            "manager",
            `/api/drafts/${draft._id}/approve`,
            "POST",
            {},
            "creator-id"
        );
        assert.equal(selfApproval.status, 403);
        assert.equal(draft.status, "Pending Approval");

        draft.status = "Draft";
        const staleApproval = await send(
            "manager",
            `/api/drafts/${draft._id}/approve`,
            "POST",
            {},
            "manager-id"
        );
        assert.equal(staleApproval.status, 400);
        draft.status = "Pending Approval";

        const creatorCannotReadSubmitted = await send("creator", `/api/drafts/${draft._id}`, "GET", undefined, "creator-id");
        assert.equal(creatorCannotReadSubmitted.status, 200);

        const reviewerCanComment = await send("manager", `/api/drafts/${draft._id}/comments`, "POST", {
            comment: "Please clarify the evidence."
        }, "manager-id");
        assert.equal(reviewerCanComment.status, 201);

        const changesWithoutComment = await send(
            "manager",
            `/api/drafts/${draft._id}/request-changes`,
            "POST",
            {},
            "manager-id"
        );
        assert.equal(changesWithoutComment.status, 400);
        assert.equal(draft.status, "Pending Approval");

        const reviewerRequestsChanges = await send("manager", `/api/drafts/${draft._id}/request-changes`, "POST", {
            comment: "Please clarify the evidence."
        }, "manager-id");
        assert.equal(reviewerRequestsChanges.status, 200);
        assert.equal(draft.status, "Needs Changes");
        assert.equal(draft.reviewedBy, "manager-id");
        assert.ok(draft.reviewedAt instanceof Date);
        assert.equal(draft.reviewComment, "Please clarify the evidence.");
        const changesRequestedQueue = await send("manager", "/api/drafts", "GET", undefined, "manager-id");
        const changesRequestedBody = await changesRequestedQueue.json();
        assert.equal(changesRequestedBody.drafts.length, 1);
        assert.equal(changesRequestedBody.drafts[0].status, "Needs Changes");

        const creatorEditsReturnedDraft = await send("creator", `/api/drafts/${draft._id}`, "PUT", {
            title: "Launch announcement",
            content: "Revised content",
            channel: "Website"
        }, "creator-id");
        assert.equal(creatorEditsReturnedDraft.status, 200);
        assert.equal(draft.status, "Draft");

        const rescanned = await send("creator", `/api/drafts/${draft._id}/scan`, "POST", {}, "creator-id");
        assert.equal(rescanned.status, 200);
        const disputed = await send("creator", "/api/findings/0", "PATCH", {
            draftId: draft._id,
            status: "Disputed",
            reason: "Please validate the supporting evidence."
        }, "creator-id");
        assert.equal(disputed.status, 200);
        const rejected = await send("creator", "/api/findings/0", "PATCH", {
            draftId: draft._id,
            status: "Rejected"
        }, "creator-id");
        assert.equal(rejected.status, 200);
        const resolved = await send("creator", "/api/findings/0", "PATCH", {
            draftId: draft._id,
            status: "Accepted"
        }, "creator-id");
        assert.equal(resolved.status, 200);
        const resubmitted = await send("creator", `/api/drafts/${draft._id}/submit`, "POST", {}, "creator-id");
        assert.equal(resubmitted.status, 200);
        assert.equal(draft.reviewedBy, null);
        assert.equal(draft.reviewedAt, null);
        assert.equal(draft.reviewComment, "");

        const reviewerCannotEdit = await send("reviewer", `/api/drafts/${draft._id}`, "PUT", {
            title: "Changed by reviewer",
            content: "Not allowed",
            channel: "Website"
        }, "reviewer-id");
        assert.equal(reviewerCannotEdit.status, 403);

        const approved = await send("manager", `/api/drafts/${draft._id}/approve`, "POST", {
            comment: "Approved."
        }, "manager-id");
        assert.equal(approved.status, 200);
        assert.equal(draft.status, "Approved");
        assert.equal(draft.reviewedBy, "manager-id");
        assert.ok(draft.reviewedAt instanceof Date);
        assert.equal(draft.reviewComment, "Approved.");
        const managerQueueAfterApproval = await send("manager", "/api/drafts", "GET", undefined, "manager-id");
        const approvedQueueBody = await managerQueueAfterApproval.json();
        assert.equal(approvedQueueBody.drafts.length, 1);
        assert.equal(approvedQueueBody.drafts[0].status, "Approved");
        assert.equal(
            approvedQueueBody.drafts.filter(item => item.status === "Pending Approval").length,
            0
        );
        const duplicateApproval = await send("manager", `/api/drafts/${draft._id}/approve`, "POST", {}, "manager-id");
        assert.equal(duplicateApproval.status, 400);

        const creatorDrafts = await send("creator", "/api/drafts", "GET", undefined, "creator-id");
        const creatorDraftList = await creatorDrafts.json();
        assert.equal(creatorDraftList.drafts.length, 1);
        assert.equal(creatorDraftList.drafts[0].status, "Approved");

        const creatorHistory = await send("creator", `/api/drafts/${draft._id}`, "GET", undefined, "creator-id");
        const creatorHistoryBody = await creatorHistory.json();
        assert.equal(creatorHistoryBody.draft.status, "Approved");
        assert.equal(creatorHistoryBody.draft.reviewedBy, "manager-id");
        assert.ok(creatorHistoryBody.draft.reviewedAt);
        assert.equal(creatorHistoryBody.draft.reviewComment, "Approved.");
        assert.equal(creatorHistoryBody.draft.reviewHistory.some(event => event.action === "Approved"), true);
        assert.equal(creatorHistoryBody.draft.reviewHistory.some(event => event.comment === "Approved."), true);
        assert.equal(creatorHistoryBody.draft.reviewHistory.some(event => event.user === "manager-id"), true);
    });

    assert.deepEqual(events.map(event => event.action), [
        "Created",
        "Updated",
        "Scan Completed",
        "Finding Accepted",
        "Submitted",
        "Commented",
        "Changes Requested",
        "Updated",
        "Scan Completed",
        "Finding Disputed",
        "Finding Rejected",
        "Finding Accepted",
        "Submitted",
        "Approved"
    ]);
});

test("failed review audit persistence rolls the draft status back", async () => {
    const previousReviewedAt = new Date("2026-01-01T00:00:00.000Z");
    const draft = {
        _id: "64f000000000000000000007",
        author: "creator-id",
        organisationId: "test-organisation",
        status: "Pending Approval",
        reviewedBy: "prior-reviewer",
        reviewedAt: previousReviewedAt,
        reviewComment: "Previous decision"
    };
    let updateCount = 0;

    await withStubs([
        [Draft, {
            findOne: () => ({
                then(resolve, reject) { return Promise.resolve(draft).then(resolve, reject); }
            }),
            findOneAndUpdate: async (query, update) => {
                updateCount += 1;
                if (query.status !== draft.status) return null;
                if (query.reviewedBy && String(query.reviewedBy) !== String(draft.reviewedBy)) return null;
                if (query.reviewedAt && query.reviewedAt !== draft.reviewedAt) return null;
                if (query.reviewComment !== undefined && query.reviewComment !== draft.reviewComment) return null;
                Object.assign(draft, update.$set || {});
                for (const field of Object.keys(update.$unset || {})) delete draft[field];
                return draft;
            }
        }],
        [AuditLog, {
            create: async () => { throw new Error("audit store unavailable"); }
        }]
    ], async () => {
        const response = await fetch(`${baseUrl}/api/drafts/${draft._id}/approve`, {
            method: "POST",
            headers: {
                Authorization: ["Bearer", tokenForRole("manager", "manager-id")].join(" "),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ comment: "Approved." })
        });
        const body = await response.json();

        assert.equal(response.status, 503, JSON.stringify(body));
        assert.equal(body.success, false);
        assert.match(body.message, /audit history could not be recorded/);
        assert.equal(draft.status, "Pending Approval");
        assert.equal(draft.reviewedBy, "prior-reviewer");
        assert.equal(draft.reviewedAt, previousReviewedAt);
        assert.equal(draft.reviewComment, "Previous decision");
    });

    assert.equal(updateCount, 2);
});

test("failed audit rollback does not overwrite a newer concurrent review", async () => {
    const draft = {
        _id: "64f000000000000000000008",
        author: "creator-id",
        organisationId: "test-organisation",
        status: "Pending Approval"
    };
    let updateCount = 0;

    await withStubs([
        [Draft, {
            findOne: () => ({
                then(resolve, reject) { return Promise.resolve(draft).then(resolve, reject); }
            }),
            findOneAndUpdate: async (query, update) => {
                updateCount += 1;
                if (query.status !== draft.status) return null;
                if (query.reviewedBy && String(query.reviewedBy) !== String(draft.reviewedBy)) return null;
                if (query.reviewedAt && query.reviewedAt !== draft.reviewedAt) return null;
                if (query.reviewComment !== undefined && query.reviewComment !== draft.reviewComment) return null;
                Object.assign(draft, update.$set || {});
                for (const field of Object.keys(update.$unset || {})) delete draft[field];
                return draft;
            }
        }],
        [AuditLog, {
            create: async () => {
                draft.reviewedBy = "newer-reviewer";
                draft.reviewedAt = new Date("2026-10-25T00:00:00.000Z");
                draft.reviewComment = "Newer review";
                throw new Error("audit store unavailable");
            }
        }]
    ], async () => {
        const response = await fetch(`${baseUrl}/api/drafts/${draft._id}/approve`, {
            method: "POST",
            headers: {
                Authorization: ["Bearer", tokenForRole("manager", "manager-id")].join(" "),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ comment: "Approved." })
        });
        const body = await response.json();

        assert.equal(response.status, 500);
        assert.equal(body.success, false);
        assert.match(body.message, /Reload the draft to verify its status/);
        assert.equal(draft.status, "Approved");
        assert.equal(draft.reviewedBy, "newer-reviewer");
        assert.equal(draft.reviewComment, "Newer review");
    });

    assert.equal(updateCount, 2);
});

test("failed scans remain failures and are recorded without persisting fake results", async () => {
    const scanDraft = {
        _id: "64f000000000000000000005",
        author: "creator-id",
        organisationId: "test-organisation",
        title: "A real draft",
        content: "Content to review",
        status: "Draft",
        findings: [],
        async save() { throw new Error("A failed scan must not save results"); }
    };
    const events = [];
    await withStubs([
        [Draft, {
            findOne: () => ({
                then(resolve, reject) { return Promise.resolve(scanDraft).then(resolve, reject); }
            })
        }],
        [AuditLog, {
            create: async payload => { events.push(payload); return payload; }
        }],
        [Fact, {
            find: () => ({
                select() { return this; },
                async lean() { return []; }
            })
        }],
        [RulebookEntry, {
            find: () => ({
                select() { return this; },
                async lean() { return []; }
            })
        }],
        [geminiService, {
            scanContent: async () => { throw new Error("AI provider unavailable"); }
        }]
    ], async () => {
        const response = await fetch(`${baseUrl}/api/drafts/${scanDraft._id}/scan`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenForRole("creator", "creator-id")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });

        assert.equal(response.status, 500);
        assert.equal((await response.json()).message, "Unable to scan content. Check the Gemini API configuration.");
        assert.equal(scanDraft.findings.length, 0);
    });
    assert.deepEqual(events.map(event => event.action), ["Scan Failed"]);
});

test("scan loads scoped active facts and rules, persists partial status, and refuses partial submissions", async () => {
    const draft = {
        _id: "64f000000000000000000006",
        author: "creator-id",
        organisationId: "test-organisation",
        title: "Scoped scan",
        content: "Test content",
        status: "Draft",
        findings: [],
        scannedAt: null,
        async save() { return this; }
    };
    let factQuery;
    let ruleQuery;
    let scanContext;
    const auditEvents = [];
    await withStubs([
        [Draft, {
            findOne: () => ({
                then(resolve, reject) { return Promise.resolve(draft).then(resolve, reject); }
            })
        }],
        [Fact, {
            find: query => {
                factQuery = query;
                return {
                    select() { return this; },
                    async lean() { return [{ _id: "scoped-fact", title: "Approved fact", organisationId: "test-organisation" }]; }
                };
            }
        }],
        [RulebookEntry, {
            find: query => {
                ruleQuery = query;
                return {
                    select() { return this; },
                    async lean() { return [{ _id: "scoped-rule", title: "Guideline", description: "Must not contain: prohibited", organisationId: "test-organisation" }]; }
                };
            }
        }],
        [AuditLog, {
            create: async payload => { auditEvents.push(payload); return payload; }
        }],
        [geminiService, {
            scanContent: async (content, title, context) => {
                scanContext = context;
                return {
                    findings: [],
                    summary: { total: 0 },
                    scanStatus: "partial",
                    warning: "Provider unavailable; deterministic checks only."
                };
            }
        }]
    ], async () => {
        const response = await fetch(`${baseUrl}/api/drafts/${draft._id}/scan`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenForRole("creator", "creator-id")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });
        const result = await response.json();
        assert.equal(response.status, 200, JSON.stringify(result));
        assert.equal(result.scanStatus, "partial");
        assert.match(result.warning, /Provider unavailable/);
        assert.equal(draft.scanStatus, "partial");
        assert.equal(String(factQuery.organisationId), "test-organisation");
        assert.deepEqual(factQuery.status.$in, ["Active", "Valid"]);
        assert.equal(String(ruleQuery.organisationId), "test-organisation");
        assert.equal(ruleQuery.status, "Active");
        assert.equal(scanContext.facts[0].title, "Approved fact");
        assert.equal(scanContext.rules[0].title, "Guideline");

        const submit = await fetch(`${baseUrl}/api/drafts/${draft._id}/submit`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenForRole("creator", "creator-id")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });
        assert.equal(submit.status, 400);
        assert.match((await submit.json()).message, /complete AI scan/);
    });
    assert.deepEqual(auditEvents.map(event => event.action), ["Scan Partial"]);
});

test("draft actions require a valid token and the correct role", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/drafts`, { method: "POST" });
    assert.equal(unauthenticated.status, 401);

    const wrongRole = await fetch(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokenForRole("reviewer")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: "Test" })
    });
    assert.equal(wrongRole.status, 403);
});

test("organization creation requires an authenticated administrator", async () => {
    const unauthorized = await fetch(`${baseUrl}/api/organisations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Not created" })
    });
    assert.equal(unauthorized.status, 401);

    const creatorAttempt = await fetch(`${baseUrl}/api/organisations`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokenForRole("creator")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Not created" })
    });
    assert.equal(creatorAttempt.status, 403);
});

test("authentication endpoints reject malformed credentials and registrations", async () => {
    const missingLoginFields = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", password: "" })
    });
    assert.equal(missingLoginFields.status, 400);

    const invalidRegistration = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "",
            email: "not-an-email",
            password: "short",
            organisationId: "invalid"
        })
    });
    assert.equal(invalidRegistration.status, 400);

    const missingSession = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(missingSession.status, 401);
});

test("malformed JSON produces a safe JSON error", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{"
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("content-type").split(";")[0], "application/json");
    assert.equal((await response.json()).message, "Request body contains invalid JSON");
});

test("Gemini scan responses reject empty, malformed, and fabricated findings", () => {
    const valid = JSON.stringify({
        findings: [{
            type: "Unsupported claim",
            quote: "Verified text",
            explanation: "Evidence is required.",
            severity: "Medium"
        }]
    });
    assert.equal(geminiService.parseGeminiResponse(valid, "Verified text").findings.length, 1);
    assert.throws(() => geminiService.parseGeminiResponse("", "Verified text"), /empty response/);
    assert.throws(() => geminiService.parseGeminiResponse("{", "Verified text"), /invalid JSON/);
    assert.throws(() => geminiService.parseGeminiResponse('{"findings":{}}', "Verified text"), /findings format/);
    assert.throws(() => geminiService.parseGeminiResponse(JSON.stringify({
        findings: [{
            type: "Unsupported claim",
            quote: "Not in the content",
            explanation: "Evidence is required.",
            severity: "Medium"
        }]
    }), "Verified text"), /invalid finding data/);
});

test("Gemini scan configures its request timeout and rejects malformed provider JSON", async () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only-key";
    let configuredTimeout;
    try {
        const result = await geminiService.scanContent("Synthetic content for timeout validation", "Test", (apiKey, timeoutMs) => {
                assert.equal(apiKey, "test-only-key");
                configuredTimeout = timeoutMs;
                return {
                    models: {
                        generateContent: async () => ({ text: "{" })
                    }
                };
            });
        assert.equal(configuredTimeout, 30000);
        assert.equal(result.scanStatus, "partial");
        assert.match(result.warning, /unusable results/);
    } finally {
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});

test("Gemini provider failures remain explicit and do not become clean scan results", async () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only-key";
    let requestCount = 0;
    try {
        const result = await geminiService.scanContent("Synthetic content for provider failure validation", "Test", () => ({
                models: {
                    generateContent: async () => {
                        requestCount += 1;
                        throw Object.assign(new Error("Synthetic provider failure"), { status: 400 });
                    }
                }
            }));
        assert.equal(requestCount, 1);
        assert.equal(result.scanStatus, "partial");
        assert.match(result.warning, /Gemini request failed/);
    } finally {
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});

test("direct frontend routes return the built app and missing assets do not", async () => {
    const route = await fetch(`${baseUrl}/login`, {
        headers: { Accept: "text/html" }
    });
    assert.equal(route.status, 200);
    assert.match(await route.text(), /<div id="root"><\/div>/);

    const missingAsset = await fetch(`${baseUrl}/missing-bundle.js`);
    assert.equal(missingAsset.status, 404);
    assert.doesNotMatch(missingAsset.headers.get("content-type") || "", /text\/html/);
});
