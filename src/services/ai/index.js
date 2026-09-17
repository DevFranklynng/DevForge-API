import { prisma } from "../../lib/prisma.js";
import { DemoProvider } from "./providers/demo.js";
import { OpenAICompatProvider } from "./providers/openai.js";

const providers = [new OpenAICompatProvider(), new DemoProvider()];

async function buildContext(userId, projectId) {
  const projects = await prisma.project.findMany({
    where: { userId, ...(projectId ? { id: projectId } : {}) },
    include: { tasks: true },
  });

  const now = Date.now();
  const today = new Date(new Date(now).setHours(0, 0, 0, 0));
  const horizon = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const tasksDueSoon = await prisma.task.findMany({
    where: {
      userId,
      status: { not: "done" },
      dueDate: { gte: today, lte: horizon },
    },
    include: { project: true },
    orderBy: { dueDate: "asc" },
    take: 8,
  });

  const failingDeployments = await prisma.deployment.findMany({
    where: { userId, status: "failed" },
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const recentActivityRows = await prisma.activity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const [openTaskCount, completed30d, deploymentStats] = await Promise.all([
    prisma.task.count({ where: { userId, status: { not: "done" } } }),
    prisma.task.count({ where: { userId, completedAt: { gte: thirtyDaysAgo } } }),
    prisma.deployment.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const totalDeploys = deploymentStats.reduce((sum, d) => sum + d._count._all, 0);
  const successDeploys =
    deploymentStats.find((d) => d.status === "success")?._count._all ?? 0;
  const deploySuccessRate = totalDeploys > 0 ? Math.round((successDeploys / totalDeploys) * 100) : 0;

  return {
    projects: projects.map((p) => {
      const openTasks = p.tasks.filter((t) => t.status !== "done").length;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        progress: p.progress,
        openTasks,
        totalTasks: p.tasks.length,
        lastActivityDaysAgo: Math.max(0, Math.floor((now - p.lastActivityAt.getTime()) / 86400000)),
      };
    }),
    tasksDueSoon: tasksDueSoon.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      priority: t.priority,
    })),
    failingDeployments: failingDeployments.map((d) => ({
      id: d.id,
      projectName: d.project?.name ?? "Unknown project",
      environment: d.environment,
    })),
    recentActivity: recentActivityRows.map((a) => a.description),
    stats: {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) =>
        ["planning", "development", "testing"].includes(p.status),
      ).length,
      openTasks: openTaskCount,
      completedTasks30d: completed30d,
      deploySuccessRate,
    },
    blockedFlag: failingDeployments.length > 0,
  };
}

export async function askAi(request) {
  const context = await buildContext(request.userId, request.projectId);

  const configured = providers.find((p) => p.isAvailable());
  const demo = providers[providers.length - 1];

  try {
    return await (configured ?? demo).ask(request, context);
  } catch (err) {
    if (configured === demo) throw err;
    return demo.ask(request, context);
  }
}

export { providers, buildContext };
