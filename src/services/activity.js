import { prisma } from "../lib/prisma.js";

export async function logActivity(input) {
  const activity = await prisma.activity.create({
    data: {
      userId: input.userId,
      type: input.type,
      description: input.description,
      projectId: input.projectId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details !== undefined ? JSON.stringify(input.details) : undefined,
    },
  });

  if (input.projectId) {
    await prisma.project
      .update({
        where: { id: input.projectId },
        data: { lastActivityAt: new Date() },
      })
      .catch(() => undefined);
  }

  return activity;
}
