import type { CookieOptions, Response } from "express";
import { randomBytes } from "node:crypto";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { createSessionToken } from "../lib/session.js";
import { ConflictError, UnauthorizedError } from "../utils/http.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import type { GoogleProfile } from "./google.js";

export interface RegisteredUser {
  user: Awaited<ReturnType<typeof prisma.user.findUnique>>;
  session: { raw: string };
}

const userInclude = { settings: true };

function safeUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  createdAt: Date;
  settings?: unknown;
}) {
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

async function issueSession(res: Response, userId: string, req: unknown) {
  const { raw, hash } = createSessionToken();
  const ttlDays = env.sessionTtlDays;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
      userAgent: (req as { headers?: { "user-agent"?: string } }).headers?.["user-agent"]?.slice(0, 300),
    },
  });

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
    path: "/",
  };
  res.cookie(env.cookieName, raw, cookieOptions);

  return { raw, session };
}

export async function registerUser(
  res: Response,
  name: string,
  email: string,
  password: string,
  req: unknown,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ConflictError("An account with this email already exists");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      settings: { create: {} },
    },
    include: userInclude,
  });

  await issueSession(res, user.id, req);
  return safeUser(user);
}

export async function loginUser(
  res: Response,
  email: string,
  password: string,
  req: unknown,
) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: userInclude,
  });
  if (!user) throw UnauthorizedError("Invalid email or password");

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw UnauthorizedError("Invalid email or password");

  await issueSession(res, user.id, req);
  return safeUser(user);
}

export async function logoutUser(res: Response, tokenHash?: string) {
  if (tokenHash) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
  }
  res.clearCookie(env.cookieName, { path: "/" });
}

/**
 * Signs a user in with a verified Google profile: existing Google identity is
 * used as-is, a verified email matching an existing account links that account
 * to Google, and anything else creates a new account with an unguessable
 * password (so the account can later be secured with a password too).
 */
export async function loginOrLinkGoogle(
  res: Response,
  profile: GoogleProfile,
  req: unknown,
) {
  const byGoogle = await prisma.user.findUnique({
    where: { googleId: profile.sub },
    include: userInclude,
  });
  if (byGoogle) {
    await issueSession(res, byGoogle.id, req);
    return safeUser(byGoogle);
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    include: userInclude,
  });
  if (byEmail) {
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        avatarUrl: byEmail.avatarUrl ?? profile.picture,
      },
      include: userInclude,
    });
    await issueSession(res, user.id, req);
    return safeUser(user);
  }

  const user = await prisma.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      googleId: profile.sub,
      avatarUrl: profile.picture,
      password: randomBytes(32).toString("hex"),
      settings: { create: {} },
    },
    include: userInclude,
  });
  await issueSession(res, user.id, req);
  return safeUser(user);
}

export { safeUser, issueSession };