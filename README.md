# DevForge API

Express + TypeScript + Prisma backend for DevForge — the developer command center for projects, tasks, deployments and integrations. This is the **backend repository**, deployed independently (Render / Docker). The React client lives in the separate `DevForge` repository (Netlify).

## Quick start

```bash
npm install
npm run db:generate      # Prisma client
npm run db:push          # create/update the SQLite schema
npm run db:seed          # demo workspace + demo@devforge.dev / devforge123
npm run dev              # API on http://localhost:4000
```

Copy `.env.example` to `.env` first for local environment config.

## Scripts

| Script            | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | tsx watch — live-reloading API on :4000        |
| `npm run build`   | tsc → `dist/`                                  |
| `npm start`       | run the built API (`node dist/index.js`)       |
| `npm run db:*`    | prisma generate / push / migrate / seed        |
| `npm run test:api`| API integration suite (start the API first)    |

## Configuration

All settings come from environment variables (see `.env.example`). The important ones:

- `DATABASE_URL` — SQLite path (`file:./devforge.db` locally) or Postgres connection string.
- `CLIENT_ORIGIN` — comma-separated allowed client origins (CORS + post-OAuth redirects).
- `COOKIE_SECURE` / `COOKIE_SAME_SITE` — always `true` / `none` when client and API are on different origins in production.
- `SESSION_SECRET` — required in production; keep it stable or sessions break on restart.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `GOOGLE_APP_ORIGIN` — Google OAuth.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` / `GITHUB_APP_ORIGIN` — GitHub OAuth.
- `AI_PROVIDER` — empty = built-in demo engine; `openai-aicompat` + `OPENAI_API_KEY` for external.

## Deployment

### Render (recommended)

1. Create a repository from this folder and push it to GitHub.
2. Render Dashboard → **New +** → **Blueprint** → pick the repo (auto-detects `render.yaml`).
3. After creation, use the service URL (usually `https://devforge-api.onrender.com`) as:
   - `GOOGLE_REDIRECT_URI` / `GITHUB_REDIRECT_URI` (also register those exact URIs in the Google/GitHub developer consoles),
   - `VITE_API_URL` on the Netlify client build.
4. The blueprint seeds the persistent disk DB on every deploy, so `demo@devforge.dev / devforge123` exists from the first start.

### Docker

```bash
docker build -t devforge-api .
docker run -p 4000:4000 -v devforge-data:/data -e SESSION_SECRET=... devforge-api
```

## Testing

Start the API (`npm run dev` or the built server) then run:

```bash
npm run test:api
```