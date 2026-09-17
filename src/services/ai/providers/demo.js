import { titleCase } from "../../../utils/format.js";

function matchAny(text, keywords) {
  return keywords.some((k) => text.includes(k));
}

function listTaskBullets(ctx) {
  if (ctx.tasksDueSoon.length === 0) return "No tasks are due in the next two days.";
  return ctx.tasksDueSoon
    .map(
      (t) =>
        `- **${t.title}** (${titleCase(t.priority)} priority)${t.dueDate ? ` · due ${t.dueDate}` : ""}${t.projectId ? ` · [project](/projects/${t.projectId})` : ""}`,
    )
    .join("\n");
}

function attentionProjects(ctx) {
  const stale = ctx.projects.filter((p) => p.openTasks > 0 && p.lastActivityDaysAgo > 4);
  if (stale.length === 0) return "No projects currently need attention. All active projects have recent activity.";
  return stale
    .map((p) => `- **${p.name}** · ${p.openTasks} open task(s), last activity ${p.lastActivityDaysAgo} day(s) ago · status \`${p.status}\``)
    .join("\n");
}

export class DemoProvider {
  id = "demo";

  isAvailable() {
    return true;
  }

  async ask(request, ctx) {
    const text = request.message.toLowerCase();
    const base = {
      isDemo: true,
      providerUsed: "demo-engine",
      actions: [],
      sources: [],
    };

    if (matchAny(text, ["auth", "login", "password", "session", "401", "403"])) {
      return {
        ...base,
        confidence: 0.72,
        severity: "medium",
        content: [
          `## Authentication troubleshooting`,
          ``,
          `Let's look at the most common auth failure points in your workspace:`,
          ``,
          `1. **Password hashing** — DevForge hashes passwords with bcrypt (cost 12) before they touch the database. A plaintext password in the DB almost always means the hash step was skipped.`,
          `2. **Session handling** — Sessions are stored as SHA-256 hashes of an opaque random token in an \`httpOnly\` cookie (\`df_session\`). If you changed \`SESSION_SECRET\` after login, or the cookie is missing a \`SameSite\` value for the cross-origin client, sessions will silently fail.`,
          `3. **401 vs 403** — a \`401\` means "no/invalid session"; a \`403\` means the session exists but the resource isn't owned by this user. Every query in this workspace is scoped to \`userId\`.`,
          ``,
          `### Suggested actions`,
          `- Confirm the register/login response returns a \`Set-Cookie\` header`,
          `- Verify \`VITE\` client is reachable through the Vite proxy (no CORS preflight for cookies)`,
          `- Check the \`SESSION_SECRET\` is stable across restarts`,
          ``,
          `Would you like the checklist to be wired to an automated health check?`,
        ].join("\n"),
        actions: [
          { label: "Open Security settings", href: "/settings?tab=security", type: "navigate" },
          { label: "Review session endpoints", href: "/apis", type: "navigate" },
        ],
      };
    }

    if (matchAny(text, ["work on next", "next", "focus", "priority"]) && !matchAny(text, ["which project"])) {
      return {
        ...base,
        confidence: 0.81,
        severity: "low",
        content: [
          `## What to work on next`,
          ``,
          `Based on due dates, priority and completion state across your workspace:`,
          ``,
          listTaskBullets(ctx),
          ``,
          `### Reasoning`,
          `High and critical priority items with due dates inside the next 2 days are surfaced first. Completing them will also move their project's progress forward, since progress is derived from task completion when tasks exist.`,
        ].join("\n"),
        actions: [
          { label: "Open task board", href: "/tasks", type: "navigate" },
          { label: "Open dashboard focus", href: "/dashboard", type: "navigate" },
        ],
      };
    }

    if (matchAny(text, ["attention", "risk", "behind", "blocker", "blockchain"])) {
      const blockers = ctx.projects.filter((p) => p.openTasks > 0 && (p.status === "paused" || p.lastActivityDaysAgo > 6));
      return {
        ...base,
        confidence: 0.68,
        severity: "high",
        content: [
          `## Potential blockers`,
          ``,
          blockers.length
            ? blockers
                .map(
                  (p) =>
                    `- **${p.name}** — ${p.status === "paused" ? "paused" : `no activity for ${p.lastActivityDaysAgo} days`} with ${p.openTasks} open task(s). Likely to slip.`,
                )
                .join("\n")
            : attentionProjects(ctx),
          ``,
          `### Recommended response`,
          `Re-open or de-block the stalled item, then re-estimate the affected milestone. The activity feed will confirm whether the project is receiving commits again.`,
        ].join("\n"),
        actions: [
          { label: "Review stalled projects", href: "/projects", type: "navigate" },
          { label: "View activity", href: "/activity", type: "navigate" },
        ],
      };
    }

    if (matchAny(text, ["summar", "summary", "recap", "week", "activity"])) {
      return {
        ...base,
        confidence: 0.85,
        severity: "low",
        content: [
          `## Development summary`,
          ``,
          `Across **${ctx.stats.totalProjects} projects** (${ctx.stats.activeProjects} active):`,
          ``,
          `- ${ctx.stats.completedTasks30d} task(s) completed in the last 30 days`,
          `- ${ctx.stats.openTasks} task(s) still open`,
          `- Deployment success rate: **${ctx.stats.deploySuccessRate}%**`,
          ``,
          `### Recent activity`,
          ``,
          ctx.recentActivity.slice(0, 5).map((a) => `- ${a}`).join("\n") || "- No activity recorded yet.",
        ].join("\n"),
        actions: [{ label: "Open activity feed", href: "/activity", type: "navigate" }],
      };
    }

    if (matchAny(text, ["which project", "project that need", "attention"])) {
      return {
        ...base,
        confidence: 0.77,
        severity: "medium",
        content: [
          `## Projects needing attention`,
          ``,
          attentionProjects(ctx),
          ``,
          `Projects are flagged when they have open tasks but the last activity was more than 4 days ago.`,
        ].join("\n"),
        actions: [{ label: "Open projects", href: "/projects", type: "navigate" }],
      };
    }

    if (matchAny(text, ["deploy", "production", "release"])) {
      return {
        ...base,
        confidence: 0.74,
        severity: ctx.failingDeployments.length > 0 ? "high" : "low",
        content: [
          `## Deployment status`,
          ``,
          ctx.failingDeployments.length
            ? `The following recent deployments failed:\n\n${ctx.failingDeployments
                .map((d) => `- **${d.projectName}** · ${d.environment}`)
                .join("\n")}`
            : "No recent failed deployments. Your deployment success rate looks healthy.",
          ``,
          `Keep in mind: while no external provider is configured, deployment records are simulated and are clearly labelled as demo data.`,
        ].join("\n"),
        actions: [{ label: "Open deployments", href: "/deployments", type: "navigate" }],
      };
    }

    return {
      ...base,
      confidence: 0.6,
      severity: "low",
      content: [
        `## Workspace analysis`,
        ``,
        `Here's the current state of your workspace:`,
        ``,
        `- ${ctx.stats.totalProjects} projects across your workspace`,
        `- ${ctx.stats.activeProjects} actively in progress`,
        `- ${ctx.stats.openTasks} open tasks (${ctx.stats.completedTasks30d} completed in the last 30 days)`,
        `- Deployments are succeeding at a **${ctx.stats.deploySuccessRate}%** rate`,
        ``,
        `### How to make me more useful`,
        `Ask things like:`,
        `- "Why is this project behind schedule?"`,
        `- "Show me the projects that need attention."`,
        `- "What should I work on next?"`,
        `- "Summarize my development activity."`,
      ].join("\n"),
      actions: [
        { label: "Open dashboard", href: "/dashboard", type: "navigate" },
        { label: "Open tasks", href: "/tasks", type: "navigate" },
      ],
    };
  }
}
