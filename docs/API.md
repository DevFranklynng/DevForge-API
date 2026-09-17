# DevForge API — Frontend Integration Guide & Endpoint Reference

Complete guide for connecting the **DevForge React frontend** to this backend, plus a
reference for every endpoint — `/auth/me`, `/auth/register`, `/auth/login` and the rest.

---

## 1. Base URL & path prefix

| Environment | Base URL |
| ----------- | -------- |
| Production  | `https://devforge-api.vercel.app` |
| Local dev   | `http://localhost:4000` |

**Every route lives under `/api`.** The URL you open is `BASE + /api + path`:

```
GET https://devforge-api.vercel.app/api/health        → { "status": "ok", ... }
GET https://devforge-api.vercel.app/api/auth/me        → the logged-in user (or 401)
POST https://devforge-api.vercel.app/api/auth/register → creates a user + logs in
POST https://devforge-api.vercel.app/api/auth/login    → logs in
```

You can open `/api/health` in a browser to confirm the deployment is alive.

---

## 2. How authentication works (read this first)

The API uses **session cookies**, not JWT.

- On `register` / `login` / Google sign-in the server sets an `httpOnly` cookie named
  `df_session`. You never read it from JavaScript — the browser sends it automatically.
- Every authenticated request must include that cookie. In `fetch` this means:
  ```js
  fetch(url, { credentials: "include" })   // ⚠ required on EVERY request
  ```
- Sessions expire after 30 days (`SESSION_TTL_DAYS`). Logging out deletes the session
  rows on the server *and* clears the cookie.
- On Vercel the cookie is set with `Secure` + `SameSite=None` because the client
  (Netlify) and API (Vercel) are on **different origins**. Both of these must be
  configured on the backend:
  - `COOKIE_SECURE=true`
  - `COOKIE_SAME_SITE=none`
  - `CLIENT_ORIGIN=https://your-app.netlify.app` (your exact origin; CORS allow-list).

### What the frontend never sees
`df_session` is `httpOnly`, so `document.cookie` is empty for it. There are **no
tokens to store** — the safest integration is a fetch wrapper with `credentials:
"include"`.

### Alternative: Bearer header (only if cookies are impossible)
The session token is also accepted as `Authorization: Bearer <token>`. The token is
the raw `df_session` cookie value — but since the cookie is `httpOnly`, browsers
can't read it cross-origin, so this is only usable if you capture the token some
other way (e.g. a login response). The cookie flow below is the supported path.

---

## 3. Frontend setup (React + Vite, deployed on Netlify)

1. Set an environment variable in Netlify (Site → Site settings → Environment
   variables), and in your local `.env`:
   ```
   VITE_API_URL=https://devforge-api.vercel.app
   ```
   Local dev: `VITE_API_URL=http://localhost:4000`.

2. Create a small API client. Everything goes through it so credentials + error
   handling are consistent:

   ```js
   // src/lib/api.js
   const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

   export async function api(path, { method = "GET", body } = {}) {
     const res = await fetch(`${BASE}/api${path}`, {
       method,
       credentials: "include",           // ← the session cookie
       headers: body ? { "Content-Type": "application/json" } : undefined,
       body: body ? JSON.stringify(body) : undefined,
     });

     if (res.status === 204) return null;

     const data = await res.json().catch(() => ({}));

     if (!res.ok) {
       const err = new Error(data.error ?? `Request failed (${res.status})`);
       err.status = res.status;
       err.details = data.details;       // [{ path, message }] on validation errors
       throw err;
     }
     return data;
   }
   ```

3. Example calls:
   ```js
   // Login
   await api("/auth/login", {
     method: "POST",
     body: { email: "you@example.com", password: "secret123" },
   });                                    // → { user }

   // Who am I? (call on app start / route guard)
   const { user } = await api("/auth/me"); // → { user: { ...safeUser, settings } }

   // Logout
   await api("/auth/logout", { method: "POST" }); // → { ok: true }
   ```

---

## 4. Recommended auth flow in the app

