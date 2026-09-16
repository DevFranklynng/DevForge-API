import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number, now = Date.now()) => new Date(now - d * DAY);
const daysFrom = (d: number, now = Date.now()) => new Date(now + d * DAY);

interface SeedProject {
  name: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  techStack: string[];
  repositoryUrl: string;
  productionUrl: string;
  imageUrl: string | null;
  lastActivityDaysAgo: number;
  tasks: Array<{
    title: string;
    description?: string;
    status: "todo" | "in_progress" | "done";
    priority: "low" | "medium" | "high" | "critical";
    dueInDays?: number;
    completedDaysAgo?: number;
    createdAtDaysAgo: number;
  }>;
  deployments: Array<{
    environment: string;
    status: string;
    buildStatus: string;
    branch: string;
    commit: string;
    commitMessage: string;
    url: string;
    provider: string;
    durationMs: number;
    daysAgo: number;
  }>;
  endpoints: Array<{
    name: string;
    method: string;
    path: string;
    description: string;
    authRequired: boolean;
    statusCode: string;
  }>;
}

const BASE_URL = "https://demo.devforge.app";

const SEED_PROJECTS: SeedProject[] = [
  {
    name: "CampusNest",
    description:
      "Student accommodation platform — search, shortlist and book verified rooms near campus with secure payments and landlord reputation scores.",
    status: "development",
    priority: "high",
    progress: 65,
    techStack: ["TypeScript", "React", "Node.js", "PostgreSQL", "Stripe"],
    repositoryUrl: "https://github.com/devfrank/campusnest",
    productionUrl: "https://campusnest.app",
    imageUrl: null,
    lastActivityDaysAgo: 0,
    tasks: [
      {
        title: "Implement landlord reputation scoring",
        description: "Aggregate review signals into a 0-100 landlord score shown on listings.",
        status: "in_progress",
        priority: "high",
        dueInDays: 3,
        createdAtDaysAgo: 5,
      },
      {
        title: "Add Stripe payout flow for landlords",
        description: "Connect Stripe Connect accounts and schedule weekly payouts.",
        status: "todo",
        priority: "critical",
        dueInDays: 6,
        createdAtDaysAgo: 8,
      },
      {
        title: "Optimize search query latency",
        description: "Current listing search is >800ms at peak. Target sub-200ms.",
        status: "in_progress",
        priority: "medium",
        dueInDays: 10,
        createdAtDaysAgo: 12,
      },
      {
        title: "Design onboarding checklist",
        status: "done",
        priority: "low",
        completedDaysAgo: 4,
        createdAtDaysAgo: 15,
      },
      {
        title: "Set up e2e test suite with Playwright",
        status: "done",
        priority: "medium",
        completedDaysAgo: 9,
        createdAtDaysAgo: 20,
      },
      {
        title: "Fix booking calendar timezone bug",
        status: "done",
        priority: "high",
        completedDaysAgo: 2,
        createdAtDaysAgo: 10,
      },
    ],
    deployments: [
      {
        environment: "production",
        status: "success",
        buildStatus: "success",
        branch: "main",
        commit: "a3f9c21e0d",
        commitMessage: "Add status filter to project list",
        url: "https://campusnest.app",
        provider: "demo",
        durationMs: 142000,
        daysAgo: 1,
      },
      {
        environment: "production",
        status: "success",
        buildStatus: "success",
        branch: "main",
        commit: "7b14da82cf",
        commitMessage: "Fix session expiry race condition",
        url: "https://campusnest.app",
        provider: "demo",
        durationMs: 118000,
        daysAgo: 4,
      },
      {
        environment: "staging",
        status: "failed",
        buildStatus: "failed",
        branch: "feature/reputation",
        commit: "c2e07b1456",
        commitMessage: "Implement task reordering",
        url: "https://staging.campusnest.app",
        provider: "demo",
        durationMs: 96000,
        daysAgo: 2,
      },
    ],
    endpoints: [
      {
        name: "List properties",
        method: "GET",
        path: "/api/v1/properties",
        description: "Returns paged property listings with optional landlord score filter.",
        authRequired: false,
        statusCode: "200",
      },
      {
        name: "Create booking",
        method: "POST",
        path: "/api/v1/bookings",
        description: "Creates a booking request between a student and a landlord listing.",
        authRequired: true,
        statusCode: "201",
      },
      {
        name: "Get landlord score",
        method: "GET",
        path: "/api/v1/landlords/:id/score",
        description: "Returns the aggregated reputation score for a landlord.",
        authRequired: false,
        statusCode: "200",
      },
    ],
  },
  {
    name: "Inspirare",
    description:
      "AI-powered idea journal that turns scattered notes into structured product specs and growth experiments.",
    status: "testing",
    priority: "medium",
    progress: 80,
    techStack: ["TypeScript", "Next.js", "OpenAI API", "Tailwind CSS", "Supabase"],
    repositoryUrl: "https://github.com/devfrank/inspirare",
    productionUrl: "https://inspirare.app",
    imageUrl: null,
    lastActivityDaysAgo: 1,
    tasks: [
      {
        title: "Fuzz-test the spec generator prompts",
        status: "in_progress",
        priority: "high",
        dueInDays: 2,
        createdAtDaysAgo: 4,
      },
      {
        title: "Invite beta testers cohort #2",
        status: "todo",
        priority: "medium",
        dueInDays: 5,
        createdAtDaysAgo: 6,
      },
      {
        title: "Stripe billing avancé plans",
        status: "done",
        priority: "high",
        completedDaysAgo: 3,
        createdAtDaysAgo: 11,
      },
      {
        title: "Dark mode polish pass",
        status: "done",
        priority: "low",
        completedDaysAgo: 7,
        createdAtDaysAgo: 9,
      },
    ],
    deployments: [
      {
        environment: "production",
        status: "success",
        buildStatus: "success",
        branch: "main",
        commit: "e41d9b07cc",
        commitMessage: "Add API endpoint documentation",
        url: "https://inspirare.app",
        provider: "demo",
        durationMs: 98000,
        daysAgo: 3,
      },
      {
        environment: "preview",
        status: "success",
        buildStatus: "success",
        branch: "feature/billing",
        commit: "b5c6a1f290",
        commitMessage: "Optimize dashboard queries",
        url: "https://preview.inspirare.app",
        provider: "demo",
        durationMs: 76000,
        daysAgo: 0,
      },
    ],
    endpoints: [
      {
        name: "Generate spec",
        method: "POST",
        path: "/api/v1/specs/generate",
        description: "Turns a raw idea into a structured product specification.",
        authRequired: true,
        statusCode: "200",
      },
      {
        name: "List experiments",
        method: "GET",
        path: "/api/v1/experiments",
        description: "Lists growth experiments with hypothesis and status.",
        authRequired: true,
        statusCode: "200",
      },
    ],
  },
  {
    name: "SafeCircle",
    description:
      "Community safety network — real-time incident alerts, neighborhood watch check-ins and emergency contact routing.",
    status: "planning",
    priority: "critical",
    progress: 25,
    techStack: ["React Native", "TypeScript", "Firebase", "Google Maps", "Push API"],
    repositoryUrl: "https://github.com/devfrank/safecircle",
    productionUrl: null,
    imageUrl: null,
    lastActivityDaysAgo: 6,
    tasks: [
      {
        title: "Draft emergency routing algorithm",
        status: "in_progress",
        priority: "critical",
        dueInDays: 4,
        createdAtDaysAgo: 2,
      },
      {
        title: "Privacy impact assessment",
        status: "todo",
        priority: "high",
        dueInDays: 14,
        createdAtDaysAgo: 3,
      },
      {
        title: "Produce wireframes for alert flow",
        status: "done",
        priority: "medium",
        completedDaysAgo: 6,
        createdAtDaysAgo: 8,
      },
      {
        title: "Stand up Firebase dev project",
        status: "done",
        priority: "medium",
        completedDaysAgo: 11,
        createdAtDaysAgo: 12,
      },
    ],
    deployments: [],
    endpoints: [
      {
        name: "Report incident",
        method: "POST",
        path: "/api/v1/incidents",
        description: "Creates an incident alert with optional location and severity.",
        authRequired: true,
        statusCode: "201",
      },
      {
        name: "Check-in",
        method: "POST",
        path: "/api/v1/checkins",
        description: "Records a periodic safety check-in for a user's circle.",
        authRequired: true,
        statusCode: "200",
      },
    ],
  },
  {
    name: "F-Mart",
    description:
      "Farm-direct grocery marketplace connecting local producers with urban buyers through weekly delivery routes.",
    status: "live",
    priority: "high",
    progress: 100,
    techStack: ["React", "Express", "MySQL", "Redis", "Twilio"],
    repositoryUrl: "https://github.com/devfrank/fmart",
    productionUrl: "https://fmart.co",
    imageUrl: null,
    lastActivityDaysAgo: 2,
    tasks: [
      {
        title: "Monitor Black Friday traffic scaling",
        status: "in_progress",
        priority: "high",
        dueInDays: 8,
        createdAtDaysAgo: 1,
      },
      {
        title: "AR order refund workflow",
        status: "done",
        priority: "medium",
        completedDaysAgo: 1,
        createdAtDaysAgo: 9,
      },
      {
        title: "Add SMS order updates",
        status: "done",
        priority: "medium",
        completedDaysAgo: 5,
        createdAtDaysAgo: 14,
      },
      {
        title: "Migrate inventory API to v2",
        status: "done",
        priority: "high",
        completedDaysAgo: 12,
        createdAtDaysAgo: 20,
      },
    ],
    deployments: [
      {
        environment: "production",
        status: "success",
        buildStatus: "success",
        branch: "main",
        commit: "9f3a8c4d21",
        commitMessage: "Update deployment pipeline config",
        url: "https://fmart.co",
        provider: "demo",
        durationMs: 97000,
        daysAgo: 2,
      },
      {
        environment: "production",
        status: "success",
        buildStatus: "success",
        branch: "main",
        commit: "b5c6a1f290",
        commitMessage: "Refactor notification service",
        url: "https://fmart.co",
        provider: "demo",
        durationMs: 110000,
        daysAgo: 6,
      },
    ],
    endpoints: [
      {
        name: "List products",
        method: "GET",
        path: "/api/v1/products",
        description: "Returns the product catalogue with stock levels.",
        authRequired: false,
        statusCode: "200",
      },
      {
        name: "Place order",
        method: "POST",
        path: "/api/v1/orders",
        description: "Places an order with items, route and payment token.",
        authRequired: true,
        statusCode: "201",
      },
      {
        name: "Get delivery routes",
        method: "GET",
        path: "/api/v1/routes/today",
        description: "Lists today's delivery routes for a sortation center.",
        authRequired: true,
        statusCode: "200",
      },
    ],
  },
  {
    name: "DevFrank Portfolio",
    description:
      "Personal portfolio and engineering blog — project case studies, writing and a living tech-radar page.",
    status: "live",
    priority: "low",
    progress: 100,
    techStack: ["Astro", "TypeScript", "Markdown", "Netlify"],
    repositoryUrl: "https://github.com/devfrank/devfrank-portfolio",
    productionUrl: "https://devfrank.dev",
    imageUrl: null,
    lastActivityDaysAgo: 1,
    tasks: [
      {
        title: "Write case study for CampusNest",
        status: "in_progress",
        priority: "medium",
        dueInDays: 6,
        createdAtDaysAgo: 2,
      },
      {
        title: "Publish blog post: Prisma on SQLite vs Postgres",
        status: "done",
        priority: "low",
        completedDaysAgo: 3,
        createdAtDaysAgo: 8,
      },
      {
        title: "Add RSS feed for blog",
        status: "done",
        priority: "low",
        completedDaysAgo: 8,
        createdAtDaysAgo: 10,
      },
    ],
    deployments: [
      {
        environment: "production",
        status: "success",
        buildStatus: "success",
        branch: "main",
        commit: "c2e07b1456",
        commitMessage: "Refactor notification service",
        url: "https://devfrank.dev",
        provider: "demo",
        durationMs: 52000,
        daysAgo: 3,
      },
    ],
    endpoints: [],
  },
];

