# BrandGuard AI — Frontend starter

React + Vite + Tailwind + React Router starter matching the supplied BrandGuard prototype.

## Run locally
1. Install Node.js (LTS).
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Run `npm run dev` and open the URL printed by Vite.

## API mode
- `VITE_USE_MOCKS=true`: use local demo data and localStorage for draft/finding demo actions.
- `VITE_USE_MOCKS=false`: calls the API endpoints in `src/api/api.js`. Set `VITE_API_URL` to your backend API base URL.
- Mock mode is a frontend demo, not secure persistence or a substitute for the backend.
- The role selector in the header is a prototype/demo switch. In production, role must come from the authenticated `/auth/me` response and server-side permissions; never trust a client-side selector for authorization.

## Implemented starter screens
- Role-aware dashboard and navigation (Creator, Reviewer, Manager, Admin demo view)
- Draft list/new draft/editor, scan and finding decisions
- Review queue, comments, approve/request changes
- Guideline library, facts, audit log placeholder pages
- Responsive layout, empty states, loading and error feedback

## API assumptions
The API routes follow the supplied Round 2 working-process document. Backend payloads may need adjustment to match the actual server implementation. The code intentionally keeps API calls centralized in `src/api/api.js`.
