# Testing and evaluation

Owner: Ved Jitendra Kale (QA and evaluation). See also `test-plan` (separate PDF) and `bug-log.md`.

## 1. Automated tests

`npm test` runs `node --test` in `server/`. Four test files, 47 test cases in total (counted from the source):

| File | Cases | Covers |
|---|---|---|
| `server/test/app.test.js` | 31 | Health, unknown routes, authentication, role gates, draft visibility, catalog validation, malformed JSON, SPA deep links, scan failures |
| `server/test/scanPolicy.test.js` | 7 | Plain-code checks (rule phrases, alt-text) |
| `server/test/draftEditor.test.js` | 7 | Draft editor workflow helpers |
| `server/test/reviewQueue.test.js` | 2 | Review queue actions |

Result recorded by Ved on a machine with dependencies installed: **TO FILL** (passed / failed / date / commit).

## 2. Live end-to-end check

A live audit of the deployed app was reported on 30 Oct 2026. Ved should repeat each step and tick it.

| Check | Reported result | Re-confirmed by Ved |
|---|---|---|
| `GET /api/health` returns 200 | Pass | [ ] |
| Direct links `/login`, `/drafts`, `/review`, `/rulebook`, `/facts`, `/audit` load on refresh | Pass | [ ] |
| Demo login works for Manager and Creator | Pass | [ ] |
| Scan returns findings with explanation, severity and suggestion | Pass | [ ] |
| Creator resolves findings and submits (status Pending Approval) | Pass | [ ] |
| Manager approves with a comment (status Approved) | Pass | [ ] |
| Actions appear in the audit page | Pass | [ ] |
| Image upload is stored in Drive and analysed by Gemini | Pass | [ ] |

## 3. Permission and safety checks

Run with one account per role. Record the real result.

| # | Check | Expected | Result |
|---|---|---|---|
| P1 | Creator calls approve | 403 | |
| P2 | Manager approves own draft | 403 | |
| P3 | Request changes without a comment | 400 | |
| P4 | Edit an approved draft | 409 | |
| P5 | Dispute a finding without a reason | 400 | |
| P6 | Creator opens another creator's draft | 404 | |
| P7 | User from a second organisation opens a draft, fact or rule of the first | 404 | |
| P8 | Request with an expired or altered token | 401 | |
| P9 | Request with no token | 401 | |
| P10 | Script text (`<script>alert(1)</script>`) in a draft and a comment | Shown as plain text | |
| P11 | Alt-text of 301 characters | 400 | |
| P12 | Comment over 4,000 characters | 400 | |
| P13 | Call `/api/history` and `/api/upload-and-scan` with no token | 401 (**currently open, see bug-log B1**) | |
| P14 | Upload a very large or non-image file to the image scan | Refused (**currently accepted, bug-log B2**) | |

## 4. Evaluation set

Purpose: measure how many planted problems the scan finds and how many false alarms it raises.

**Status: not yet built.** The repository has no evaluation folder or dataset, so no numbers can be reported. Do not publish figures until the table below is filled from a real run.

Method:
1. Write 20 to 30 drafts: some with known planted problems (banned phrase, unsupported claim, expired fact, missing or generic alt-text, superlative), some clean, some borderline.
2. For each draft list the expected findings.
3. Scan each draft in the live app (or through the API), record the findings returned.
4. Count: found (true positives), missed (false negatives), extra flags on clean text (false positives).
5. Report recall = found / planted, false alarms per draft, and the average scan time.

| Run | Date | Drafts | Planted | Found | Missed | False alarms | Recall | False alarms per draft | Avg scan time |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |

Notes for the write-up: say which path was used (plain-code only or Gemini), the model name, and list the misses and false alarms by example.

## 5. User feedback

See `user-feedback.md`.

## 6. Sign-off checklist

- [ ] Server tests pass on the final commit
- [ ] Live end-to-end check repeated after the last deploy
- [ ] Permission checks P1 to P14 done
- [ ] Evaluation run recorded with real numbers
- [ ] Every open P0 and P1 bug closed or listed in `known-limitations.md`
