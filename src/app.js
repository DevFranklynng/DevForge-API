import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { default as helmet } from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import env from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = env.clientOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser(env.sessionSecret));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !env.isProd,
  });
  app.use("/api/auth/", authLimiter);

  app.use("/api", routes);

  if (env.isProd) {
    const clientDist = path.resolve(__dirname, "../../dist");
    if (existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path.join(clientDist, "index.html"), (err) => {
          if (err) next();
        });
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}