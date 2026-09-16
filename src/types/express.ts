import type { Session } from "@prisma/client";
import type { SafeUser } from "../models/domain.js";

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      userId?: string;
      session?: Session;
    }
  }
}

export {};