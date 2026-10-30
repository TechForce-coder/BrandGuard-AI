# AI and tools disclosure

## AI inside the product

| Service | Use | Data sent |
|---|---|---|
| Google Gemini API (`@google/genai`, `@google/generative-ai`) | Scanning draft text against rules and facts; reviewing uploaded images | Draft title and content, the organisation's active rules and facts, alt-text; uploaded image bytes |

Models are set by `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL`, with a built-in fallback list. Every AI finding is advice for a person to accept, reject or dispute. Nothing is rewritten or published automatically. **TO FILL:** the Gemini API tier used and its data-use terms.

## AI tools used to build the project

| Tool | Used for | By |
|---|---|---|
| Claude (Anthropic) | Structuring and editing the Round 1 plan; test plan, code review and documentation drafts in Round 3 | Ved |
| Gemini | Interactive HTML mockup and the workflow figure (Round 1) | **TO FILL** |
| Any other assistant used for code (for example Copilot, ChatGPT, Gemini, Cursor) | **TO FILL** | **TO FILL** |

The team chose the idea, scope and decisions.

## Reused material

- No product code was copied from the Round 1 HTML mockup. **TO CONFIRM with Sarthak.**
- The login page includes demo accounts for judges.
- Open-source libraries are listed below.

## Libraries (from `package.json` files)

| Part | Libraries |
|---|---|
| Server | express 5, mongoose 9, jsonwebtoken, bcryptjs, cors, dotenv, multer, googleapis, @google/genai, @google/generative-ai, nodemon (dev) |
| Client | react 18, react-dom, react-router-dom 6, lucide-react, vite 6, @vitejs/plugin-react, tailwindcss 3, postcss, autoprefixer, gh-pages |
| Root | concurrently (dev), multer |

## External services

MongoDB Atlas (database), Google Gemini API (AI), Google Drive API (image storage), Vercel (frontend hosting), Render (backend hosting), GitHub (code).

## Personal data

Demo data only: a fictional brand with sample content. No real customer data. Passwords are stored as bcrypt hashes. API keys stay on the server.
