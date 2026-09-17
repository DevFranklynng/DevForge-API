import { z } from "zod";
import env, { hashToken } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import {
  loginUser,
  logoutUser,
  registerUser,
  safeUser,
} from "../services/auth.js";
import { asyncHandler, BadRequestError, ConflictError, NotFoundError } from "../utils/http.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(200).optional(),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  const user = await registerUser(res, name, email, password, req);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await loginUser(res, email, password, req);
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(res, req.session?.tokenHash);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { settings: true },
  });
  if (!user) throw NotFoundError("User not found");
  res.json({ user: safeUser(user) });
});

export const listSessions = asyncHandler(async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      current: s.id === req.session?.id,
    })),
  });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: req.userId },
  });
  if (!session) throw NotFoundError("Session not found");
  if (session.id === req.session?.id) throw BadRequestError("Use logout to end the current session");
  await prisma.session.delete({ where: { id: session.id } });
  res.json({ ok: true });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);

  if (data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== req.userId) {
      throw ConflictError("That email is already in use");
    }
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      name: data.name,
      email: data.email,
      avatarUrl: data.avatarUrl === undefined ? undefined : data.avatarUrl,
    },
    include: { settings: true },
  });

  res.json({ user: safeUser(user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw NotFoundError("User not found");

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw BadRequestError("Current password is incorrect");

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  await prisma.session.deleteMany({ where: { userId: user.id, id: { not: req.session.id } } });

  res.json({ ok: true });
});