const assert = require("node:assert/strict");
const { test } = require("node:test");
const { deterministicFindings, normalizeScanContext } = require("../services/scanPolicy");
const { parseGeminiResponse, scanContent } = require("../services/geminiService");

test("supported required and prohibited phrase rules produce identified deterministic findings", () => {
    const context = {
        facts: [],
        rules: [
            { id: "rule-prohibit", title: "Claims", description: "Must not contain: guaranteed results" },
            { id: "rule-required", title: "Footer", description: "Required phrase: terms apply" }
        ]
    };

    const findings = deterministicFindings("We provide guaranteed results to every customer.", context);
    assert.equal(findings.length, 2);
    assert.equal(findings[0].source, "rule");
    assert.equal(findings[0].ruleId, "rule-prohibit");
    assert.equal(findings[1].type, "Required phrase missing");
    assert.equal(findings[1].ruleId, "rule-required");
});

test("direct negation of an approved fact is flagged and other-organization context is not implicitly used", () => {
    const approved = { id: "fact-approved", title: "Product guaranteed for 12 months" };
    const findings = deterministicFindings(
        "This product is not guaranteed for 12 months.",
        { facts: [approved], rules: [] }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].source, "fact");
    assert.equal(findings[0].factId, "fact-approved");
    assert.match(findings[0].quote, /is not/);

    assert.deepEqual(deterministicFindings(
        "This product is not guaranteed for 12 months.",
        normalizeScanContext({ facts: [], rules: [] })
    ), []);
});

test("provider prompt receives structured fact and rule context and rejects unknown citations", async () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only-key";
    const context = {
        facts: [{ id: "fact-1", title: "Approved claim", owner: "Legal" }],
        rules: [{ id: "rule-1", title: "Required footer", description: "Required phrase: terms apply" }]
    };
    let prompt;

    try {
        const result = await scanContent("Approved claim; terms apply.", "Test", context, () => ({
            models: {
                generateContent: async (request) => {
                    prompt = request.contents;
                    return { text: JSON.stringify({ findings: [], summary: { total: 0 } }) };
                }
            }
        }));

        assert.equal(result.scanStatus, "complete");
        assert.match(prompt, /fact-1/);
        assert.match(prompt, /rule-1/);
        assert.throws(() => parseGeminiResponse(JSON.stringify({
            findings: [{
                type: "Fact issue",
                quote: "Approved claim",
                explanation: "Contradicts the fact.",
                severity: "High",
                factId: "another-organization-fact"
            }]
        }), "Approved claim", normalizeScanContext(context)), /invalid finding data/);
    } finally {
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});

test("provider failure returns explicit partial results with deterministic findings", async () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only-key";
    try {
        const result = await scanContent(
            "Never use guaranteed results.",
            "Test",
            { rules: [{ id: "rule-1", title: "Claims", description: "Prohibited phrase: guaranteed results" }] },
            () => ({
                models: {
                    generateContent: async () => {
                        throw Object.assign(new Error("provider unavailable"), { status: 400 });
                    }
                }
            })
        );
        assert.equal(result.scanStatus, "partial");
        assert.match(result.warning, /only supported deterministic checks ran/i);
        assert.equal(result.findings[0].ruleId, "rule-1");
    } finally {
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});

test("provider timeout is reported as partial rather than a clean scan", async () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only-key";
    try {
        const result = await scanContent("Nothing matches.", "Test", {
            rules: [{ id: "rule-1", title: "Claim restriction", description: "Prohibited phrase: guaranteed result" }]
        }, () => ({
            models: {
                generateContent: async () => {
                    throw Object.assign(new Error("request timed out"), { code: "ETIMEDOUT" });
                }
            }
        }));
        assert.equal(result.scanStatus, "partial");
        assert.match(result.warning, /AI scanning is temporarily unavailable|Gemini request failed/i);
    } finally {
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});

test("missing provider configuration still reports deterministic-only scans as partial", async () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
        const result = await scanContent("This copy says guaranteed results.", "Test", {
            rules: [{ id: "rule-1", title: "Claims", description: "Prohibited phrase: guaranteed results" }]
        });
        assert.equal(result.scanStatus, "partial");
        assert.match(result.warning, /provider key is not configured/i);
        assert.equal(result.findings[0].ruleId, "rule-1");
    } finally {
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});
