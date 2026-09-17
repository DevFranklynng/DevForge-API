export class AppError extends Error {
  statusCode;
  expose;
  details;

  constructor(statusCode, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = true;
    this.details = details;
  }
}

export const BadRequestError = (message = "Invalid request", details) =>
  new AppError(400, message, details);
export const UnauthorizedError = (message = "Authentication required") =>
  new AppError(401, message);
export const ForbiddenError = (message = "You do not have permission to do that") =>
  new AppError(403, message);
export const NotFoundError = (message = "Resource not found") => new AppError(404, message);
export const ConflictError = (message = "Resource already exists") => new AppError(409, message);

export const asyncHandler =
  (fn) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
    settings: user.settings ?? null,
  };
}
