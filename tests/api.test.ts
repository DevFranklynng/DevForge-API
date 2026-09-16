import { randomUUID } from "node:crypto";

const BASE = process.env.API_BASE ?? "http://localhost:4000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function request(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; redirect?: RequestRedirect } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers.cookie = opts.token;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: opts.redirect ?? "follow",
  });
  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") ?? undefined, location: res.headers.get("location") ?? undefined };
}

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  ok - ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL - ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`);
  }
}

function record(expect: number, got: number): boolean {
  return got === expect;
}

async function loginCookie(email: string, password: string): Promise<string> {
  const res = await request("/api/auth/login", { method: "POST", body: { email, password } });
  if (res.setCookie) {
    return res.setCookie.split(";")[0];
  }
  throw new Error(`login failed (${res.status}): ${JSON.stringify(res.json)}`);
}

async function main() {
  console.log(`DevForge API tests against ${BASE}`);

  const health = await request("/api/health");
  check("health reports ok", health.status === 200 && (health.json as { status?: string }).status === "ok", health.json);

  const unauth = await request("/api/dashboard");
  check("dashboard requires auth (401)", record(401, unauth.status), unauth.status);

  const demo = await loginCookie("demo@devforge.dev", "devforge123");
  check("demo login succeeds", demo.length > 0);

  const me = await request("/api/auth/me", { token: demo });
  const meUser = (me.json as { user?: { email?: string; settings?: Record<string, unknown> } }).user;
  check("me returns demo user", me.status === 200 && meUser?.email === "demo@devforge.dev", meUser);
  check(
    "me includes settings with notification prefs",
    meUser?.settings &&
      typeof meUser.settings.notifyDueSoon === "boolean" &&
      typeof meUser.settings.notifyFailing === "boolean",
    meUser?.settings,
  );

  const email = `test-${Date.now()}-${randomUUID().slice(0, 6)}@devforge.test`;
  const reg = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Test Runner", email, password: "testpass123" },
  });
  check("register creates user (201)", record(201, reg.status), reg.json);
  const testCookie = reg.setCookie?.split(";")[0] ?? "";
  const regMe = await request("/api/auth/me", { token: testCookie });
  check(
    "registered user can me()",
    regMe.status === 200 && (regMe.json as { user?: { email?: string } }).user?.email === email,
    regMe.json,
  );
  const regLogout = await request("/api/auth/logout", { method: "POST", token: testCookie });
  check("logout works", record(200, regLogout.status), regLogout.json);
  const regLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "testpass123" },
  });
  check("registered user can log back in", record(200, regLogin.status) && Boolean(regLogin.setCookie), regLogin.status);

  const dashboard = await request("/api/dashboard", { token: demo });
  const dash = dashboard.json as {
    overview?: { totalProjects?: number; openTasks?: number };
    activeProjects?: unknown[];
    focusTasks?: unknown[];
    deployments?: unknown[];
    recentActivity?: unknown[];
  };
  check("dashboard returns overview", dash.overview !== undefined, dash);
  check(
    "dashboard overview has totals",
    typeof dash.overview?.totalProjects === "number" && typeof dash.overview?.openTasks === "number",
    dash.overview,
  );
  check("dashboard has focusTasks + deployments + recentActivity", Boolean(dash.focusTasks) && Boolean(dash.deployments) && Boolean(dash.recentActivity));

  const projects = await request("/api/projects", { token: demo });
  const proj = projects.json as { projects?: unknown[]; total?: number };
  check("projects list returns {projects,total}", Array.isArray(proj.projects) && typeof proj.total === "number", proj);
  const firstProject = (proj.projects?.[0] as { id?: string; slug?: string; openTasks?: number; totalTasks?: number; techStack?: string[] }) ?? {};
  check(
    "project rows include task/status counts",
    firstProject.id !== undefined &&
      typeof firstProject.openTasks === "number" &&
      typeof firstProject.totalTasks === "number" &&
      (firstProject.techStack === undefined || Array.isArray(firstProject.techStack)),
    firstProject,
  );
  const projectId = firstProject.id!;

  const detail = await request(`/api/projects/${projectId}`, { token: demo });
  const d = detail.json as { project?: { tasks?: unknown; deployments?: unknown; apiEndpoints?: unknown; repository?: unknown } };
  check("project detail includes tasks/deployments/apiEndpoints", Boolean(d.project?.tasks && d.project?.deployments && d.project?.apiEndpoints), d.project);

  const tasks = await request("/api/tasks", { token: demo });
  const t = tasks.json as { tasks?: unknown[] };
  check("tasks list is an array", Array.isArray(t.tasks) && t.tasks!.length >= 0, t);

  const deployments = await request("/api/deployments", { token: demo });
  const dep = deployments.json as { deployments?: { project?: unknown }[] };
  check("deployments include project relation", Array.isArray(dep.deployments) && (dep.deployments.length === 0 || dep.deployments![0].project !== undefined), dep.deployments);

  const repos = await request("/api/repositories", { token: demo });
  const rep = repos.json as { repositories?: unknown[] };
  check("repositories list is an array", Array.isArray(rep.repositories), rep);

  const activity = await request("/api/activity", { token: demo });
  const act = activity.json as { activities?: unknown[]; total?: number };
  check("activity returns {activities,total}", Array.isArray(act.activities) && typeof act.total === "number", act);

  const ai = await request("/api/ai/ask", { token: demo, method: "POST", body: { message: "What's the status of the mobile app project?" } });
  const a = ai.json as { response?: { content?: string; isDemo?: boolean } };
  check("ai.ask returns response content", a.response?.content !== undefined, a);
  check("ai demo mode flagged", typeof a.response?.isDemo === "boolean", a.response);

  const search = await request("/api/search?q=project", { token: demo });
  const s = search.json as { projects?: unknown[]; tasks?: unknown[] };
  check("search returns grouped results", typeof s.projects === "object" && typeof s.tasks === "object", s);

  const settingsRes = await request("/api/settings", { token: demo, method: "PATCH", body: { notifyDueSoon: false, defaultProjectView: "list" } });
  const settings = settingsRes.json as { settings?: { notifyDueSoon?: boolean; defaultProjectView?: string } };
  check("settings patch applies notification prefs", settings.settings?.notifyDueSoon === false && settings.settings?.defaultProjectView === "list", settings);
  await request("/api/settings", { token: demo, method: "PATCH", body: { notifyDueSoon: true, defaultProjectView: "board" } });

  const notifs = await request("/api/notifications", { token: demo });
  const n = notifs.json as { notifications?: unknown[] };
  check("notifications list is an array", Array.isArray(n.notifications), n);
  const firstNotifId = (n.notifications?.[0] as { id?: string })?.id;
  if (firstNotifId) {
    const mark = await request(`/api/notifications/${firstNotifId}/read`, { token: demo, method: "PATCH" });
    check("mark notification read", record(200, mark.status), mark.json);
  }
  const unread = await request("/api/notifications/unread-count", { token: demo });
  check("unread count returns number", typeof (unread.json as { count?: number }).count === "number", unread.json);

  // --- GitHub integration ---
  const ghStatus = await request("/api/github/status", { token: demo });
  const gh = ghStatus.json as { github?: { connected?: boolean } };
  check("github status returns connection state", ghStatus.status === 200 && typeof gh.github?.connected === "boolean", gh);

  const ghAuthorize = await request("/api/github/authorize", { token: demo, redirect: "manual" });
  const notConfiguredMsg = String((ghAuthorize.json as { error?: string })?.error ?? "").toLowerCase();
  if (ghAuthorize.status === 302) {
    check("github authorize redirects to GitHub sign-in", (ghAuthorize.location ?? "").startsWith("https://github.com/login/oauth/authorize"), ghAuthorize.location);
  } else {
    check(
      "github authorize handled when unconfigured (400)",
      record(400, ghAuthorize.status) && notConfiguredMsg.includes("not configured"),
      ghAuthorize.json,
    );
  }

  const ghReposAuth = await request("/api/github/repos");
  check("github repos requires auth (401)", record(401, ghReposAuth.status), ghReposAuth.status);

  const ghDisconnect = await request("/api/github/disconnect", { token: demo, method: "POST" });
  check("github disconnect succeeds without a connection", record(200, ghDisconnect.status), ghDisconnect.json);

  const ghCallback = await request("/api/github/callback?code=invalid&state=bogus", { redirect: "manual" });
  check("github callback is public and redirects on bad state", record(302, ghCallback.status), ghCallback.status);

  // --- Google (OAuth) ---
  const googleAuthorize = await request("/api/auth/google", { redirect: "manual" });
  if (googleAuthorize.status === 302) {
    const whereTo = googleAuthorize.location ?? "";
    if (whereTo.includes("accounts.google.com")) {
      check("google authorize redirects to Google", true, googleAuthorize.location);
    } else {
      check(
        "google authorize redirects to login with error when unconfigured",
        whereTo.includes("/login") && whereTo.includes("google_error"),
        whereTo,
      );
    }
  } else {
    const googleErr = String((googleAuthorize.json as { error?: string })?.error ?? "").toLowerCase();
    check(
      "google authorize handled when unconfigured (400)",
      record(400, googleAuthorize.status) && googleErr.includes("not configured"),
      googleAuthorize.json,
    );
  }

  const googleCallback = await request("/api/auth/google/callback?code=invalid&state=bogus", { redirect: "manual" });
  check(
    "google callback is public and redirects on bad state",
    record(302, googleCallback.status) && (googleCallback.location ?? "").includes("/login"),
    googleCallback.location,
  );

  // --- Live events (SSE) ---
  const eventsUnauth = await request("/api/events");
  check("events requires auth (401)", record(401, eventsUnauth.status), eventsUnauth.status);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 2000);
  try {
    const evtRes = await fetch(`${BASE}/api/events`, {
      headers: { cookie: demo },
      redirect: "manual",
      signal: ac.signal,
    });
    const contentType = evtRes.headers.get("content-type") ?? "";
    check(
      "events stream opens for authenticated user",
      record(200, evtRes.status) && contentType.includes("text/event-stream"),
      { status: evtRes.status, contentType },
    );
    evtRes.body?.cancel();
  } catch (err) {
    check("events stream opens for authenticated user", false, String(err));
  } finally {
    clearTimeout(timer);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});