import env, { hashToken } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { UnauthorizedError } from "../utils/http.js";

function extractToken(req) {
  const fromCookie = req.cookies?.[env.cookieName];
  if (typeof fromCookie === "string" && fromCookie.length > 0) return fromCookie;

  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token.length > 0) return token;
  }
  return null;
}

export async function requireAuth(req, _res, next) {
  try {
    let token = extractToken(req);
    if (!token && req.body?.sessionToken) token = String(req.body.sessionToken);

    if (!token) {
      next(UnauthorizedError("Authentication required"));
      return;
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { settings: true } } },
    });

    if (!session) {
      next(UnauthorizedError("Invalid or expired session"));
      return;
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      next(UnauthorizedError("Session expired"));
      return;
    }

    const { password: _pw, ...safeUser } = session.user;
    req.user = { ...safeUser, settings: session.user.settings };
    req.userId = safeUser.id;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    let token = extractToken(req);
    if (!token && req.body?.sessionToken) token = String(req.body.sessionToken);
    if (!token) {
      next();
      return;
    }
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { settings: true } } },
    });
    if (session && session.expiresAt.getTime() >= Date.now()) {
      const { password: _pw, ...safeUser } = session.user;
      req.user = { ...safeUser, settings: session.user.settings };
      req.userId = safeUser.id;
      req.session = session;
    }
    next();
  } catch (err) {
    next(err);
  }
}
