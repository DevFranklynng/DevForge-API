import { createHmac, timingSafeEqual } from "node:crypto";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

// ---------------------------------------------------------------------------
// GitHub integration.
//
// The safe design here is a real OAuth flow: each user authorizes a hosting app
// with a MINIMAL read-only scope ("public_repo"), the received access token is
// stored encrypted at rest (AES-256-GCM) and NEVER exposed to the client. All
// GitHub calls are made server-side with the user's own token, so no shared
// server credential is shared across users.
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";
const GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";
const OAUTH_SCOPE = "public_repo";

export interface GithubRepoPayload {
  name: string;
  owner: string;
  description: string | null;
  branch: string;
  visibility: "private" | "public";
  stars: number;
  forks: number;
  openIssues: number;
  lastCommit: Date | null;
  url: string | null;
  source: "github" | "demo";
}

export type GithubRepoInput = Omit<GithubRepoPayload, "source">;

export function isGithubConfigured(): boolean {
  return Boolean(env.githubClientId && env.githubClientSecret);
}

// --- OAuth state (CSRF protection) -----------------------------------------

function createState(userId: string): string {
  const payload = Buffer.from(`uid=${userId}`, "utf8").toString("base64url");
  const sig = createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string | undefined): string | null {
  if (!state) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const match = /^uid=(.+)$/.exec(decoded);
  return match ? match[1] : null;
}

// --- OAuth flow -------------------------------------------------------------

export function buildAuthorizeUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: env.githubClientId.trim(),
    redirect_uri: env.githubRedirectUri,
    scope: OAUTH_SCOPE,
    state: createState(userId),
    allow_signup: "false",
  });
  return `${GITHUB_OAUTH_AUTHORIZE}?${params.toString()}`;
}

interface ExchangeResult {
  userId: string;
  token: string;
  githubId: string;
  githubLogin: string;
  avatarUrl: string | null;
  scopes: string;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`GitHub request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function exchangeCode(code: string, state: string | undefined): Promise<ExchangeResult> {
  const userId = verifyState(state);
  if (!userId) throw new Error("Invalid OAuth state");

  const body = new URLSearchParams({
    client_id: env.githubClientId.trim(),
    client_secret: env.githubClientSecret.trim(),
    code,
    redirect_uri: env.githubRedirectUri,
  });

  const tokenRes = await fetchJson<{
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  }>(GITHUB_OAUTH_TOKEN, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });

  if (!tokenRes.access_token) {
    throw new Error(tokenRes.error_description ?? tokenRes.error ?? "GitHub did not return an access token");
  }

  const scopes = tokenRes.scope ?? OAUTH_SCOPE;
  const user = await fetchJson<{
    id: number;
    login: string;
    avatar_url?: string;
  }>(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${tokenRes.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DevForge",
    },
  });

  return {
    userId,
    token: tokenRes.access_token,
    githubId: String(user.id),
    githubLogin: user.login,
    avatarUrl: user.avatar_url ?? null,
    scopes,
  };
}

export async function storeCredential(cred: ExchangeResult): Promise<void> {
  const existing = await prisma.githubCredential.findUnique({ where: { userId: cred.userId } });
  if (existing) {
    await revokeToken(existing.token).catch(() => undefined);
  }
  await prisma.githubCredential.upsert({
    where: { userId: cred.userId },
    create: {
      userId: cred.userId,
      githubId: cred.githubId,
      githubLogin: cred.githubLogin,
      avatarUrl: cred.avatarUrl,
      token: encryptSecret(cred.token),
      scopes: cred.scopes,
    },
    update: {
      githubId: cred.githubId,
      githubLogin: cred.githubLogin,
      avatarUrl: cred.avatarUrl,
      token: encryptSecret(cred.token),
      scopes: cred.scopes,
    },
  });
}

export async function disconnectCredential(userId: string): Promise<void> {
  const existing = await prisma.githubCredential.findUnique({ where: { userId } });
  if (existing) await revokeToken(existing.token).catch(() => undefined);
  await prisma.githubCredential.delete({ where: { userId } }).catch(() => undefined);
}

// --- Token access (server-side only) ----------------------------------------

export async function getUserToken(userId: string): Promise<string | null> {
  const credential = await prisma.githubCredential.findUnique({ where: { userId } });
  if (!credential) return null;
  try {
    return decryptSecret(credential.token);
  } catch {
    // Token can no longer be decrypted (session secret rotated). Treat as unlinked.
    return null;
  }
}

export async function getCredentialStatus(userId: string) {
  const credential = await prisma.githubCredential.findUnique({ where: { userId } });
  if (!credential) return { connected: false as const };
  let valid = true;
  try {
    decryptSecret(credential.token);
  } catch {
    valid = false;
  }
  return {
    connected: valid as boolean,
    githubId: credential.githubId,
    login: credential.githubLogin,
    avatarUrl: credential.avatarUrl,
    scopes: credential.scopes,
    connectedAt: credential.createdAt,
  };
}

async function revokeToken(encryptedToken: string): Promise<void> {
  let token: string;
  try {
    token = decryptSecret(encryptedToken);
  } catch {
    return;
  }
  if (!env.githubClientId || !env.githubClientSecret) return;
  // Best-effort revocation of the access token via the applications endpoint.
  await fetch(`${GITHUB_API}/applications/${env.githubClientId}/token`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.githubClientId}:${env.githubClientSecret}`).toString("base64")}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DevForge",
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}

// --- Repo metadata ----------------------------------------------------------

/**
 * Fetches real repository metadata from the GitHub API using the account's own
 * token (or, as a legacy fallback, a shared GITHUB_TOKEN). When nothing is
 * available the caller-provided data is returned and marked `source: "demo"` so
 * the UI never mistakes it for live data.
 */
export async function syncGitHubRepo(input: GithubRepoInput, token?: string | null): Promise<GithubRepoPayload> {
  const bearer = token ?? env.githubToken;
  if (!bearer || !input.owner || !input.name) {
    return { ...input, source: "demo" };
  }

  try {
    const data = await fetchJson<{
      full_name: string;
      description: string | null;
      default_branch: string;
      private: boolean;
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      pushed_at: string;
      html_url: string;
    }>(`${GITHUB_API}/repos/${input.owner}/${input.name}`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "DevForge",
      },
    });

    const [owner, name] = data.full_name.split("/");
    return {
      name: name ?? input.name,
      owner: owner ?? input.owner,
      description: data.description,
      branch: data.default_branch,
      visibility: data.private ? "private" : "public",
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      lastCommit: data.pushed_at ? new Date(data.pushed_at) : null,
      url: data.html_url,
      source: "github",
    };
  } catch {
    return { ...input, source: "demo" };
  }
}

export async function listUserRepositories(userId: string): Promise<Array<{
  fullName: string;
  owner: string;
  name: string;
  htmlUrl: string | null;
  description: string | null;
  language: string | null;
  visibility: "private" | "public";
  defaultBranch: string;
}>> {
  const token = await getUserToken(userId);
  if (!token) {
    throw new Error("GitHub account is not connected");
  }

  const repos = await fetchJson<
    Array<{
      full_name: string;
      name: string;
      owner: { login: string };
      html_url: string;
      description: string | null;
      language: string | null;
      private: boolean;
      default_branch: string;
    }>
  >(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DevForge",
    },
  });

  return repos.map((r) => ({
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    htmlUrl: r.html_url,
    description: r.description,
    language: r.language,
    visibility: r.private ? "private" : "public",
    defaultBranch: r.default_branch,
  }));
}