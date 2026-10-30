# BrandGuard AI

An explainable, human-controlled brand-governance workspace that reviews marketing content before it is published.

**Team:** Tech Force | **Event:** FutureStack 2026 (Round 3) | **Institution:** Zeal College of Engineering and Research, Pune

| | |
|---|---|
| Live app | https://brandguard-ai-green.vercel.app/ |
| Backend API | https://brandguard-ai-3br0.onrender.com/api (health check: `/api/health`) |
| Repository | https://github.com/TechForce-coder/BrandGuard-AI |

## What it does

1. A **creator** writes a draft (title, channel, content, optional image alt-text).
2. The server scans the draft: plain-code checks first (rulebook phrases, alt-text), then Gemini against the organisation's active rules and approved facts.
3. The creator **accepts, rejects or disputes** each finding (a dispute needs a reason). All findings must be resolved before submitting.
4. A **manager** approves, or requests changes with a comment. A manager cannot review their own draft. Approved drafts are locked.
5. Every step is written to an **audit log**.

Nothing is auto-rewritten and nothing is published without a manager's approval.

## Demo logins

Open the live app and use the one-click demo cards on the login page.

| Role | Email | Password |
|---|---|---|
| Manager | ved@gmail.com | shown on the demo card |
| Creator | sample@gmail.com | shown on the demo card |

The demo panel can be hidden with `VITE_SHOW_DEMO_ACCESS=false`. Change the demo passwords after judging.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS 3, React Router 6, Lucide icons (hosted on Vercel) |
| Backend | Node.js 22, Express 5, JWT (1 hour), bcrypt, Multer (hosted on Render) |
| Database | MongoDB Atlas with Mongoose (7 models, see `docs/architecture.md`) |
| AI | Google Gemini via `@google/genai` (scan) and `@google/generative-ai` (image scan), with model fallback and retry |
| Other services | Google Drive API (image storage) |

## Setup

```bash
npm install
npm install --prefix client
npm install --prefix server
cp server/.env.example server/.env     # then fill in the values below
npm run dev                             # frontend on :5173, API on :5001
```

Production-style run: `npm run build` then `npm start` (Express serves the built client on port 5000).

### Environment variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random signing key. Never commit it |
| `GEMINI_API_KEY` | For scans | Gemini API key. Without it only plain-code checks run |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | No | Primary and fallback model names |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` | For image upload | Google Drive storage for scanned images |
| `PORT` | No | Defaults to 5000 |
| `DEV_API_PORT`, `DEV_FRONTEND_PORT` | No | Development ports |

Client (`client/.env.local`): `VITE_SHOW_DEMO_ACCESS`, `VITE_ENABLE_WORKSPACE_PREVIEW` (keep `false` in production). Do not put secrets in Vite variables.

Seed the "Tech Force" organisation with `node server/seedOrganisation.js`. Registration always creates a `creator`; promote users with `server/makeAdmin.js`.

## Tests

```bash
npm test          # runs server tests with node --test
npm run build     # builds the client
```

See `docs/testing-and-evaluation.md`.

## Documentation

| File | Contents |
|---|---|
| `docs/features.md` | Every feature, marked Done, Partial or Not done |
| `docs/architecture.md` | Components, data model, roles, scan pipeline |
| `docs/testing-and-evaluation.md` | Test approach, results, evaluation set |
| `docs/known-limitations.md` | What the product does not do yet |
| `docs/changes-from-plan.md` | Round 1 plan versus what was built |
| `docs/ai-and-tools-disclosure.md` | AI tools, libraries and external services |
| `docs/contributions.md` | Who did what |
| `docs/roadmap.md` | Future development |
| `docs/demo-script.md` | Step-by-step demo |
| `docs/user-feedback.md` | User feedback round |
| `docs/decisions.md` | Decision log |

## Known limits (short version)

Scans send all active rules and facts to Gemini (no retrieval or embeddings yet). Plain-code rule checks only work for rules written as `must not contain: ...` or `must include: ...`. Image checks are alt-text rules plus a general Gemini review, not palette or logo matching. Full list: `docs/known-limitations.md`.
