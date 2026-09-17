# DevForge API

Express + JavaScript + Prisma backend for DevForge — the developer command center for projects, tasks, deployments and integrations. This is the **backend repository**, deployed on **Vercel** (the React client lives in the separate `DevForge` repository, deployed on Netlify).

## Quick start

```bash
npm install
npm run db:generate      # Prisma client
npm run db:push          # create/update the PostgreSQL schema (see DB note below)
npm run db:seed          # demo workspace + demo@devforge.dev / devforge123
npm run dev              # API on http://localhost:4000
```

Copy `.env.example` to `.env` first for local environment config.

**Database note:** the committed schema is PostgreSQL (required on Vercel). Point `DATABASE_URL` at any Postgres host (Neon / Supabase / Vercel Postgres / local). For zero-setup local development without a database server, use the SQLite variant:

```bash
npm run db:generate:sqlite && npm run db:push:sqlite && npm run db:seed:sqlite
npm run dev
```

## Scripts

| Script            | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | node --watch — live-reloading API on :4000     |
| `npm run build`   | prisma generate (used by Vercel builds)        |
| `npm start`       | run the API (`node src/index.js`)              |
| `npm run db:*`    | prisma generate / push / migrate / seed (Postgres) |
| `npm run db:*:sqlite` | same, against the local SQLite schema      |
| `npm run test:api`| API integration suite (start the API first)    |

## Configuration

All settings come from environment variables (see `.env.example`). The important ones:

- `DATABASE_URL` — PostgreSQL connection string (required everywhere, including Vercel).
- `CLIENT_ORIGIN` — comma-separated allowed client origins (CORS + post-OAuth redirects).
- `COOKIE_SECURE` / `COOKIE_SAME_SITE` — always `true` / `none` when client and API are on different origins in production.
- `SESSION_SECRET` — required in production; keep it stable or sessions break on restart. If missing the server boots with a random secret and warns instead of crashing.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `GOOGLE_APP_ORIGIN` — Google OAuth.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` / `GITHUB_APP_ORIGIN` — GitHub OAuth.
- `AI_PROVIDER` — empty = built-in demo engine; `openai-aicompat` + `OPENAI_API_KEY` for external.

## Deployment

### Vercel

The repo contains `vercel.json` and `api/index.js` (the serverless entry point that exports the Express app — `src/index.js` keeps `app.listen()` for local/`npm start` use only).

1. Push the repo to GitHub and import it in Vercel (framework preset: **Other**).
2. The build runs `prisma generate` automatically.
3. Add the required environment variables (Project → Settings → Environment Variables, apply to Production and Preview):
   - `DATABASE_URL` — Postgres connection string (see above).
   - `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   - `CLIENT_ORIGIN` — your Netlify client origin, e.g. `https://your-app.netlify.app`.
   - `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`.
   - Optional: the Google / GitHub OAuth variables from `.env.example`, pointing redirect URIs at `https://devforge-api.vercel.app`.
4. Create the schema in the database once before use: `npm run db:push && npm run db:seed` (with `DATABASE_URL` set to the same value).
5. Redeploy. Verify with `https://devforge-api.vercel.app/api/health`.

### Render (alternative)

1. Create a repository from this folder and push it to GitHub.
2. Render Dashboard → **New +** → **Blueprint** → pick the repo (auto-detects `render.yaml`).
3. After creation, use the service URL (usually `https://devforge-api.onrender.com`) as:
   - `GOOGLE_REDIRECT_URI` / `GITHUB_REDIRECT_URI` (also register those exact URIs in the Google/GitHub developer consoles),
   - `VITE_API_URL` on the Netlify client build.
4. The blueprint seeds the persistent disk DB on every deploy (requires the SQLite schema — see `prisma/schema.sqlite.prisma` for local/Docker-style deployments).

### Docker

```bash
docker build -t devforge-api .
docker run -p 4000:4000 -v devforge-data:/data -e DATABASE_URL=file:/data/devforge.db -e SESSION_SECRET=... devforge-api
```

Note: the Dockerfile targets the SQLite schema (`prisma/schema.sqlite.prisma`) — swap the provider locally or provide a `DATABASE_URL` for Postgres.

## Testing

Start the API (`npm run dev` or the built server) then run:

```bash
npm run test:api
```