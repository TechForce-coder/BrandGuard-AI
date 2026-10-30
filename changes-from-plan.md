# Changes from the Round 1 plan

| Area | Round 1 plan | What was built | Why / note |
|---|---|---|---|
| Rulebook input | Upload PDF or text, split into passages, store embeddings | Rules are entered one at a time (title, description, status) | Simpler and reliable in the time available. **TO CONFIRM with Om: reason** |
| Retrieval | Atlas Vector Search, retrieve relevant passages per draft | No retrieval. All active rules and facts are sent in each prompt | Works for small rulebooks. Vector search moved to the roadmap |
| Editor | TipTap with inline highlights | Plain text area with a findings panel | Findings carry the exact quoted text; inline highlighting not built |
| Citation validator | Separate validator that drops findings with bad citations | A check inside `geminiService.parseGeminiResponse`: quote must appear in the draft, rule or fact ID (if given) must exist | Not a separate layer. Citation is optional; an invalid ID discards the whole AI result |
| Versions | Immutable numbered versions | Draft keeps a `revisions` list of earlier content plus the original text | Diff viewer compares original and current |
| Database | Documents, versions and vectors | 7 collections: User, Organisation, Draft (findings embedded), RulebookEntry, Fact, AuditLog, Scan | |
| Rules-only fallback | Planned for outages | Plain-code findings are returned with a warning, but cannot be submitted | Policy: a complete scan is required |
| Terms (banned and preferred words) | Terms editor | Not built; rules support `must not contain` phrases | |
| Roles | Creator, reviewer, manager, admin | All four exist. Reviewer has audit access only; admin cannot approve | Reviewer role is incomplete |
| Image checks (Round 3) | Alt-text, palette, logo matching | Alt-text rules and a general Gemini review of uploaded images | Palette and logo matching on the roadmap |
| Governance insights (Round 3) | Recurring mistakes dashboard and guideline-gap detector | Approval gauges, status counts, open findings, recent activity | Recurring-mistake ranking and gap detector not built |
| Claim verification (Round 3) | Extract claims, match to fact register, flag unsupported or expired | Facts managed and sent to Gemini; expired facts currently excluded | Fix proposed, see known-limitations |
| Hosting | Vercel and Render | Same | |
| Image storage | Not planned | Google Drive | Added for image scan |

Add the date and who decided each change in `decisions.md`.
