import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/http.js";
import { jsonParse } from "../utils/format.js";

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const userId = _req.userId!;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    projects,
    openTaskCount,
    completedTasks30d,
    recentActivity,
    recentDeployments,
    tasksDue,
    deploymentStats,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      include: { tasks: { select: { status: true, id: true } } },
      orderBy: { lastActivityAt: "desc" },
      take: 8,
    }),
    prisma.task.count({ where: { userId, status: { not: "done" } } }),
    prisma.task.count({ where: { userId, completedAt: { gte: thirtyDaysAgo } } }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.deployment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "done" }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.deployment.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
  ]);

  const activeProjects = projects.filter((p) =>
    ["planning", "development", "testing"].includes(p.status),
  ).length;
  const liveProjects = projects.filter((p) => p.status === "live").length;

  const totalDeploys = deploymentStats.reduce((sum, d) => sum + d._count._all, 0);
  const successDeploys =
    deploymentStats.find((d) => d.status === "success")?._count._all ?? 0;
  const deploySuccessRate =
    totalDeploys > 0 ? Math.round((successDeploys / totalDeploys) * 100) : 0;

  res.json({
    overview: {
      totalProjects: projects.length,
      activeProjects,
      liveProjects,
      openTasks: openTaskCount,
    },
    pulse: {
      completedTasks30d,
      openTasks: openTaskCount,
      projectsInDevelopment: activeProjects,
      deploySuccessRate,
      totalDeployments: totalDeploys,
    },
    activeProjects: projects.slice(0, 6).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      techStack: jsonParse(p.techStack, []) as string[],
      lastActivityAt: p.lastActivityAt,
      openTasks: p.tasks.filter((t) => t.status !== "done").length,
      totalTasks: p.tasks.length,
      productionUrl: p.productionUrl,
    })),
    focusTasks: tasksDue.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      projectId: t.projectId,
      project: t.project,
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      projectId: a.projectId,
      project: a.project,
      createdAt: a.createdAt,
    })),
    deployments: recentDeployments.map((d) => ({
      id: d.id,
      environment: d.environment,
      status: d.status,
      branch: d.branch,
      commit: d.commit,
      provider: d.provider,
      durationMs: d.durationMs,
      createdAt: d.createdAt,
      projectId: d.projectId,
      project: d.project,
    })),
  });
});