export const PROJECT_STATUSES = [
  "planning",
  "development",
  "testing",
  "live",
  "paused",
  "archived",
];

export const PROJECT_PRIORITIES = ["low", "medium", "high", "critical"];

export const TASK_STATUSES = ["todo", "in_progress", "done"];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"];

export const DEPLOYMENT_ENVIRONMENTS = ["production", "staging", "preview"];

export const DEPLOYMENT_STATUSES = ["success", "building", "failed", "cancelled"];

export const API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

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
];

export const NOTIFICATION_TYPES = [
  "deployment_failed",
  "deployment_success",
  "task_due",
  "project_attention",
  "ai_blocker",
  "system",
];

export function isOf(values, value) {
  return typeof value === "string" && values.includes(value);
}