```
App loads
  └─ GET /api/auth/me
       ├─ 200 { user }  → user is logged in → render dashboard
       └─ 401           → not logged in → show <Login/> or <Register/>

Login/Register form submits
  └─ POST /api/auth/login | /api/auth/register
       ├─ 200/201 { user } → cookie is now set → navigate to /projects
       └─ 401/409/400      → show error (data.error)

Logout button
  └─ POST /api/auth/logout → clear app state → navigate to /login
```

---

## 5. Endpoint reference

> `Auth` column: 🔒 = requires the session cookie (a 401 is returned otherwise).
> All response shapes are the actual JSON returned by the server.

### 5.1 Auth

#### `POST /api/auth/register` — create account + auto-login
Body:
```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "min-8-chars" }
```
- `name`: 2–80 chars ⚠ required
- `email`: valid email ⚠ required
- `password`: min 8 chars ⚠ required

Responses:
- **201** → sets `df_session` cookie, returns:
  ```json
  { "user": { "id": "cm...", "name": "Ada Lovelace", "email": "ada@example.com",
      "avatarUrl": null, "role": "owner", "createdAt": "2026-...", "settings": { ... } } }
  ```
- **409** → `{ "error": "An account with this email already exists" }`
- **400** → `{ "error": "Validation failed", "details": [ { "path": "password", "message": "Password must be at least 8 characters" } ] }`

#### `POST /api/auth/login` — sign in
Body:
```json
{ "email": "ada@example.com", "password": "secret123" }
```
Responses:
- **200** → sets `df_session` cookie, returns `{ "user": { ... } }` (same shape as register)
- **401** → `{ "error": "Invalid email or password" }`

> Demo account that exists after seeding: `demo@devforge.dev` / `devforge123`

#### `POST /api/auth/logout` 🔒
No body. Deletes the session + clears the cookie.
- **200** → `{ "ok": true }`

#### `GET /api/auth/me` 🔒
Returns the current user **with their settings**:
```json
{ "user": { "id": "cm...", "name": "Ada Lovelace", "email": "ada@example.com",
  "avatarUrl": null, "role": "owner", "createdAt": "2026-...",
  "settings": { "id": "...", "theme": "dark", "workspaceName": "My Workspace",
    "defaultProjectView": "board", "notifyDueSoon": true, "notifyFailing": true } } }
```
- **200** logged in · **401** not logged in / expired session

#### `GET /api/auth/sessions` 🔒
List the user's active sessions (for a "manage devices" screen):
```json
{ "sessions": [ { "id": "cm...", "userAgent": "Mozilla/5.0...", "expiresAt": "...",
  "createdAt": "...", "current": true } ] }
```

