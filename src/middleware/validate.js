import { BadRequestError } from "../utils/http.js";

export function validate(targets) {
  return (req, _res, next) => {
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
        req.query = result.data;
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
        req.params = result.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
