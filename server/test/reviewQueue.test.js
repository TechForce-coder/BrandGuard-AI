const assert = require("node:assert/strict");
const { test } = require("node:test");

test("review queue exposes actions only for authorized pending drafts", async () => {
    const { getReviewQueueActions } = await import("../../client/src/utils/reviewQueueWorkflow.js");
    const pendingDraft = { id: "draft-1", status: "Pending Approval" };

    assert.deepEqual(
        getReviewQueueActions("Manager", pendingDraft).map(action => action.label),
        ["Approve", "Request Changes"]
    );
    assert.deepEqual(
        getReviewQueueActions("Admin", pendingDraft).map(action => action.action),
        ["approve", "request-changes"]
    );
    assert.deepEqual(getReviewQueueActions("Creator", pendingDraft), []);
    assert.deepEqual(getReviewQueueActions("Manager", { ...pendingDraft, status: "Approved" }), []);
    assert.deepEqual(getReviewQueueActions("Manager", { status: "Pending Approval" }), []);
});

test("review queue action calls the matching API with the draft id and requires a changes comment", async () => {
    const { submitReviewQueueAction } = await import("../../client/src/utils/reviewQueueWorkflow.js");
    const calls = [];
    const api = {
        async reviewDraft(...args) {
            calls.push(args);
            return { success: true };
        }
    };
    const draft = { id: "draft-2", status: "Pending Approval", title: "Campaign" };

    await submitReviewQueueAction(api, "Manager", draft, "approve");
    await assert.rejects(
        submitReviewQueueAction(api, "Manager", draft, "request-changes", "  "),
        /comment explaining the requested changes/
    );
    await submitReviewQueueAction(api, "Manager", draft, "request-changes", " Clarify the claim. ");
    await assert.rejects(
        submitReviewQueueAction(api, "Creator", draft, "approve"),
        /do not have permission/
    );
    await assert.rejects(
        submitReviewQueueAction(api, "Manager", { ...draft, status: "Approved" }, "approve"),
        /no longer pending/
    );

    assert.deepEqual(calls, [
        ["draft-2", "approve", ""],
        ["draft-2", "request-changes", "Clarify the claim."]
    ]);
});