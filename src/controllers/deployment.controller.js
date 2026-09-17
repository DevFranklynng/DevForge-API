import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createSimulatedDeployment } from "../services/deployment.js";
import { broadcastResource } from "../services/events.js";
import { asyncHandler, BadRequestError, NotFoundError } from "../utils/http.js";

const deploymentListSchema = z.object({
  projectId: z.string().optional(),
  environment: z.string().optional(),
  status: z.string().optional(),
});

export const deploymentSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  environment: z.enum(["production", "staging", "preview"]).default("production"),
  branch: z.string().trim().max(80).optional(),
  commit: z.string().trim().max(40).nullable().optional(),
  commitMessage: z.string().trim().max(200).nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
});

const projectSelect = { id: true, name: true };

export const listDeployments = asyncHandler(async (req, res) => {
  const { projectId, environment, status } = deploymentListSchema.parse(req.query);
  const where = { userId: req.userId };
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) throw NotFoundError("Project not found");
    where.projectId = projectId;
  }
  if (environment) where.environment = environment;
  if (status) where.status = status;

  const deployments = await prisma.deployment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { project: { select: projectSelect } },
  });

  res.json({ deployments });
});

export const createDeployment = asyncHandler(async (req, res) => {
  const data = deploymentSchema.parse(req.body);
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, userId: req.userId },
  });
  if (!project) throw NotFoundError("Project not found");
  if (project.status === "archived") throw BadRequestError("Cannot deploy an archived project");

  const deployment = await createSimulatedDeployment(req.userId, project.id, {
    environment: data.environment,
    branch: data.branch,
    commit: data.commit || undefined,
    commitMessage: data.commitMessage || undefined,
    url: data.url || undefined,
  });

  res.status(202).json({ deployment });
  broadcastResource(req.userId, "deployments");
});

export const getDeployment = asyncHandler(async (req, res) => {
  const deployment = await prisma.deployment.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { project: { select: projectSelect } },
  });
  if (!deployment) throw NotFoundError("Deployment not found");
  res.json({ deployment });
});

export const cancelDeployment = asyncHandler(async (req, res) => {
  const deployment = await prisma.deployment.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!deployment) throw NotFoundError("Deployment not found");
  if (deployment.status !== "building") throw BadRequestError("Only in-progress deployments can be cancelled");

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: { status: "cancelled", buildStatus: "cancelled", finishedAt: new Date() },
  });

  res.json({ deployment: updated });
  broadcastResource(req.userId, "deployments");
});