async function main() {
  console.log("[seed] starting...");

  const password = await hashPassword("devforge123");
  const existing = await prisma.user.findUnique({ where: { email: "demo@devforge.dev" } });
  if (existing) {
    console.log("[seed] demo user already exists — clearing previous data.");
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: {
      name: "Dana Devlin",
      email: "demo@devforge.dev",
      password,
      settings: {
        create: {
          theme: "dark",
          workspaceName: "DevForge Workspace",
          defaultProjectView: "board",
        },
      },
    },
  });

  const now = Date.now();

  for (const p of SEED_PROJECTS) {
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        techStack: JSON.stringify(p.techStack),
        repositoryUrl: p.repositoryUrl,
        productionUrl: p.productionUrl,
        imageUrl: p.imageUrl,
        lastActivityAt: daysAgo(p.lastActivityDaysAgo, now),
        createdAt: daysAgo(45 + Math.floor(Math.random() * 20), now),
      },
    });

    for (const task of p.tasks) {
      const completed =
        task.status === "done" ? daysAgo(task.completedDaysAgo ?? 1, now) : null;
      await prisma.task.create({
        data: {
          userId: user.id,
          projectId: project.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.status === "done" ? null : daysFrom(task.dueInDays ?? 7, now),
          completedAt: completed,
          createdAt: daysAgo(task.createdAtDaysAgo, now),
        },
      });
    }

    for (const d of p.deployments) {
      await prisma.deployment.create({
        data: {
          userId: user.id,
          projectId: project.id,
          environment: d.environment,
          status: d.status,
          buildStatus: d.buildStatus,
          branch: d.branch,
          commit: d.commit,
          commitMessage: d.commitMessage,
          url: d.url,
          provider: d.provider,
          durationMs: d.durationMs,
          finishedAt: d.status === "building" ? null : daysAgo(d.daysAgo, now),
          createdAt: daysAgo(d.daysAgo, now),
        },
      });
    }

    if (p.repositoryUrl) {
      const url = new URL(p.repositoryUrl);
      const [, owner, name] = url.pathname.split("/");
      const repo = await prisma.repository.create({
        data: {
          userId: user.id,
          projectId: project.id,
          name: name ?? p.name,
          owner: owner ?? "devfrank",
          description: `Source repository for ${p.name}`,
          branch: "main",
          visibility: "public",
          stars: p.name === "CampusNest" ? 128 : 14 + Math.floor(Math.random() * 60),
          forks: p.name === "CampusNest" ? 23 : 2 + Math.floor(Math.random() * 14),
          openIssues: 3 + Math.floor(Math.random() * 8),
          lastCommit: daysAgo(Math.max(0, p.lastActivityDaysAgo - 1), now),
          url: p.repositoryUrl,
          source: "demo",
        },
      });
      await prisma.activity.create({
        data: {
          userId: user.id,
          projectId: project.id,
          type: "REPOSITORY_CONNECTED",
          description: `Connected repository ${repo.owner}/${repo.name}`,
          resourceType: "repository",
          resourceId: repo.id,
          createdAt: daysAgo(30, now),
        },
      });
    }

    for (const e of p.endpoints) {
      await prisma.apiEndpoint.create({
        data: {
          userId: user.id,
          projectId: project.id,
          name: e.name,
          method: e.method,
          path: e.path,
          description: e.description,
          authRequired: e.authRequired,
          statusCode: e.statusCode,
          parameters: JSON.stringify([
            { name: "limit", type: "integer", required: false, description: "Page size" },
            { name: "cursor", type: "string", required: false, description: "Pagination cursor" },
          ]),
          requestBody: e.method === "GET" ? undefined : "{\n  \"example\": true\n}",
          responseExample:
            e.method === "GET"
              ? '{\n  "data": [],\n  "meta": { "nextCursor": null }\n}'
              : '{\n  "id": "ckx123",\n  "status": "created"\n}',
        },
      });
    }

    const activityRows = [
      { type: "PROJECT_CREATED", description: `Created project "${p.name}"`, days: 40 + Math.floor(Math.random() * 10) },
      { type: "TASK_COMPLETED", description: `Completed task in ${p.name}`, days: Math.max(1, p.lastActivityDaysAgo + 1) },
      { type: "TASK_CREATED", description: `Added new task to ${p.name}`, days: Math.max(0, p.lastActivityDaysAgo - 1) },
    ];
    for (const a of activityRows) {
      await prisma.activity.create({
        data: {
          userId: user.id,
          projectId: project.id,
          type: a.type,
          description: a.description,
          createdAt: daysAgo(a.days, now),
        },
      });
    }
  }

  await prisma.activity.create({
    data: {
      userId: user.id,
      type: "PROFILE_UPDATED",
      description: "Updated the workspace profile and preferences",
      createdAt: daysAgo(2, now),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        projectId: null,
        type: "system",
        title: "Welcome to DevForge",
        message: "A developer command center for projects, tasks and deployments.",
        isRead: false,
        createdAt: daysAgo(1, now),
      },
      {
        userId: user.id,
        projectId: (await prisma.project.findFirst({ where: { name: "CampusNest" } }))?.id,
        type: "deployment_failed",
        title: "Deployment failed for CampusNest",
        message: "The build for commit c2e07b1456 failed. Check the build logs.",
        isRead: false,
        createdAt: daysAgo(2, now),
      },
      {
        userId: user.id,
        projectId: (await prisma.project.findFirst({ where: { name: "Inspirare" } }))?.id,
        type: "deployment_success",
        title: "Inspirare is live in preview",
        message: "Commit b5c6a1f290 deployed successfully.",
        isRead: true,
        createdAt: daysAgo(1, now),
      },
      {
        userId: user.id,
        projectId: (await prisma.project.findFirst({ where: { name: "SafeCircle" } }))?.id,
        type: "project_attention",
        title: "SafeCircle needs attention",
        message: "2 open task(s), no activity for 6 day(s).",
        isRead: false,
        createdAt: daysAgo(0, now),
      },
    ],
  });

  console.log("[seed] done.");
  console.log("");
  console.log("  Demo account:");
  console.log("    email:    demo@devforge.dev");
  console.log("    password: devforge123");
  console.log("");
  console.log("[seed] Scripts: npm run db:push && npm run db:seed (see README).");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("[seed] failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });