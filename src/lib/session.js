import { createHash, randomBytes } from "node:crypto";

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

export function createSessionToken() {
  const raw = generateSessionToken();
  return { raw, hash: hashSessionToken(raw) };
}
