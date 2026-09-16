import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { API_METHODS, isOf } from "../models/domain.js";
import { logActivity } from "../services/activity.js";
import { asyncHandler, NotFoundError } from "../utils/http.js";
import { jsonParse, jsonStringify } from "../utils/format.js";

export const endpointSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  method: z
    .string()
    .refine((v) => isOf(API_METHODS, v), "Invalid HTTP method")
    .default("GET"),
  path: z.string().trim().min(1, "Endpoint path is required").max(500),
  description: z.string().trim().max(2000).nullable().optional(),
  authRequired: z.boolean().default(false),
  parameters: z.array(z.any()).default([]),
  requestBody: z.string().trim().max(8000).nullable().optional(),
  responseExample: z.string().trim().max(8000).nullable().optional(),
  statusCode: z.string().trim().max(12).default("200"),
  projectId: z.string().nullable().optional(),
});

const listSchema = z.object({ projectId: z.string().optional(), method: z.string().optional() });

async function ensureProjectOwned(userId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw NotFoundError("Project not found");
}

function view(e: {
  id: string;
  name: string | null;
  method: string;
  path: string;
  description: string | null;
  authRequired: boolean;
  parameters: string;
  requestBody: string | null;
  responseExample: string | null;
  statusCode: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: e.id,
    name: e.name,
    method: e.method,
    path: e.path,
    description: e.description,
    authRequired: e.authRequired,
    parameters: jsonParse(e.parameters, []),
    requestBody: e.requestBody,
    responseExample: e.responseExample,
    statusCode: e.statusCode,
    projectId: e.projectId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export const listEndpoints = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, method } = listSchema.parse(req.query);
  const where: Record<string, unknown> = { userId: req.userId! };
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId! },
    });
    if (!project) throw NotFoundError("Project not found");
    where.projectId = projectId;
  }
  if (method) where.method = method;

  const endpoints = await prisma.apiEndpoint.findMany({
    where,
    orderBy: [{ method: "asc" }, { createdAt: "asc" }],
    include: { project: { select: { id: true, name: true } } },
  });

  res.json({ endpoints: endpoints.map((e) => ({ ...view(e), project: e.project })) });
});

export const getEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const endpoint = await prisma.apiEndpoint.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!endpoint) throw NotFoundError("Endpoint not found");
  res.json({ endpoint: { ...view(endpoint), project: endpoint.project } });
});

export const createEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const data = endpointSchema.parse(req.body);
  await ensureProjectOwned(req.userId!, data.projectId);

  const endpoint = await prisma.apiEndpoint.create({
    data: {
      userId: req.userId!,
      projectId: data.projectId ?? null,
      name: data.name,
      method: data.method,
      path: data.path,
      description: data.description,
      authRequired: data.authRequired,
      parameters: jsonStringify(data.parameters),
      requestBody: data.requestBody,
      responseExample: data.responseExample,
      statusCode: data.statusCode,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  await logActivity({
    userId: req.userId!,
    type: "API_ADDED",
    description: `Documented ${data.method} ${data.path}`,
    projectId: data.projectId,
    resourceType: "api_endpoint",
    resourceId: endpoint.id,
  });

  res.status(201).json({ endpoint: { ...view(endpoint), project: endpoint.project } });
});

export const updateEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const data = endpointSchema.parse(req.body);
  const existing = await prisma.apiEndpoint.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Endpoint not found");
  await ensureProjectOwned(req.userId!, data.projectId ?? existing.projectId);

  const endpoint = await prisma.apiEndpoint.update({
    where: { id: existing.id },
    data: {
      name: data.name === undefined ? undefined : data.name,
      method: data.method,
      path: data.path,
      description: data.description === undefined ? undefined : data.description,
      authRequired: data.authRequired,
      parameters: data.parameters !== undefined ? jsonStringify(data.parameters) : undefined,
      requestBody: data.requestBody === undefined ? undefined : data.requestBody,
      responseExample: data.responseExample === undefined ? undefined : data.responseExample,
      statusCode: data.statusCode,
      projectId: data.projectId === undefined ? existing.projectId : data.projectId,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  await logActivity({
    userId: req.userId!,
    type: "API_UPDATED",
    description: `Updated ${data.method} ${data.path}`,
    projectId: endpoint.projectId,
    resourceType: "api_endpoint",
    resourceId: endpoint.id,
  });

  res.json({ endpoint: { ...view(endpoint), project: endpoint.project } });
});

export const deleteEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.apiEndpoint.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!existing) throw NotFoundError("Endpoint not found");

  await prisma.apiEndpoint.delete({ where: { id: existing.id } });

  await logActivity({
    userId: req.userId!,
    type: "API_DELETED",
    description: `Removed ${existing.method} ${existing.path} from the docs`,
    projectId: existing.projectId,
    resourceType: "api_endpoint",
    resourceId: existing.id,
  });

  res.json({ ok: true });
});