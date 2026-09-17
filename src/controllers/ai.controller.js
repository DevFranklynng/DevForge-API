import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { askAi } from "../services/ai/index.js";
import { asyncHandler, NotFoundError } from "../utils/http.js";

export const aiAskSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(2000),
  projectId: z.string().nullable().optional(),
});

export const ask = asyncHandler(async (req, res) => {
  const { message, projectId } = aiAskSchema.parse(req.body);

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project) throw NotFoundError("Project not found");
  }

  const response = await askAi({
    userId: req.userId,
    message,
    projectId,
  });

  res.json({ response });
});