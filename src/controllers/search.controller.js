import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/http.js";

const searchSchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(200),
});

export const globalSearch = asyncHandler(async (req, res) => {
  const { q } = searchSchema.parse(req.query);
  if (q.length === 0) {
    res.json({ query: q, projects: [], tasks: [], endpoints: [], activities: [] });
    return;
  }

  const userId = req.userId;
  const contains = { contains: q };

  const [projects, tasks, endpoints, activities] = await Promise.all([
    prisma.project.findMany({
      where: { userId, OR: [{ name: contains }, { description: contains }] },
      take: 6,
    }),
    prisma.task.findMany({
      where: { userId, OR: [{ title: contains }, { description: contains }] },
      take: 6,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.apiEndpoint.findMany({
      where: { userId, OR: [{ path: contains }, { description: contains }] },
      take: 6,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.activity.findMany({
      where: { userId, description: { contains: q } },
      take: 6,
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  res.json({
    query: q,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      href: `/projects/${p.id}`,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project?.name ?? null,
      href: t.projectId ? `/projects/${t.projectId}?tab=tasks` : "/tasks",
    })),
    endpoints: endpoints.map((e) => ({
      id: e.id,
      method: e.method,
      path: e.path,
      projectId: e.projectId,
      projectName: e.project?.name ?? null,
      href: e.projectId ? `/projects/${e.projectId}?tab=api` : "/apis",
    })),
    activities: activities.map((a) => ({
      id: a.id,
      description: a.description,
      type: a.type,
      projectId: a.projectId,
      href: a.projectId ? `/projects/${a.projectId}?tab=activity` : "/activity",
    })),
  });
});