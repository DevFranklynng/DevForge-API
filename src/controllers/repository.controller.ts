import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../services/activity.js";
import { syncGitHubRepo, getUserToken } from "../services/github.js";
import { broadcastResource } from "../services/events.js";
import { asyncHandler, NotFoundError } from "../utils/http.js";

export const repoSchema = z.object({
  name: z.string().trim().min(1, "Repository name is required").max(120),
  owner: z.string().trim().max(120).default(""),
  description: z.string().trim().max(1000).nullable().optional(),
  branch: z.string().trim().max(80).default("main"),
  visibility: z.enum(["private", "public"]).default("private"),
  stars: z.number().int().min(0).default(0),
  forks: z.number().int().min(0).default(0),
  openIssues: z.number().int().min(0).default(0),
  lastCommit: z.string().datetime().nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
  projectId: z.string().nullable().optional(),
  sync: z.boolean().default(false),
});

const listSchema = z.object({
  projectId: z.string().optional(),
  source: z.string().optional(),
});

async function ensureProjectOwned(userId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw NotFoundError("Project not found");
}

export const listRepositories = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, source } = listSchema.parse(req.query);
  const where: Record<string, unknown> = { userId: req.userId! };
  if (projectId) where.projectId = projectId;
  if (source) where.source = source;

  const repositories = await prisma.repository.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { id: true, name: true } } },
  });

  res.json({ repositories });
});

export const getRepository = asyncHandler(async (req: Request, res: Response) => {
  const repo = await prisma.repository.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!repo) throw NotFoundError("Repository not found");
  res.json({ repository: repo });
});

export const connectRepository = asyncHandler(async (req: Request, res: Response) => {
  const data = repoSchema.parse(req.body);
  await ensureProjectOwned(req.userId!, data.projectId);

  let payload = {
    name: data.name,
    owner: data.owner,
    description: data.description ?? null,
    branch: data.branch,
    visibility: data.visibility,
    stars: data.stars,
    forks: data.forks,
    openIssues: data.openIssues,
    lastCommit: data.lastCommit ? new Date(data.lastCommit) : null,
    url: data.url ?? null,
  };

  const token = await getUserToken(req.userId!);
  const synced = data.sync ? await syncGitHubRepo(payload, token) : null;

  const repository = await prisma.repository.create({
    data: {
      userId: req.userId!,
      projectId: data.projectId ?? null,
      ...payload,
      source: synced ? synced.source : "manual",
      ...(synced ? { name: synced.name, owner: synced.owner, description: synced.description, branch: synced.branch, visibility: synced.visibility, stars: synced.stars, forks: synced.forks, openIssues: synced.openIssues, lastCommit: synced.lastCommit, url: synced.url } : {}),
    },
    include: { project: { select: { id: true, name: true } } },
  });

  await logActivity({
    userId: req.userId!,
    type: "REPOSITORY_CONNECTED",
    description: `Connected repository ${data.owner ? `${data.owner}/` : ""}${data.name}${
      repository.project ? ` to ${repository.project.name}` : ""
    }`,
    projectId: repository.projectId,
    resourceType: "repository",
    resourceId: repository.id,
    details: { source: repository.source },
  });

  res.status(201).json({ repository });
  broadcastResource(req.userId!, "repositories");
});

export const updateRepository = asyncHandler(async (req: Request, res: Response) => {
  const data = repoSchema.parse(req.body);
  const existing = await prisma.repository.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Repository not found");
  await ensureProjectOwned(req.userId!, data.projectId ?? existing.projectId);

  const repository = await prisma.repository.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      owner: data.owner,
      description: data.description === undefined ? undefined : data.description,
      branch: data.branch,
      visibility: data.visibility,
      stars: data.stars,
      forks: data.forks,
      openIssues: data.openIssues,
      lastCommit: data.lastCommit === undefined ? undefined : data.lastCommit ? new Date(data.lastCommit) : null,
      url: data.url === undefined ? undefined : data.url,
      projectId: data.projectId === undefined ? existing.projectId : data.projectId,
      updatedAt: new Date(),
    },
  });

  await logActivity({
    userId: req.userId!,
    type: "REPOSITORY_UPDATED",
    description: `Updated repository ${data.owner ? `${data.owner}/` : ""}${data.name}`,
    projectId: repository.projectId,
    resourceType: "repository",
    resourceId: repository.id,
  });

  res.json({ repository });
  broadcastResource(req.userId!, "repositories");
});

export const deleteRepository = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.repository.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Repository not found");

  await prisma.repository.delete({ where: { id: existing.id } });

  await logActivity({
    userId: req.userId!,
    type: "REPOSITORY_UPDATED",
    description: `Removed repository ${existing.owner ? `${existing.owner}/` : ""}${existing.name}`,
    projectId: existing.projectId,
    resourceType: "repository",
    resourceId: existing.id,
  });

  res.json({ ok: true });
  broadcastResource(req.userId!, "repositories");
});