const positiveClaimStopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
    "does", "do", "for", "from", "has", "have", "is", "it", "its", "of",
    "on", "or", "our", "the", "this", "to", "we", "with"
]);

const negativeWords = new Set([
    "cannot", "doesnt", "isnt", "never", "no", "not", "without"
]);

function normalizeEntries(entries) {
    return Array.isArray(entries) ? entries.map((entry) => ({
        id: String(entry._id || entry.id || ""),
        title: String(entry.title || ""),
        description: String(entry.description || ""),
        owner: String(entry.owner || ""),
        validUntil: entry.validUntil || null,
        status: String(entry.status || "")
    })).filter((entry) => entry.id) : [];
}

function extractSupportedRule(description) {
    const directives = [
        { type: "prohibited", pattern: /^(?:must not contain|prohibited phrase|forbidden phrase|avoid phrase)\s*:\s*(.+)$/i },
        { type: "required", pattern: /^(?:must include|required phrase)\s*:\s*(.+)$/i }
    ];

    for (const line of String(description || "").split(/\r?\n/)) {
        const directive = directives.find(({ pattern }) => pattern.test(line.trim()));
        if (!directive) continue;
        const phrase = line.trim().match(directive.pattern)?.[1]?.trim();
        if (phrase) return { ...directive, phrase };
    }
    return null;
}

function ruleFindings(content, rules) {
    const findings = [];
    const lowerContent = content.toLocaleLowerCase();

    for (const rule of normalizeEntries(rules)) {
        const directive = extractSupportedRule(rule.description);
        if (!directive) continue;
        const index = lowerContent.indexOf(directive.phrase.toLocaleLowerCase());
        const violated = directive.type === "prohibited" ? index >= 0 : index < 0;
        if (!violated) continue;

        findings.push({
            type: directive.type === "prohibited" ? "Prohibited phrase" : "Required phrase missing",
            quote: index >= 0
                ? content.slice(index, index + directive.phrase.length)
                : content.slice(0, Math.min(content.length, 120)),
            explanation: directive.type === "prohibited"
                ? `This text matches a phrase prohibited by the “${rule.title}” guideline.`
                : `The “${rule.title}” guideline requires the phrase “${directive.phrase}”.`,
            severity: directive.type === "prohibited" ? "High" : "Medium",
            source: "rule",
            ruleId: rule.id,
            status: "Open"
        });
    }

    return findings;
}

function factContradictions(content, facts) {
    const contentTokens = [...content.matchAll(/[a-z0-9']+/gi)].map((match) => ({
        value: match[0].toLocaleLowerCase().replace(/['’]/g, ""),
        start: match.index,
        end: match.index + match[0].length
    }));
    const findings = [];

    for (const fact of normalizeEntries(facts)) {
        const claim = fact.title.trim();
        const claimTokens = [...claim.matchAll(/[a-z0-9']+/gi)]
            .map((match) => match[0].toLocaleLowerCase().replace(/['’]/g, ""))
            .filter((token) => !positiveClaimStopWords.has(token));
        if (!claimTokens.length || claimTokens.some((token) => negativeWords.has(token))) continue;

        const matched = contentTokens.filter((token) => claimTokens.includes(token.value));
        const uniqueMatches = new Set(matched.map((token) => token.value));
        if (uniqueMatches.size !== claimTokens.length) continue;

        const firstMatch = matched[0];
        const lastMatch = matched[matched.length - 1];
        const span = contentTokens.filter((token) =>
            token.start >= firstMatch.start && token.end <= lastMatch.end
        );
        const contradiction = span.some((token) => negativeWords.has(token.value));
        if (!contradiction) continue;

        findings.push({
            type: "Approved fact contradiction",
            quote: content.slice(firstMatch.start, lastMatch.end),
            explanation: `This statement may contradict the approved fact “${fact.title}”.`,
            severity: "High",
            source: "fact",
            factId: fact.id,
            status: "Open"
        });
    }

    return findings;
}

function deterministicFindings(content, context = {}) {
    const findings = [
        ...ruleFindings(content, context.rules),
        ...factContradictions(content, context.facts)
    ];
    if (context.hasImage) {
        const altText = String(context.altText || "").trim();
        const genericAltText = new Set(["image", "photo", "picture", "img"]);
        let explanation = "";
        if (!altText) {
            explanation = "This post includes an image but has no alt-text.";
        } else if (altText.length < 5 || altText.length > 125) {
            explanation = `Alt-text must be between 5 and 125 characters (currently ${altText.length}).`;
        } else if (genericAltText.has(altText.toLocaleLowerCase())) {
            explanation = `"${altText}" does not describe the image.`;
        }
        if (explanation) {
            findings.push({
                type: "Accessibility",
                quote: altText || "(missing alt-text)",
                explanation,
                suggestion: "Describe the meaningful visual content of the image in 5 to 125 characters.",
                severity: "Medium",
                source: "rule",
                ruleId: "BG-11",
                status: "Open",
                field: "altText"
            });
        }
    }
    return findings;
}

function normalizeScanContext(context = {}) {
    return {
        facts: normalizeEntries(context.facts),
        rules: normalizeEntries(context.rules),
        hasImage: context.hasImage === true,
        altText: typeof context.altText === "string" ? context.altText : ""
    };
}

module.exports = {
    deterministicFindings,
    normalizeScanContext,
    normalizeEntries
};
