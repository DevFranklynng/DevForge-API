import type { User, UserSettings } from "@prisma/client";

export type SafeUser = Omit<User, "password"> & {
  settings?: UserSettings | null;
};

export const PROJECT_STATUSES = [
  "planning",
  "development",
  "testing",
  "live",
  "paused",
  "archived",
] as const;

export const PROJECT_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const DEPLOYMENT_ENVIRONMENTS = ["production", "staging", "preview"] as const;

export const DEPLOYMENT_STATUSES = ["success", "building", "failed", "cancelled"] as const;

export const API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export const ACTIVITY_TYPES = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_STATUS_CHANGED",
  "PROJECT_ARCHIVED",
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_COMPLETED",
  "TASK_DELETED",
  "REPOSITORY_CONNECTED",
  "REPOSITORY_UPDATED",
  "DEPLOYMENT_CREATED",
  "DEPLOYMENT_SUCCESS",
  "DEPLOYMENT_FAILED",
  "DEPLOYMENT_CANCELLED",
  "API_ADDED",
  "API_UPDATED",
  "API_DELETED",
  "PROFILE_UPDATED",
  "SETTINGS_UPDATED",
  "NOTIFICATION_OPENED",
] as const;

export const NOTIFICATION_TYPES = [
  "deployment_failed",
  "deployment_success",
  "task_due",
  "project_attention",
  "ai_blocker",
  "system",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export function isOf<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}