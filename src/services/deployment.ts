import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "./activity.js";
import { createNotification, wantsDeploymentNotifications } from "./notification.js";
import { broadcastResource } from "./events.js";

export const SHAS = [
  "a3f9c21e0d",
  "7b14da82cf",
  "c2e07b1456",
  "9f3a8c4d21",
  "e41d9b07cc",
  "b5c6a1f290",
];

export const COMMIT_MESSAGES = [
  "Add status filter to project list",
  "Fix session expiry race condition",
  "Implement task reordering",
  "Optimize dashboard queries",
  "Add API endpoint documentation",
  "Update deployment pipeline config",
  "Refactor notification service",
  "Add due-date reminders",
];

export function estimateDuration(): number {
  return 38_000 + Math.floor(Math.random() * 160_000);
}

/**
 * Simulated deployment provider. When a real provider (DEPLOY_PROVIDER) is
 * configured, this is where the provider client would be called instead.
 * Every deployment created through this path is labelled with
 * `provider = "demo"` so it is never mistaken for a real deployment.
 */
export async function createSimulatedDeployment(
  userId: string,
  projectId: string,
  input: {
    environment: string;
    branch?: string;
    commit?: string;
    commitMessage?: string;
    url?: string;
  },
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error("Project not found");

  const buildOk = Math.random() > 0.15;
  const commit = input.commit ?? SHAS[Math.floor(Math.random() * SHAS.length)]!;
  const commitMessage =
    input.commitMessage ?? COMMIT_MESSAGES[Math.floor(Math.random() * COMMIT_MESSAGES.length)]!;
  const environment = input.environment;
  const branch = input.branch ?? "main";
  const duration = estimateDuration();

  const deployment = await prisma.deployment.create({
    data: {
      userId,
      projectId,
      environment,
      status: "building",
      buildStatus: "running",
      branch,
      commit,
      commitMessage,
      provider: env.deployProvider ? "external" : "demo",
      url: input.url,
      durationMs: duration,
    },
  });

  await logActivity({
    userId,
    type: "DEPLOYMENT_CREATED",
    description: `Deployment started for ${project.name} (${environment})`,
    projectId,
    resourceType: "deployment",
    resourceId: deployment.id,
  });

  const finalStatus = buildOk ? "success" : "failed";
  const finishedAt = new Date(Date.now() + duration);
  const delayMs = Math.min(duration, 12_000);

  setTimeout(async () => {
    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: finalStatus,
        buildStatus: buildOk ? "success" : "failed",
        finishedAt,
      },
    });

    broadcastResource(userId, "deployments");
    broadcastResource(userId, "activity");
    broadcastResource(userId, "notifications");

    if (finalStatus === "success") {
      await logActivity({
        userId,
        type: "DEPLOYMENT_SUCCESS",
        description: `${project.name} deployed successfully to ${environment}`,
        projectId,
        resourceType: "deployment",
        resourceId: deployment.id,
      });
      if (await wantsDeploymentNotifications(userId)) {
        await createNotification({
          userId,
          type: "deployment_success",
          title: `${project.name} is live in ${environment}`,
          message: `Commit ${commit} deployed successfully.`,
          projectId,
          link: `/projects/${projectId}?tab=deployments`,
        });
      }
    } else {
      await logActivity({
        userId,
        type: "DEPLOYMENT_FAILED",
        description: `Deployment failed for ${project.name} (${environment})`,
        projectId,
        resourceType: "deployment",
        resourceId: deployment.id,
      });
      if (await wantsDeploymentNotifications(userId)) {
        await createNotification({
          userId,
          type: "deployment_failed",
          title: `Deployment failed for ${project.name}`,
          message: `The build for commit ${commit} failed. Check the build logs.`,
          projectId,
          link: `/projects/${projectId}?tab=deployments`,
        });
      }
    }
    void updated;
  }, delayMs);

  return deployment;
}