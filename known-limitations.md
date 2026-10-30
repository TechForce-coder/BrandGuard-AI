# Known limitations

Update this file when a fix is merged.

## Product

| Area | Limitation |
|---|---|
| Expired facts | Expired facts are left out of the scan, so a claim based on an expired fact is not flagged. Planned fix: include Expired facts in the scan query and tell Gemini to flag them (`draftController.js` lines 506-516, plus one line in the Gemini prompt) |
| Citations | A finding may name a rule or fact but is not required to. If a cited ID is wrong, the whole AI result is discarded and the scan becomes partial |
| Retrieval | There is no retrieval step or embeddings. All active rules and facts go into every prompt, so very large rulebooks will not fit |
| Plain-code rule checks | Only rules written as `must not contain: ...` or `must include: ...` are checked in plain code. Other rules rely on Gemini |
| Gemini outage | A fallback scan (plain-code only) cannot be submitted. If Gemini is unavailable, creators are blocked from submitting |
| Image checks | Alt-text rules plus a general Gemini review. No colour palette matching and no logo comparison. Results are advice, not verified |
| Governance insights | The dashboard shows approval status counts and recent activity. It does not rank recurring mistakes or detect unclear rules |
| Editor | A plain text area. Findings are shown in a side panel, not highlighted in the text |
| Roles | Reviewer cannot open drafts or comment. Admin can reach the approve route but the controller allows managers only |
| Rulebook input | Entered one entry at a time. No PDF or text upload, no Terms page |
| Registration | Anyone with the organisation ID can register as a creator |
| Accuracy | The model can miss issues or misjudge tone. Findings are suggestions for a person to decide |
| Scope | Text drafts only. No DOCX, PDF, video or audio. No publishing integration |

## Engineering

| Area | Limitation |
|---|---|
| Rate limiting | None on login or scan |
| CORS | Open to all origins |
| Free-tier hosting | The Render backend may sleep and take a while to wake on the first request |
| Gemini quota | Heavy use can hit the free quota; the product then falls back to plain-code checks |
| Test coverage | Server tests use stubs; there is no automated end-to-end test against a live database |

Security fixes that must be done before judging (open endpoints, upload limits) are tracked in `docs/bug-log.md`, not here.
