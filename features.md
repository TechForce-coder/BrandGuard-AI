# Features

Status key: **Done** (works and was checked in the code or in the live audit), **Partial** (works with a stated gap), **Not done**.
"Evidence" points to the file in the repository (commit a459e66).

## Core workflow

| Feature | Status | Notes | Evidence |
|---|---|---|---|
| Login with JWT (1 hour), bcrypt passwords | Done | Role and organisation are reloaded from the database on every request; a `tokenVersion` lets tokens be revoked | `server/middleware/authMiddleware.js`, `controllers/authController.js` |
| Roles: creator, reviewer, manager, admin | Partial | Creator and manager flows work. Reviewer cannot open drafts and admin cannot approve (see limitations) | `routes/draftRoutes.js`, `reviewDraft` |
| Organisation isolation | Done | Drafts, facts, rules, audit and findings are all filtered by `organisationId` | all controllers |
| Draft create, edit, list, open | Done | Creators see only their own drafts; reviewers and managers see submitted ones | `draftController.js` |
| Revision history and diff | Done | Earlier content is kept in a `revisions` list; original text kept as a baseline; diff viewer in the review screen | `Draft.js`, `DiffViewer.jsx` |
| Scan (plain-code checks + Gemini) | Done | Falls back to plain-code checks if Gemini fails; a fallback scan blocks submission | `geminiService.js`, `scanPolicy.js` |
| Accept, reject, dispute findings | Done | Dispute needs a reason; only the author, only while editable | `findingController.js` |
| Submit for review | Done | Needs a complete scan and every finding resolved | `submitDraft` |
| Approve or request changes | Done | Manager only; comment required for request-changes; self-review blocked; atomic status change | `reviewDraft` |
| Review comments | Done | Stored in the audit log | `addDraftComment` |
| Approved drafts locked | Done | Edit, scan and finding changes return 409 | `updateDraft`, `scanDraft` |
| Audit log | Done | Create, update, scan, finding decisions, submit, comment, approve, request changes, rule and fact changes | `auditService.js`, `/audit` page |

## Rulebook and facts

| Feature | Status | Notes | Evidence |
|---|---|---|---|
| Rulebook entries (create, edit, delete) | Done | Title, description, status; manager and admin only | `catalogController.js`, `Rulebook.jsx` |
| Plain-code rule checks | Partial | Only for descriptions written as `must not contain: ...` or `must include: ...` | `scanPolicy.js` |
| Rules passed to Gemini | Done | All active rules are sent in the prompt | `draftController.scanDraft` |
| Fact register with owner and valid-until | Done | Title, owner, valid-until, status (Active, Valid, Expired, Inactive) | `Fact.js`, `Facts.jsx` |
| Expired facts flagged in drafts | **Not done** | Expired facts are excluded from the scan query, so Gemini never sees them. Fix is proposed (see `known-limitations.md`) | `draftController.js` lines 506-516 |
| PDF or text rulebook upload with chunking | Not done | Rules are entered one by one | |
| Terms page (banned and preferred terms) | Not done | | README |

## Round 3 improvements

| Improvement | Status | What exists | What is missing |
|---|---|---|---|
| 1. Claim verification against the fact register | Partial | Facts are managed and sent to Gemini; plain-code "positive claim" check exists | Expired claims are not flagged until the query fix is merged |
| 2. Visual and accessibility checks | Partial | Alt-text rules (5 to 125 characters, generic words like "image" or "photo" flagged); image upload to Google Drive with a general Gemini review | No palette matching, no logo comparison |
| 3. Governance insights | Partial | Dashboard with approval gauges (pending, approved, needs changes), open-finding count and recent activity | No recurring-issue ranking per rule or creator; no guideline-gap detector |

## Not built

Browser extension, Google Docs or Slack input, approval-gated publishing webhook, DOCX or PDF drafts, vector search or embeddings, inline highlights inside the editor (the editor is a plain text area with a findings panel).
