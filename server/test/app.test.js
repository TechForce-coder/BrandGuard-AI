const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "brandguard-test-signing-key";
const app = require("../app");

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (!server) return;
    server.close();
    await once(server, "close");
});

const tokenForRole = (role) => jwt.sign({
    userId: "test-user",
    organisationId: "test-organisation",
    role
}, process.env.JWT_SECRET);

test("health endpoint responds with JSON", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type").split(";")[0], "application/json");
    assert.equal((await response.json()).success, true);
});

test("unknown API routes return JSON 404 instead of the SPA", async () => {
    const response = await fetch(`${baseUrl}/api/not-implemented`, {
        headers: { Accept: "text/html" }
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type").split(";")[0], "application/json");
    assert.equal((await response.json()).message, "API endpoint not found");
});

test("unsupported rulebook and facts endpoints fail explicitly", async () => {
    for (const endpoint of ["rulebook", "facts"]) {
        const response = await fetch(`${baseUrl}/api/${endpoint}`, {
            headers: { Accept: "application/json" }
        });
        assert.equal(response.status, 404, `${endpoint} should not claim to be implemented`);
        assert.equal(response.headers.get("content-type").split(";")[0], "application/json");
    }
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
