import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { BadRequestError } from "../utils/http.js";

interface ValidateTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(targets: ValidateTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (targets.body) {
        const result = targets.body.safeParse(req.body);
        if (!result.success) {
          const issues = result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          }));
          next(BadRequestError("Validation failed", issues));
          return;
        }
        req.body = result.data;
      }
      if (targets.query) {
        const result = targets.query.safeParse(req.query);
        if (!result.success) {
          const issues = result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          }));
          next(BadRequestError("Invalid query parameters", issues));
          return;
        }
        req.query = result.data as typeof req.query;
      }
      if (targets.params) {
        const result = targets.params.safeParse(req.params);
        if (!result.success) {
          const issues = result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          }));
          next(BadRequestError("Invalid route parameters", issues));
          return;
        }
        req.params = result.data as typeof req.params;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}