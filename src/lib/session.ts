import { createHash, randomBytes } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function createSessionToken(): { raw: string; hash: string } {
  const raw = generateSessionToken();
  return { raw, hash: hashSessionToken(raw) };
}