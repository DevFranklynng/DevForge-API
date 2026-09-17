import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, NotFoundError } from "../utils/http.js";
import { jsonParse } from "../utils/format.js";

const listSchema = z.object({
  projectId: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listActivity = asyncHandler(async (req, res) => {
  const { projectId, type, limit, offset } = listSchema.parse(req.query);
  const where = { userId: req.userId };
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) throw NotFoundError("Project not found");
    where.projectId = projectId;
  }
  if (type) where.type = type;

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.activity.count({ where }),
  ]);

  res.json({
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      projectId: a.projectId,
      project: a.project,
      details: jsonParse(a.details, undefined),
      createdAt: a.createdAt,
    })),
    total,
  });
});