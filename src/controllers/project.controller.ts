import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isOf, PROJECT_PRIORITIES, PROJECT_STATUSES } from "../models/domain.js";
import { logActivity } from "../services/activity.js";
import { broadcastResource } from "../services/events.js";
import { asyncHandler, BadRequestError, NotFoundError } from "../utils/http.js";
import { jsonParse, jsonStringify } from "../utils/format.js";

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.string().refine((v) => isOf(PROJECT_STATUSES, v), "Invalid status").optional(),
    priority: z.string().refine((v) => isOf(PROJECT_PRIORITIES, v), "Invalid priority").optional(),
    progress: z.number().int().min(0).max(100).optional(),
    techStack: z.array(z.string().trim().max(40)).max(20).optional(),
    repositoryUrl: z.string().trim().max(500).nullable().optional(),
    productionUrl: z.string().trim().max(500).nullable().optional(),
    imageUrl: z.string().trim().max(500).nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
  })
  .partial();

export const listSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  sort: z.enum(["recent", "name", "progress", "priority"]).default("recent"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const projectListInclude = {
  tasks: { select: { status: true, id: true } },
  _count: { select: { deployments: true, apiEndpoints: true } },
};

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const { q, status, sort, limit } = listSchema.parse(req.query);
  const userId = req.userId!;

  const where: Record<string, unknown> = { userId };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
    ];
  }
  if (status && status !== "all") where.status = status;

  const orderBy =
    sort === "name"
      ? { name: "asc" as const }
      : sort === "progress"
        ? [{ status: "asc" as const }, { progress: "desc" as const }]
        : sort === "priority"
          ? [{ priority: "asc" as const }]
          : { lastActivityAt: "desc" as const };

  const projects = await prisma.project.findMany({
    where,
    orderBy,
    include: projectListInclude,
    take: limit,
  });

  const rows = projects.map((p) => {
    const techStack = jsonParse(p.techStack, []) as string[];
    const openTasks = p.tasks.filter((t) => t.status !== "done").length;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      techStack,
      repositoryUrl: p.repositoryUrl,
      productionUrl: p.productionUrl,
      dueDate: p.dueDate,
      lastActivityAt: p.lastActivityAt,
      createdAt: p.createdAt,
      openTasks,
      totalTasks: p.tasks.length,
      deploymentCount: p._count.deployments,
      apiCount: p._count.apiEndpoints,
    };
  });

  res.json({ projects: rows, total: rows.length });
});

const getProjectOwned = async (userId: string, id: string) => {
  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      tasks: { orderBy: { createdAt: "desc" } },
      repositories: { orderBy: { updatedAt: "desc" } },
      apiEndpoints: { orderBy: { createdAt: "desc" } },
      deployments: { orderBy: { createdAt: "desc" } },
    },
  });
  return project;
};

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await getProjectOwned(req.userId!, req.params.id);
  if (!project) throw NotFoundError("Project not found");

  const techStack = jsonParse(project.techStack, []) as string[];
  res.json({
    project: {
      ...project,
      techStack,
      openTasks: project.tasks.filter((t) => t.status !== "done").length,
    },
  });
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const data = projectSchema.parse(req.body);

  const project = await prisma.project.create({
    data: {
      userId: req.userId!,
      name: data.name!,
      description: data.description ?? null,
      status: data.status ?? "planning",
      priority: data.priority ?? "medium",
      progress: data.progress ?? 0,
      techStack: jsonStringify(data.techStack ?? []),
      repositoryUrl: data.repositoryUrl ?? null,
      productionUrl: data.productionUrl ?? null,
      imageUrl: data.imageUrl ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });

  await logActivity({
    userId: req.userId!,
    type: "PROJECT_CREATED",
    description: `Created project "${project.name}"`,
    projectId: project.id,
    resourceType: "project",
    resourceId: project.id,
  });

  res.status(201).json({ project });
  broadcastResource(req.userId!, "projects");
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const data = projectSchema.parse(req.body);
  const existing = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Project not found");

  const changedFields: string[] = [];
  if (data.status && data.status !== existing.status) changedFields.push(`status to "${data.status}"`);
  if (data.progress !== undefined && data.progress !== existing.progress) changedFields.push(`progress to ${data.progress}%`);
  if (data.name && data.name !== existing.name) changedFields.push("name");

  const project = await prisma.project.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      description: data.description === undefined ? undefined : data.description,
      status: data.status,
      priority: data.priority,
      progress: data.progress,
      techStack: data.techStack !== undefined ? jsonStringify(data.techStack) : undefined,
      repositoryUrl: data.repositoryUrl === undefined ? undefined : data.repositoryUrl,
      productionUrl: data.productionUrl === undefined ? undefined : data.productionUrl,
      imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      lastActivityAt: new Date(),
    },
  });

  await logActivity({
    userId: req.userId!,
    type: "PROJECT_UPDATED",
    description: changedFields.length
      ? `Updated ${existing.name}: changed ${changedFields.join(", ")}`
      : `Updated ${existing.name}`,
    projectId: existing.id,
    resourceType: "project",
    resourceId: existing.id,
  });

  res.json({ project });
  broadcastResource(req.userId!, "projects");
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Project not found");

  await prisma.project.delete({ where: { id: existing.id } });

  await logActivity({
    userId: req.userId!,
    type: "PROJECT_ARCHIVED",
    description: `Deleted project "${existing.name}"`,
    resourceType: "project",
    resourceId: existing.id,
  });

  res.json({ ok: true });
  broadcastResource(req.userId!, "projects");
});