#### `DELETE /api/auth/sessions/:id` 🔒
Revoke one session (other than the one you're using). → `{ "ok": true }` · **404** if not found

#### `PATCH /api/auth/profile` 🔒
Body (all optional):
```json
{ "name": "Ada", "email": "ada@new.com", "avatarUrl": "https://.../avatar.png" }
```
- **200** → `{ "user": { ... } }` (with settings)
- **409** → email already used by someone else

#### `POST /api/auth/password` 🔒
Body:
```json
{ "currentPassword": "old-pass", "newPassword": "new-pass-8+" }
```
Validates the current password, updates it, and signs out every other session.
- **200** → `{ "ok": true }` · **400** → current password is incorrect
- `currentPassword` ⚠ required, `newPassword` min 8 chars ⚠ required

#### Google sign-in (OAuth redirects — do NOT call from fetch)
- `GET /api/auth/google` → 302 redirect to Google's consent screen.
- `GET /api/auth/google/callback` → the browser lands here after consent. On success
  the server sets `df_session` and **redirects the browser to** `GOOGLE_APP_ORIGIN/login?google=1`;
  on failure it redirects to `GOOGLE_APP_ORIGIN/login?google_error=<reason>`.

Frontend usage — a plain link/button:
```jsx
<a href={`${VITE_API_URL}/api/auth/google`}>Continue with Google</a>
// → user returns to /login?google=1 → then your app calls /api/auth/me
```

---

### 5.2 Settings 🔒

#### `GET /api/settings`
→ `{ "settings": { "id": "...", "theme": "dark", "workspaceName": "My Workspace", "defaultProjectView": "board", "notifyDueSoon": true, "notifyFailing": true } }`

#### `PATCH /api/settings`
Body (all optional): `{ theme: "dark"|"light", workspaceName, defaultProjectView: "board"|"list", notifyDueSoon: bool, notifyFailing: bool }`
→ `{ "settings": { ...updated... } }`

---

### 5.3 Dashboard 🔒

#### `GET /api/dashboard`
One call for the home screen:
```json
{
  "overview": { "totalProjects": 4, "activeProjects": 3, "liveProjects": 1, "openTasks": 7 },
  "pulse": { "completedTasks30d": 12, "openTasks": 7, "projectsInDevelopment": 3,
    "deploySuccessRate": 75, "totalDeployments": 8 },
  "activeProjects": [ { "id": "...", "name": "...", "status": "planning", "priority": "medium", "progress": 40, "techStack": ["react"], "dueDate": null } ],
  "focusTasks": [ { "id": "...", "title": "...", "status": "todo", "priority": "high", "dueDate": "...", "project": { "id": "...", "name": "..." } } ],
  "deployments": [ { "id": "...", "status": "success", "environment": "production", "url": null, "branch": "main", "createdAt": "...", "project": { "id": "...", "name": "..." } } ],
  "recentActivity": [ { "id": "...", "type": "PROJECT_CREATED", "description": "...", "projectId": null, "createdAt": "..." } ]
}
```

---

### 5.4 Projects 🔒

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/projects` | query: `q`, `status`, `sort=recent\|name\|progress\|priority`, `limit` | `{ "projects": [ { id, name, description, status, priority, progress, techStack, repositoryUrl, productionUrl, dueDate, lastActivityAt, createdAt, openTasks, totalTasks, deploymentCount, apiCount } ], "total": n }` |
| `POST /api/projects` | `{ name ⚠, description?, status?, priority?, progress?, techStack?, repositoryUrl?, productionUrl?, imageUrl?, dueDate? }` | **201** `{ "project": { ... } }` |
| `GET /api/projects/:id` | — | `{ "project": { ...full row, techStack, openTasks, tasks, repositories, apiEndpoints, deployments } }` |
| `PATCH /api/projects/:id` | partial project body | `{ "project": { ... } }` |
| `DELETE /api/projects/:id` | — | `{ "ok": true }` |

`status` values: `planning`, `development`, `testing`, `live`. `priority`: `low`, `medium`, `high`. `progress`: 0–100. `dueDate` is an ISO string or `null`. **404** when not found / not owned.

---

### 5.5 Tasks 🔒

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/tasks` | query: `projectId`, `status`, `q` | `{ "tasks": [ { id, title, description, status, priority, dueDate, completedAt, createdAt, projectId, project } ] }` |
| `POST /api/tasks` | `{ title ⚠, description?, status?, priority?, dueDate?, projectId? }` | **201** `{ "task": { ... } }` |
| `PATCH /api/tasks/:id` | partial task body | `{ "task": { ... } }` |
| `DELETE /api/tasks/:id` | — | `{ "ok": true }` |

`status`: `todo`, `in_progress`, `done`. `priority`: `low`, `medium`, `high`. Updating a task's status to `done` recomputes the parent project's `progress`.

---

### 5.6 Repositories 🔒

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/repositories` | query: `projectId`, `source` | `{ "repositories": [ { id, name, owner, description, branch, visibility, stars, forks, openIssues, lastCommit, url, source, projectId, project } ] }` |
| `GET /api/repositories/:id` | — | `{ "repository": { ... } }` |
| `POST /api/repositories` | `{ name ⚠, description?, branch="main", visibility="private", stars, forks, openIssues, lastCommit?, url?, projectId?, source, sync? }` | **201** `{ "repository": { ... } }` |
| `PATCH /api/repositories/:id` | partial repo body | `{ "repository": { ... } }` |
| `DELETE /api/repositories/:id` | — | `{ "ok": true }` |

`source`: `manual` or `github`. Setting `sync: true` pulls data from the connected GitHub account.

---

### 5.7 Deployments 🔒

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/deployments` | query: `projectId`, `environment`, `status` | `{ "deployments": [ { id, status, buildStatus, environment, branch, commit, commitMessage, provider, url, durationMs, finishedAt, createdAt, projectId, project } ] }` |
| `GET /api/deployments/:id` | — | `{ "deployment": { ... } }` |
| `POST /api/deployments` | `{ projectId ⚠, environment="production"\|"staging"\|"preview", branch?, commit?, commitMessage?, url? }` | **201** `{ "deployment": { ... } }` |
| `POST /api/deployments/:id/cancel` | — | `{ "deployment": { ...cancelled... } }` |

`status`: `success`, `failed`, `running`, `cancelled`. Without a real deploy provider these are simulated (labelled `provider: "demo"`).

---

### 5.8 API endpoints (the "Docs" feature) 🔒

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/apis` | query: `projectId`, `method` | `{ "endpoints": [ { id, name, method, path, description, authRequired, parameters, requestBody, responseExample, statusCode, projectId, createdAt, updatedAt, project } ] }` |
| `GET /api/apis/:id` | — | `{ "endpoint": { ... } }` |
| `POST /api/apis` | `{ path ⚠, name?, method="GET", description?, authRequired=false, parameters=[], requestBody?, responseExample?, statusCode="200", projectId? }` | **201** `{ "endpoint": { ... } }` |
| `PATCH /api/apis/:id` | partial endpoint body | `{ "endpoint": { ... } }` |
| `DELETE /api/apis/:id` | — | `{ "ok": true }` |

---

### 5.9 Activity 🔒

#### `GET /api/activity`
Query: `projectId`, `type`, `limit`, `offset` (default limit 20).
→ `{ "activities": [ { id, type, description, projectId, project, details, createdAt } ], "total": n }`
Types seen in the UI: `PROJECT_CREATED`, `PROJECT_UPDATED`, `TASK_CREATED`, `TASK_UPDATED`, `DEPLOYMENT_CREATED`, `SETTINGS_UPDATED`, etc.

---

### 5.10 Notifications 🔒

| Method & path | Response |
| --- | --- |
| `GET /api/notifications` | `{ "notifications": [ { id, type, title, message, link, resourceId, isRead, createdAt, projectId } ] }` |
| `GET /api/notifications/unread-count` | `{ "count": 3 }` |
| `POST /api/notifications/reconcile` | syncs notifications with the workspace → `{ "count": n }` |
| `PATCH /api/notifications/:id/read` | `{ "notification": { ...isRead: true } }` |
| `PATCH /api/notifications/:id/unread` | `{ "notification": { ...isRead: false } }` |
| `POST /api/notifications/read-all` | `{ "ok": true }` |

---

### 5.11 Global search 🔒

#### `GET /api/search?q=...`
→ grouped results designed for a command palette:
```json
{ "query": "react",
  "projects":  [ { "id", "name", "description", "status", "href": "/projects/<id>" } ],
  "tasks":     [ { "id", "title", "status", "projectId", "projectName", "href" } ],
  "endpoints": [ { "id", "method", "path", "projectId", "projectName", "href" } ],
  "activities":[ { "id", "description", "type", "projectId", "href" } ] }
```

---

### 5.12 AI assistant 🔒

#### `POST /api/ai/ask`
Body: `{ "message" ⚠ (1–2000 chars), "projectId"? }`
→ `{ "response": { "content": "...", "citations"? ,"demo": bool, "provider": "demo"|"openai-aicompat" } }`
Works out of the box with the built-in demo engine; no key needed.

---

### 5.13 GitHub integration 🔒

| Method & path | Behavior |
| --- | --- |
| `GET /api/github/authorize` | 302 redirect to GitHub OAuth (302 → instantly follows to GitHub login) |
| `GET /api/github/callback` | public; on success redirects browser to `GITHUB_APP_ORIGIN/github?linked=1`, errors → `.../github?link_error=<reason>` |
| `GET /api/github/status` | `{ "github": { "connected": true, "login": "...", "avatarUrl": "...", "scopes": [...] } }` (or `connected: false`) |
| `GET /api/github/repos` | `{ "repositories": [...] }` from the user's GitHub (401 if not connected) |
| `POST /api/github/disconnect` | revokes + removes the credential → `{ "ok": true }` |

Use the authorize **link** in the UI, then after the browser redirect callback, refresh status:
```jsx
<a href={`${VITE_API_URL}/api/github/authorize`}>Connect GitHub</a>
// → user returns to /github?linked=1 → call GET /api/github/status
```

---

### 5.14 Live updates (Server-Sent Events) 🔒

#### `GET /api/events`
Opens an SSE stream that pushes a frame whenever your data changes
(`projects`, `tasks`, `deployments`, `notifications`, `settings`, `repositories`,
`activity`, ...) so other tabs/state stay in sync:

```
event: projects
data: {"resource":"projects"}
```

Plain `EventSource` doesn't send cross-origin cookies, so use a streaming `fetch`:
```js
async function subscribe() {
  const res = await fetch(`${BASE}/api/events`, {
    credentials: "include",
    headers: { Accept: "text/event-stream" },
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log("update:", decoder.decode(value)); // parse "event:" / "data:" lines
    // → e.g. refetch the mutated resource
  }
}
```
Heartbeat comments arrive every 25 s so the connection stays alive.

---

### 5.15 Health

#### `GET /api/health` — public, no auth
```json
{ "status": "ok", "service": "devforge", "time": "2026-..." }
```

---

## 6. Error format (every endpoint)

| Status | Meaning | Shape |
| --- | --- | --- |
| `400` | Validation / bad request | `{ "error": "Validation failed", "details": [ { "path": "email", "message": "Enter a valid email address" } ] }` |
| `401` | Not logged in / bad credentials | `{ "error": "Authentication required" }` |
| `404` | Resource not found / not owned | `{ "error": "Resource not found" }` |
| `409` | Duplicate / conflict | `{ "error": "An account with this email already exists" }` |
| `503` | Database unavailable | `{ "error": "Database is unavailable" }` |
| `500` | Unexpected | `{ "error": "Internal server error" }` |

Every error body also includes `details` (may be `undefined`).

---

## 7. Minimal React example (Auth context)

```jsx
// src/auth.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null = unknown, undefined = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await api("/auth/login", { method: "POST", body: { email, password } });
    setUser(d.user);
    return d.user;
  };
  const register = async (name, email, password) => {
    const d = await api("/auth/register", { method: "POST", body: { name, email, password } });
    setUser(d.user);
    return d.user;
  };
  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
```

```jsx
// src/Protected.jsx — route guard
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading…</div>;
  return user ? children : <Navigate to="/login" />;
}
```

> The Vercel API is CORS-protected. If you get CORS errors, the backend's
> `CLIENT_ORIGIN` env var must include your exact origin — including `https://` and
> no trailing slash, e.g. `https://your-app.netlify.app`.

---

## 8. Troubleshooting checklist

| Symptom | Fix |
| --- | --- |
| `401 Authentication required` | `credentials: "include"` missing from the request |
| Login works locally but not on the deployed app | Set `COOKIE_SECURE=true` + `COOKIE_SAME_SITE=none` + correct `CLIENT_ORIGIN` on Vercel, then redeploy |
| CORS errors in the browser console | `CLIENT_ORIGIN` on the API must exactly match the frontend origin |
| `/api/health` works but everything else 401s | You were never logged in — call `/auth/login` first |
| `503 Database is unavailable` | `DATABASE_URL` on Vercel is wrong / DB is unreachable |
| Sessions drop after redeploy | `SESSION_SECRET` changed — keep it constant in Vercel env vars |

---

*All routes, bodies, and response shapes above were generated from the actual
`src/routes/index.js` and controller code — see the sections named in
`README.md` if you need to extend them.*