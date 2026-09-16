import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../services/activity.js";
import { broadcastResource } from "../services/events.js";
import { asyncHandler, NotFoundError } from "../utils/http.js";

export const settingsSchema = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  workspaceName: z.string().trim().max(80).optional(),
  defaultProjectView: z.enum(["board", "list"]).optional(),
  notifyDueSoon: z.boolean().optional(),
  notifyFailing: z.boolean().optional(),
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  let settings = await prisma.userSettings.findUnique({
    where: { userId: req.userId! },
  });
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: req.userId! },
    });
  }
  res.json({ settings });
  broadcastResource(req.userId!, "settings");
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = settingsSchema.parse(req.body);

  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...data },
    update: data,
  });

  if (data.workspaceName || data.theme || data.defaultProjectView) {
    await logActivity({
      userId: req.userId!,
      type: "SETTINGS_UPDATED",
      description: "Updated workspace settings",
    });
  }

  res.json({ settings });
  broadcastResource(req.userId!, "settings");
});