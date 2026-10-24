# BrandGuard AI

BrandGuard AI is a React/Vite frontend with an Express API and MongoDB persistence.

## Windows PowerShell setup

Install Node.js (LTS), then install each package set from the repository root:

```powershell
npm install
npm install --prefix .\client
npm install --prefix .\server
```

Create the backend environment file without overwriting an existing file:

```powershell
if (-not (Test-Path .\server\.env)) { Copy-Item .\server\.env.example .\server\.env }
```

Set the private values in `server\.env` locally:

- `MONGO_URI` — MongoDB connection URI.
- `JWT_SECRET` — a long, randomly generated signing key. Never commit or share it.
- `GEMINI_API_KEY` — optional for server startup, required for AI scans.

## Development

From the repository root, start the Vite frontend and the backend together:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite serves the same React source used by the production build and proxies `/api` to the development backend on port 5001. The backend starts once under nodemon; if either development process exits, `concurrently` stops the other.

The backend can also be started on its own with `npm run dev --prefix .\server` (port 5001 by default). The frontend can be run separately with `npm run dev --prefix .\client`, but the backend must also be running for `/api` requests. Set `DEV_API_PORT` in the shell before starting both processes to choose another development API port; Vite uses the same value for its proxy. Vite defaults to port 5173 and exits with a clear error if that port is occupied; set `DEV_FRONTEND_PORT` to use another available port.

The development server requires a reachable MongoDB and `JWT_SECRET`, just like production. API calls still require valid authentication. The old `VITE_LOGIN_BYPASS` flag is no longer honored: local preview mode does not authenticate users or permit role switching.

## Production-style local run

`PORT` defaults to `5000`. `npm run build` produces the client build; `npm start` runs the build and then starts Express serving the frontend and API together:

```powershell
npm run build
npm start
```

Open [http://localhost:5000](http://localhost:5000). Startup fails clearly if the frontend build, database connection, JWT configuration, or port configuration is unavailable. The process handles Ctrl+C and termination signals and disconnects from MongoDB during shutdown.

## Environment and data safety

- `server\.env` and `client\.env.local` are local-only and ignored by Git. Environment files are not served by Express; only `client\dist` is exposed as static content.
- Vite uses the same-origin `/api` path through its development proxy. Do not put secrets in Vite variables because they are embedded in browser assets.
- `VITE_LOGIN_BYPASS` is ignored; both development and production enforce the existing login and role-gated routes.
- This application uses live API operations; it does not enable the browser fixture or mock authentication path.
- `server\seedOrganisation.js` can initialize the existing “Tech Force” organization in the configured MongoDB and print its ID for registration. It does not create a user or administrator. Registration currently assigns the `creator` role. Create and assign privileged accounts only through an authorized, secure database/operations process; organization creation API access is restricted to administrators.
- AI content scanning requires `GEMINI_API_KEY`. Missing credentials are reported as a scan error; the server does not fabricate scan results.

## Frontend-to-backend integration map

| Frontend operation | HTTP endpoint | Server implementation | Persistence |
|---|---|---|---|
| Login | `POST /api/auth/login` | `authRoutes` → `authController.login` | Reads `User`; bcrypt verifies password; issues JWT |
| Restore session | `GET /api/auth/me` | `authRoutes` → JWT middleware → `authController.getMe` | Reads `User` |
| Register | `POST /api/auth/register` | `authRoutes` → `authController.register` | Reads `Organisation`; creates `User` |
| Create organization | `POST /api/organisations` | JWT + admin role → `organisationRoutes` → `organisationController.createOrganisation` | Reads/creates `Organisation` |
| List/view/create/update drafts | `/api/drafts` and `/api/drafts/:id` | `draftRoutes` → `draftController` | Reads/writes `Draft`; organization and role scoped |
| Scan draft | `POST /api/drafts/:id/scan` | `draftRoutes` → `draftController.scanDraft` → `geminiService` | Saves findings and scan timestamp to `Draft` |
| Submit/review | `POST /api/drafts/:id/submit`, `/approve`, `/request-changes` | `draftRoutes` → `draftController` | Updates `Draft`; records `AuditLog` |
| Resolve finding | `PATCH /api/findings/:id` | `findingRoutes` → `findingController.updateFinding` | Updates a finding in `Draft` |
| Read audit history | `GET /api/audit` | `auditRoutes` → `auditController.getAudit` | Reads organization-scoped `AuditLog` records |
| Health check | `GET /api/health` | Express app | No database operation |

The rules and facts pages currently call `/api/rulebook` and `/api/facts`, but this repository has no matching routes, controllers, or database models. They return explicit JSON 404 errors rather than placeholder data. The frontend Administration page is informational only, and the backend user schema supports `creator`, `reviewer`, and `manager`; it does not currently support an administrator account/role.

Audit history currently records submission, approval, and changes-requested events, which are the actions represented by the existing `AuditLog` schema. It does not claim to record scans or finding decisions.

## Tests

```powershell
npm run build
npm test
node --check .\start.js
node --check .\server\server.js
node --check .\server\app.js
```

The automated HTTP tests cover health responses, unknown API paths, unsupported feature endpoints, authentication and role gates, malformed JSON, SPA deep links, and missing static assets. They do not require a live MongoDB or Gemini account. Database-backed persistence, credential-based login/registration, approval workflow, and Gemini scanning require configured services and must be verified against a non-production database.
