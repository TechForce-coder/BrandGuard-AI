const assert = require("node:assert/strict");
const { test } = require("node:test");

let getDraftEditorState;
let submitReviewComment;

test("DraftEditor restores scan findings and status from a loaded saved draft", async () => {
    ({ getDraftEditorState, submitReviewComment } = await import("../../client/src/utils/draftEditorWorkflow.js"));

    const finding = {
        type: "Unsupported claim",
        quote: "Guaranteed results",
        status: "Accepted"
    };
    const state = getDraftEditorState({
        _id: "draft-1",
        title: "Launch",
        channel: "Website",
        content: "Launch copy",
        findings: [finding],
        status: "Needs Changes",
        scannedAt: "2026-10-25T00:00:00.000Z"
    });

    assert.equal(state.id, "draft-1");
    assert.equal(state.status, "Needs Changes");
    assert.equal(state.scanned, true);
    assert.deepEqual(state.findings, [finding]);
});

test("DraftEditor keeps scan state and findings when save response omits optional scan fields", async () => {
    ({ getDraftEditorState } = await import("../../client/src/utils/draftEditorWorkflow.js"));

    const finding = { type: "Review item", status: "Rejected" };
    const state = getDraftEditorState(
        { _id: "draft-2", title: "Updated title" },
        {
            id: "draft-2",
            title: "Old title",
            content: "Draft content",
            channel: "Email",
            findings: [finding],
            status: "Draft",
            scanned: true
        }
    );

    assert.equal(state.id, "draft-2");
    assert.equal(state.title, "Updated title");
    assert.equal(state.content, "Draft content");
    assert.equal(state.channel, "Email");
    assert.equal(state.status, "Draft");
    assert.equal(state.scanned, true);
    assert.deepEqual(state.findings, [finding]);
});

test("DraftEditor clears scan state when a saved draft explicitly has no scan timestamp", async () => {
    ({ getDraftEditorState } = await import("../../client/src/utils/draftEditorWorkflow.js"));

    const state = getDraftEditorState(
        { scannedAt: null, findings: [], status: "Draft" },
        { scanned: true, findings: [{ type: "Old finding" }] }
    );

    assert.equal(state.scanned, false);
    assert.deepEqual(state.findings, []);
});

test("DraftEditor submits review comments to the draft comment API", async () => {
    ({ submitReviewComment } = await import("../../client/src/utils/draftEditorWorkflow.js"));

    const calls = [];
    const mockApi = {
        async addDraftComment(draftId, comment) {
            calls.push({ draftId, comment });
            return { success: true };
        }
    };

    await submitReviewComment(mockApi, "draft-3", "Please clarify this claim.");

    assert.deepEqual(calls, [{
        draftId: "draft-3",
        comment: "Please clarify this claim."
    }]);
});

test("DraftEditor rejects an empty review comment without calling the API", async () => {
    ({ submitReviewComment } = await import("../../client/src/utils/draftEditorWorkflow.js"));

    let called = false;
    await assert.rejects(
        submitReviewComment({
            async addDraftComment() {
                called = true;
            }
        }, "draft-4", "   "),
        /Enter a comment before recording it/
    );
    assert.equal(called, false);
});

test("review API posts to the action-specific endpoint and requires persisted status confirmation", async () => {
    const { api } = await import("../../client/src/api/api.js");
    const originalFetch = global.fetch;
    const originalLocalStorage = global.localStorage;
    const requests = [];
    global.localStorage = { getItem: () => null };
    global.fetch = async (url, options) => {
        requests.push({ url, options });
        const status = url.endsWith("/approve") ? "Approved" : "Needs Changes";
        return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, draft: { status } })
        };
    };

    try {
        await api.reviewDraft("draft/id", "approve", "Looks good.");
        await api.reviewDraft("draft/id", "request-changes", "Clarify the claim.");

        assert.deepEqual(requests.map(request => request.url), [
            "/api/drafts/draft%2Fid/approve",
            "/api/drafts/draft%2Fid/request-changes"
        ]);
        assert.deepEqual(requests.map(request => request.options.method), ["POST", "POST"]);
        assert.deepEqual(requests.map(request => JSON.parse(request.options.body)), [
            { comment: "Looks good." },
            { comment: "Clarify the claim." }
        ]);
        await assert.rejects(api.reviewDraft("draft/id", "delete"), /Invalid review action/);
    } finally {
        global.fetch = originalFetch;
        if (originalLocalStorage === undefined) {
            delete global.localStorage;
        } else {
            global.localStorage = originalLocalStorage;
        }
    }
});

test("review API does not report success when response status was not persisted", async () => {
    const { api } = await import("../../client/src/api/api.js");
    const originalFetch = global.fetch;
    const originalLocalStorage = global.localStorage;
    global.localStorage = { getItem: () => null };
    global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            draft: { status: "Pending Approval" }
        })
    });

    try {
        await assert.rejects(
            api.reviewDraft("draft-1", "approve"),
            /did not confirm the requested status/
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
