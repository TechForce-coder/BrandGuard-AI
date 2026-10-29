require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const {
    deterministicFindings,
    normalizeScanContext
} = require("./scanPolicy");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_REQUEST_TIMEOUT_MS = 30000;

const createGeminiClient = (apiKey, timeoutMs) => new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: timeoutMs }
});

function parseGeminiResponse(
    responseText,
    content,
    context = { facts: [], rules: [] }
) {
    if (!responseText) {
        throw new Error("Gemini returned an empty response");
    }

    let result;
    try {
        result = JSON.parse(responseText);
    } catch {
        throw new Error("Gemini returned invalid JSON");
    }

    if (!result || !Array.isArray(result.findings)) {
        throw new Error("Gemini response has an invalid findings format");
    }

    const suggestedContent = (
        typeof result.suggestedContent === "string" && result.suggestedContent.trim()
    ) ? result.suggestedContent.trim() : (content || "");

    const validSeverities = new Set(["Low", "Medium", "High"]);
    const validFactIds = new Set(context.facts.map((fact) => String(fact.id)));
    const validRuleIds = new Set(context.rules.map((rule) => String(rule.id)));

    const validFindings = result.findings.every((finding) =>
        finding &&
        typeof finding === "object" &&
        !Array.isArray(finding) &&
        typeof finding.type === "string" &&
        Boolean(finding.type.trim()) &&
        typeof finding.quote === "string" &&
        Boolean(finding.quote.trim()) &&
        content.includes(finding.quote) &&
        typeof finding.explanation === "string" &&
        Boolean(finding.explanation.trim()) &&
        (
            finding.suggestion === undefined ||
            typeof finding.suggestion === "string"
        ) &&
        (finding.severity === undefined || validSeverities.has(finding.severity)) &&
        (finding.source === undefined || finding.source === "ai") &&
        (
            finding.factId === undefined ||
            validFactIds.has(String(finding.factId))
        ) &&
        (
            finding.ruleId === undefined ||
            validRuleIds.has(String(finding.ruleId))
        )
    );

    if (!validFindings) {
        throw new Error("Gemini response contains invalid finding data");
    }

    return {
        findings: result.findings.map((finding) => ({
            ...finding,
            source: "ai",
            ...(finding.factId ? { factId: String(finding.factId) } : {}),
            ...(finding.ruleId ? { ruleId: String(finding.ruleId) } : {})
        })),
        suggestedContent,
        summary: { total: result.findings.length }
    };
}

async function scanContent(
    content,
    title = "",
    contextInput = {},
    clientFactory = createGeminiClient
) {
    if (typeof contextInput === "function") {
        clientFactory = contextInput;
        contextInput = {};
    }

    if (typeof content !== "string" || !content.trim()) {
        throw new Error("Draft content is empty");
    }

    const context = normalizeScanContext(contextInput);
    const fallbackFindings = deterministicFindings(content, context);

    const partialResult = (warning) => ({
        findings: fallbackFindings,
        summary: { total: fallbackFindings.length },
        suggestedContent: "",
        scanStatus: "partial",
        warning
    });

    if (!process.env.GEMINI_API_KEY) {
        return partialResult(
            "AI scanning is unavailable because the provider key is not configured. Only supported deterministic checks ran."
        );
    }

    const ai = clientFactory(
        process.env.GEMINI_API_KEY,
        GEMINI_REQUEST_TIMEOUT_MS
    );

    const prompt = `
You are a brand governance assistant.

Review the draft title and content against the organization's approved facts and active guidelines:
${JSON.stringify(context)}

Draft title:
${title || "(No title provided)"}

Original content:
${content}

Return ONLY valid JSON matching this format:
{
  "findings": [
    {
      "type": "Issue type",
      "quote": "Exact text from original content",
      "explanation": "Why this may be an issue",
      "suggestion": "How to improve this quoted text",
      "severity": "Low"
    }
  ],
  "summary": { "total": 0 },
  "suggestedContent": "Full revised content"
}
`;

    const models = [
        process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
        process.env.GEMINI_FALLBACK_MODEL,
        "gemini-3.8-flash",
        "gemini-2.5-flash"
    ].filter(Boolean);

    let response;
    let nonTransientWarning = null;

    for (const model of [...new Set(models)]) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json"
                    }
                });
                break;
            } catch (error) {
                const status = Number(error.status || error.code || error.error?.code);
                const temporary = status === 429 || status === 503 || status >= 500;

                if (!temporary) {
                    const reason = status === 404
                        ? `Gemini model ${model} was not found. Check your model configuration.`
                        : "Gemini request failed. Check your API configuration.";

                    nonTransientWarning = `${reason} Only supported deterministic checks ran.`;
                    break;
                }

                if (attempt === 0) {
                    await sleep(2000);
                }
            }
        }

        if (response || nonTransientWarning) break;
    }

    if (nonTransientWarning) {
        return partialResult(nonTransientWarning);
    }

    if (!response) {
        return partialResult(
            "AI scanning is temporarily unavailable after retries. Only supported deterministic checks ran."
        );
    }

    try {
        const parsed = parseGeminiResponse(
            response.text,
            content,
            context
        );

        const knownDeterministicFindings = new Set(
            fallbackFindings.map((finding) =>
                `${finding.type.toLocaleLowerCase()}:${finding.quote.toLocaleLowerCase()}`
            )
        );

        const aiFindings = parsed.findings.filter((finding) =>
            !knownDeterministicFindings.has(
                `${finding.type.toLocaleLowerCase()}:${finding.quote.toLocaleLowerCase()}`
            )
        );

        return {
            ...parsed,
            findings: [...fallbackFindings, ...aiFindings],
            summary: {
                total: fallbackFindings.length + aiFindings.length
            },
            scanStatus: "complete",
            warning: ""
        };
    } catch (error) {
        return partialResult(
            `AI scanning returned unusable results: ${error.message}. Only supported deterministic checks ran.`
        );
    }
}

module.exports = {
    scanContent,
    parseGeminiResponse
};