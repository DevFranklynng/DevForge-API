import { prisma } from "../lib/prisma.js";
import { getUnreadCount, markDueSoonTasks, markProjectAttention } from "../services/notification.js";
import { broadcastResource } from "../services/events.js";
import { asyncHandler, NotFoundError } from "../utils/http.js";

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { project: { select: { id: true, name: true } } },
  });
  res.json({ notifications });
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ count: await getUnreadCount(req.userId) });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!notification) throw NotFoundError("Notification not found");

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });
  broadcastResource(req.userId, "notifications");
  res.json({ notification: updated });
});

export const markUnread = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!notification) throw NotFoundError("Notification not found");

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: false },
  });
  broadcastResource(req.userId, "notifications");
  res.json({ notification: updated });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, isRead: false },
    data: { isRead: true },
  });
  broadcastResource(req.userId, "notifications");
  res.json({ ok: true });
});

export const reconcileNotifications = asyncHandler(async (req, res) => {
  await markDueSoonTasks(req.userId);
  await markProjectAttention(req.userId);
  const count = await getUnreadCount(req.userId);
  broadcastResource(req.userId, "notifications");
  res.json({ count });
});