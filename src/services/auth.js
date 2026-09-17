import { randomBytes } from "node:crypto";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { createSessionToken } from "../lib/session.js";
import { ConflictError, UnauthorizedError } from "../utils/http.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const userInclude = { settings: true };

function safeUser(user) {
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

async function issueSession(res, userId, req) {
  const { raw, hash } = createSessionToken();
  const ttlDays = env.sessionTtlDays;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
      userAgent: req.headers?.["user-agent"]?.slice(0, 300),
    },
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
    path: "/",
  };
  res.cookie(env.cookieName, raw, cookieOptions);

  return { raw, session };
}

export async function registerUser(res, name, email, password, req) {
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

export async function loginUser(res, email, password, req) {
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

export async function logoutUser(res, tokenHash) {
  if (tokenHash) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined);
  }
  res.clearCookie(env.cookieName, { path: "/" });
}

export async function loginOrLinkGoogle(res, profile, req) {
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
