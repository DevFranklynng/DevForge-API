import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isOf, TASK_PRIORITIES, TASK_STATUSES } from "../models/domain.js";
import { logActivity } from "../services/activity.js";
import { broadcastResource } from "../services/events.js";
import { asyncHandler, BadRequestError, NotFoundError } from "../utils/http.js";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(3000).nullable().optional(),
  status: z.string().refine((v) => isOf(TASK_STATUSES, v), "Invalid status").optional(),
  priority: z.string().refine((v) => isOf(TASK_PRIORITIES, v), "Invalid priority").optional(),
  dueDate: z.string().datetime().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

export const taskListSchema = z.object({
  projectId: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
});

async function recomputeProjectProgress(projectId: string | null) {
  if (!projectId) return;
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { status: true },
  });
  if (tasks.length === 0) return;
  const done = tasks.filter((t) => t.status === "done").length;
  const progress = Math.round((done / tasks.length) * 100);
  await prisma.project
    .update({
      where: { id: projectId },
      data: { progress, lastActivityAt: new Date() },
    })
    .catch(() => undefined);
}

function taskView(t: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  projectId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    projectId: t.projectId,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, status, q } = taskListSchema.parse(req.query);
  const userId = req.userId!;

  const where: Record<string, unknown> = { userId };
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw NotFoundError("Project not found");
    where.projectId = projectId;
  }
  if (status && status !== "all") where.status = status;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    include: { project: { select: { id: true, name: true, status: true } } },
  });

  res.json({ tasks: tasks.map((t) => ({ ...taskView(t), project: t.project })) });
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const data = taskSchema.parse(req.body);

  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, userId: req.userId! },
    });
    if (!project) throw NotFoundError("Project not found");
  }

  const completedAt =
    data.status === "done" ? new Date() : null;

  const task = await prisma.task.create({
    data: {
      userId: req.userId!,
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completedAt,
    },
  });

  await recomputeProjectProgress(task.projectId);

  const project = task.projectId
    ? await prisma.project.findUnique({ where: { id: task.projectId } })
    : null;

  await logActivity({
    userId: req.userId!,
    type: "TASK_CREATED",
    description: `Created task "${task.title}"${project ? ` in ${project.name}` : ""}`,
    projectId: task.projectId,
    resourceType: "task",
    resourceId: task.id,
  });

  res.status(201).json({ task: taskView(task) });
  broadcastResource(req.userId!, "tasks");
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const data = taskSchema.parse(req.body);
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Task not found");

  if (data.projectId !== undefined && data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, userId: req.userId! },
    });
    if (!project) throw NotFoundError("Project not found");
  }

  const statusChanged = data.status && data.status !== existing.status;
  const nextStatus: string | undefined = data.status;
  const completedAt =
    nextStatus === "done"
      ? existing.completedAt ?? new Date()
      : nextStatus && nextStatus !== "done"
        ? null
        : undefined;

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description === undefined ? undefined : data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      projectId: data.projectId === undefined ? undefined : data.projectId,
      completedAt,
    },
  });

  await recomputeProjectProgress(task.projectId);
  if (existing.projectId && existing.projectId !== task.projectId) {
    await recomputeProjectProgress(existing.projectId);
  }

  if (statusChanged) {
    if (task.status === "done") {
      await logActivity({
        userId: req.userId!,
        type: "TASK_COMPLETED",
        description: `Completed task "${task.title}"`,
        projectId: task.projectId,
        resourceType: "task",
        resourceId: task.id,
      });
    } else {
      await logActivity({
        userId: req.userId!,
        type: "TASK_UPDATED",
        description: `Moved task "${task.title}" to ${task.status.replace("_", " ")}`,
        projectId: task.projectId,
        resourceType: "task",
        resourceId: task.id,
      });
    }
  } else {
    await logActivity({
      userId: req.userId!,
      type: "TASK_UPDATED",
      description: `Updated task "${task.title}"`,
      projectId: task.projectId,
      resourceType: "task",
      resourceId: task.id,
    });
  }

  res.json({ task: taskView(task) });
  broadcastResource(req.userId!, "tasks");
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Task not found");

  await prisma.task.delete({ where: { id: existing.id } });
  await recomputeProjectProgress(existing.projectId);

  await logActivity({
    userId: req.userId!,
    type: "TASK_DELETED",
    description: `Deleted task "${existing.title}"`,
    projectId: existing.projectId,
    resourceType: "task",
    resourceId: existing.id,
  });

  res.json({ ok: true });
  broadcastResource(req.userId!, "tasks");
});