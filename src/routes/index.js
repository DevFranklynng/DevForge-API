import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as auth from "../controllers/auth.controller.js";
import * as project from "../controllers/project.controller.js";
import * as task from "../controllers/task.controller.js";
import * as repository from "../controllers/repository.controller.js";
import * as deployment from "../controllers/deployment.controller.js";
import * as apiDoc from "../controllers/api.controller.js";
import * as activity from "../controllers/activity.controller.js";
import * as notification from "../controllers/notification.controller.js";
import * as settings from "../controllers/settings.controller.js";
import * as dashboard from "../controllers/dashboard.controller.js";
import * as search from "../controllers/search.controller.js";
import * as ai from "../controllers/ai.controller.js";
import * as github from "../controllers/github.controller.js";
import * as googleAuth from "../controllers/google-auth.controller.js";
import { subscribeLive } from "../services/events.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "devforge", time: new Date().toISOString() });
});

router.post(
  "/auth/register",
  validate({ body: auth.registerSchema }),
  auth.register,
);
router.post("/auth/login", validate({ body: auth.loginSchema }), auth.login);
router.post("/auth/logout", requireAuth, auth.logout);
router.get("/auth/google", googleAuth.authorize);
// callback is intentionally public: Google redirects here straight from OAuth and the state nonce authenticates the browser.
router.get("/auth/google/callback", googleAuth.callback);
router.get("/auth/me", requireAuth, auth.me);
router.get("/auth/sessions", requireAuth, auth.listSessions);
router.delete("/auth/sessions/:id", requireAuth, auth.revokeSession);
router.patch("/auth/profile", requireAuth, validate({ body: auth.profileSchema }), auth.updateProfile);
router.post(
  "/auth/password",
  requireAuth,
  validate({ body: auth.changePasswordSchema }),
  auth.changePassword,
);

router.get("/settings", requireAuth, settings.getSettings);
router.patch("/settings", requireAuth, validate({ body: settings.settingsSchema }), settings.updateSettings);

router.get("/dashboard", requireAuth, dashboard.getDashboard);

router.get("/projects", requireAuth, project.listProjects);
router.post("/projects", requireAuth, validate({ body: project.projectSchema }), project.createProject);
router.get("/projects/:id", requireAuth, project.getProject);
router.patch("/projects/:id", requireAuth, validate({ body: project.projectSchema }), project.updateProject);
router.delete("/projects/:id", requireAuth, project.deleteProject);

router.get("/tasks", requireAuth, task.listTasks);
router.post("/tasks", requireAuth, validate({ body: task.taskSchema }), task.createTask);
router.patch("/tasks/:id", requireAuth, validate({ body: task.taskSchema }), task.updateTask);
router.delete("/tasks/:id", requireAuth, task.deleteTask);

router.get("/repositories", requireAuth, repository.listRepositories);
router.get("/repositories/:id", requireAuth, repository.getRepository);
router.post("/repositories", requireAuth, validate({ body: repository.repoSchema }), repository.connectRepository);
router.patch("/repositories/:id", requireAuth, validate({ body: repository.repoSchema }), repository.updateRepository);
router.delete("/repositories/:id", requireAuth, repository.deleteRepository);

router.get("/deployments", requireAuth, deployment.listDeployments);
router.get("/deployments/:id", requireAuth, deployment.getDeployment);
router.post("/deployments", requireAuth, validate({ body: deployment.deploymentSchema }), deployment.createDeployment);
router.post("/deployments/:id/cancel", requireAuth, deployment.cancelDeployment);

router.get("/apis", requireAuth, apiDoc.listEndpoints);
router.get("/apis/:id", requireAuth, apiDoc.getEndpoint);
router.post("/apis", requireAuth, validate({ body: apiDoc.endpointSchema }), apiDoc.createEndpoint);
router.patch("/apis/:id", requireAuth, validate({ body: apiDoc.endpointSchema }), apiDoc.updateEndpoint);
router.delete("/apis/:id", requireAuth, apiDoc.deleteEndpoint);

router.get("/activity", requireAuth, activity.listActivity);

router.get("/notifications", requireAuth, notification.listNotifications);
router.get("/notifications/unread-count", requireAuth, notification.unreadCount);
router.post("/notifications/reconcile", requireAuth, notification.reconcileNotifications);
router.patch("/notifications/:id/read", requireAuth, notification.markRead);
router.patch("/notifications/:id/unread", requireAuth, notification.markUnread);
router.post("/notifications/read-all", requireAuth, notification.markAllRead);

router.get("/search", requireAuth, search.globalSearch);

router.post("/ai/ask", requireAuth, validate({ body: ai.aiAskSchema }), ai.ask);

router.get("/github/authorize", requireAuth, github.authorize);
// callback is intentionally public: GitHub redirects here straight from OAuth and the state param authenticates the user.
router.get("/github/callback", github.callback);
router.get("/github/status", requireAuth, github.status);
router.get("/github/repos", requireAuth, github.repos);
router.post("/github/disconnect", requireAuth, github.disconnect);

// Server-Sent Events stream for live updates (any authenticated tab).
router.get("/events", requireAuth, (req, res) => {
  subscribeLive(req.userId, res);
});

export default router;