# Decision log

Dates and owners marked TO FILL need the team's input. Decisions below are visible in the code.

| # | Date | Decision | Reason | Owner |
|---|---|---|---|---|
| 1 | TO FILL | Role and organisation are reloaded from the database on every request; tokens last 1 hour and carry a `tokenVersion` | Role changes and logout take effect at once | Sujal |
| 2 | TO FILL | Registration always creates a creator | Privileged roles go through a controlled process | Sujal |
| 3 | TO FILL | Draft status changes use atomic database updates | Two reviewers cannot both decide; a draft cannot change while being submitted | Sujal |
| 4 | TO FILL | A manager cannot review their own draft | Separation of duties | Sujal |
| 5 | TO FILL | All findings must be resolved before submitting | Human decision on every AI finding | Sujal / Sarthak |
| 6 | TO FILL | A plain-code-only scan cannot be submitted | A complete AI scan is required for approval | Sujal |
| 7 | TO FILL | AI findings must quote text that exists in the draft | The model cannot invent text | Sujal |
| 8 | TO FILL | Findings stored inside the draft record | One document per draft, simpler queries | Om |
| 9 | TO FILL | Rules and facts in separate collections per organisation | Managers edit them independently of drafts | Om |
| 10 | TO FILL | No retrieval step; all active rules and facts go to Gemini | Small rulebooks, faster to build | Team |
| 11 | TO FILL | Plain text editor with a findings panel instead of TipTap | Time | Sarthak |
| 12 | TO FILL | Image scan stores files in Google Drive | Free storage for the demo | Sujal |
| 13 | TO FILL | Demo accounts shown on the login page | Judges can try the app at once | Team |
