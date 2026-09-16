import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/http.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Resource not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    res.status(400).json({ error: "Validation failed", details: issues });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "A record with this value already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({ error: "Referenced record does not exist" });
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "Invalid data provided" });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("[db] Database connection error:", err.message);
    res.status(503).json({ error: "Database is unavailable" });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
}