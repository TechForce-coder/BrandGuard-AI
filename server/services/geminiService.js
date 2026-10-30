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
    const validFactIds = new Set((context.facts || []).map((fact) => String(fact.id)));
    const validRuleIds = new Set((context.rules || []).map((rule) => String(rule.id)));

    const validFindings = result.findings.every((finding) => {
        if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
            return false;
        }

        // type and explanation are required non-empty strings
        if (typeof finding.type !== "string" || !finding.type.trim()) return false;
        if (typeof finding.explanation !== "string" || !finding.explanation.trim()) return false;

        // quote must be a non-empty string and present in content
        if (typeof finding.quote !== "string" || !finding.quote.trim()) return false;
        if (!content.includes(finding.quote)) return false;

        // suggestion is optional, but if present and non-null must be a string
        if (
            finding.suggestion !== undefined &&
            finding.suggestion !== null &&
            typeof finding.suggestion !== "string"
        ) {
            return false;
        }

        // severity is optional, but if present must be one of Low, Medium, High
        if (
            finding.severity !== undefined &&
            finding.severity !== null &&
            !validSeverities.has(finding.severity)
        ) {
            return false;
        }

        // source is optional, but if present must be 'ai'
        if (
            finding.source !== undefined &&
            finding.source !== null &&
            finding.source !== "ai"
        ) {
            return false;
        }

        // factId is optional; if present and not null, must match a known fact
        if (
            finding.factId !== undefined &&
            finding.factId !== null &&
            !validFactIds.has(String(finding.factId))
        ) {
            return false;
        }

        // ruleId is optional; if present and not null, must match a known rule
        if (
            finding.ruleId !== undefined &&
            finding.ruleId !== null &&
            !validRuleIds.has(String(finding.ruleId))
        ) {
            return false;
        }

        return true;
    });

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

CRITICAL RULES FOR FINDINGS:
1. Every "quote" MUST be copied verbatim from the Original content body only. Do NOT quote from the Draft title.
2. If "severity" is provided, it MUST be capitalized as: "Low", "Medium", or "High".
3. Do NOT include "ruleId" or "factId" keys unless they exactly match an id from the context above.
4. If the draft complies or has no issues, return "findings": [].

Return ONLY valid JSON matching this format:
{
  "findings": [
    {
      "type": "Issue type",
      "quote": "Exact text from original content",
      "explanation": "Why this is an issue",
      "suggestion": "How to improve this quoted text",
      "severity": "Medium"
    }
  ],
  "summary": { "total": 0 },
  "suggestedContent": "Full revised content"
}
`;

    const models = [
        process.env.GEMINI_MODEL || "gemini-2.5-flash",
        process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.5-flash-lite"
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
                    await sleep(2500);
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