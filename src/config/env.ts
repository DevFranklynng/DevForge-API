import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env"),
];

const loadedPath = candidates.find((p) => existsSync(p));
if (loadedPath) dotenv.config({ path: loadedPath });
else dotenv.config();

function read(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function readBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

function readSameSite(name: string, fallback: "lax" | "none" | "strict"): "lax" | "none" | "strict" {
  const value = read(name, fallback).toLowerCase() as "lax" | "none" | "strict";
  return value === "lax" || value === "none" || value === "strict" ? value : fallback;
}

const isProd = process.env.NODE_ENV === "production";

const clientOrigin = read("CLIENT_ORIGIN", "http://localhost:5173");
const cookieSecure = readBool("COOKIE_SECURE", false);
const sessionSecret = read("SESSION_SECRET", "");
if (!sessionSecret && !isProd) {
  const generated = randomBytes(32).toString("hex");
  process.env.DEVFORGE_EPHEMERAL_SECRET = generated;
}

const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,
  port: Number(read("PORT", "4000")),
  apiUrl: read("API_URL", "http://localhost:4000"),
  clientOrigin,
  databaseUrl: read("DATABASE_URL", "file:./devforge.db"),
  sessionSecret: sessionSecret || process.env.DEVFORGE_EPHEMERAL_SECRET!,
  sessionTtlDays: Number(read("SESSION_TTL_DAYS", "30")),
  cookieSecure,
  cookieSameSite: readSameSite("COOKIE_SAME_SITE", cookieSecure ? "none" : "lax"),
  cookieName: "df_session",
  demoMode: readBool("DEMO_MODE", true),
  githubToken: read("GITHUB_TOKEN", ""),
  githubClientId: read("GITHUB_CLIENT_ID", ""),
  githubClientSecret: read("GITHUB_CLIENT_SECRET", ""),
  githubRedirectUri: read("GITHUB_REDIRECT_URI", "http://localhost:4000/api/github/callback"),
  githubAppOrigin: read("GITHUB_APP_ORIGIN", clientOrigin),
  googleClientId: read("GOOGLE_CLIENT_ID", ""),
  googleClientSecret: read("GOOGLE_CLIENT_SECRET", ""),
  googleRedirectUri: read("GOOGLE_REDIRECT_URI", "http://localhost:4000/api/auth/google/callback"),
  googleAppOrigin: read("GOOGLE_APP_ORIGIN", clientOrigin),
  deployProvider: read("DEPLOY_PROVIDER", ""),
  aiProvider: read("AI_PROVIDER", ""),
  openaiApiKey: read("OPENAI_API_KEY", ""),
  openaiBaseUrl: read("OPENAI_BASE_URL", "https://api.openai.com/v1"),
  openaiModel: read("OPENAI_MODEL", "gpt-4o-mini"),
};

if (isProd && !sessionSecret) {
  console.error("[env] SESSION_SECRET is required in production. Set it in .env.");
  process.exit(1);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export default env;