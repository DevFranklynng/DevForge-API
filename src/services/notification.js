import { prisma } from "../lib/prisma.js";

export async function createNotification(input) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      projectId: input.projectId ?? null,
      link: input.link,
    },
  });
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

async function getNotificationPrefs(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return {
    notifyDueSoon: settings?.notifyDueSoon !== false,
    notifyFailing: settings?.notifyFailing !== false,
  };
}

export async function wantsDeploymentNotifications(userId) {
  const prefs = await getNotificationPrefs(userId);
  return prefs.notifyFailing;
}

export async function markDueSoonTasks(userId) {
  const prefs = await getNotificationPrefs(userId);
  if (!prefs.notifyDueSoon) return;

  const today = new Date();
  const horizon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { not: "done" },
      dueDate: { gte: today, lte: horizon },
    },
    include: { project: true },
  });

  for (const task of tasks) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: "task_due",
        resourceId: task.id,
      },
    });
    if (!existing) {
      await prisma.notification.create({
        data: {
          userId,
          type: "task_due",
          title: `Task due soon: ${task.title}`,
          message: task.dueDate
            ? `Due ${task.dueDate.toISOString().slice(0, 10)}`
            : undefined,
          projectId: task.projectId,
          link: task.projectId ? `/projects/${task.projectId}` : "/tasks",
        },
      });
    }
  }
}

export async function markProjectAttention(userId) {
  const stalled = await prisma.project.findMany({
    where: {
      userId,
      status: { in: ["planning", "development"] },
    },
    include: { tasks: true },
  });

  for (const project of stalled) {
    const openTasks = project.tasks.filter((t) => t.status !== "done").length;
    const lastSeen = project.lastActivityAt.getTime();
    const inactiveDays = (Date.now() - lastSeen) / (24 * 60 * 60 * 1000);
    const needsAttention = openTasks > 0 && inactiveDays > 4;

    if (!needsAttention) continue;

    const existing = await prisma.notification.findFirst({
      where: { userId, type: "project_attention", projectId: project.id },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId,
        type: "project_attention",
        title: `${project.name} needs attention`,
        message: `${openTasks} open task(s), no activity for ${Math.floor(inactiveDays)} day(s).`,
        projectId: project.id,
        link: `/projects/${project.id}`,
      },
    });
  }
}
