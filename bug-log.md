# Bug log (internal, not for judges)

Found by code review of commit a459e66 on 30 Oct 2026. Confirm each on the live app, then fill in Owner, Status and Verified.

| ID | Sev | Title | Where | Confirm | Fix | Owner | Status | Verified |
|---|---|---|---|---|---|---|---|---|
| B1 | P0 | Image scan and scan history need no login; history is not limited to an organisation | `server/routes/scanRoutes.js` mounted at `/api` | Logged out, open `/api/history` | Add `authenticate` and a role check; add `organisationId` to `Scan` and filter by it | | Open | |
| B2 | P1 | No upload size or file-type limit | `scanRoutes.js` (`multer` memory storage) | Upload a large or non-image file | `limits: { fileSize: 5 MB, files: 5 }` and a `fileFilter` for png, jpeg, webp | | Open | |
| B3 | P1 | Expired facts never reach Gemini | `draftController.js` lines 506-516 | Add a fact with a past valid-until, write a draft using it, scan | Include Expired facts in the query and add a prompt line to flag them | | Open | |
| B4 | P1 | Findings need no citation | `geminiService.js` `parseGeminiResponse` | Look for findings with no rule or fact | Label uncited findings "needs human check" or require a citation | | Open | |
| B5 | P1 | One invalid AI finding discards the whole AI result | `parseGeminiResponse` uses `every(...)` then throws | Unit test | Filter out only the invalid findings | | Open | |
| B6 | P1 | Gemini outage blocks submission | `submitDraft` | Break the API key on a test server, scan, submit | Allow submit with a warning, or keep the last good scan | | Open | |
| B7 | P2 | Reviewer role cannot open drafts or comment | `draftRoutes.js` | Log in as reviewer | Add reviewer to read and comment routes, or drop the role | | Open | |
| B8 | P2 | Admin reaches the approve route but is refused | `reviewDraft` requires `manager` | Approve as admin | Allow admin or remove the route access | | Open | |
| B9 | P2 | No rate limiting; CORS open to all origins | `app.js` | 50 wrong logins in a row | `express-rate-limit`; restrict CORS | | Open | |
| B10 | P3 | Debug log of user and draft IDs on update | `draftController.js` ~line 354 | Check server logs | Remove the log | | Open | |
| B11 | P3 | Anyone with the organisation ID can register as creator | `authController.register` | Register with a known ID | Invite code or document | | Open | |
| B12 | P3 | README says rules are not sent to Gemini and rules-only fallback is not claimed | `README.md` | Read README | Replace with the new text in this pack | | Done in this pack | |

Severity: P0 blocks the demo or is a data exposure; P1 major feature broken; P2 workaround exists; P3 cosmetic or minor.
