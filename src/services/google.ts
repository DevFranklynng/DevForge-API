import { randomBytes } from "node:crypto";
import env from "../config/env.js";

// ---------------------------------------------------------------------------
// Google OAuth (OpenID Connect) for sign-in / sign-up.
//
// State is a short-lived random nonce kept in memory; it is consumed once so a
// submitted code can only be redeemed by the browser that started the flow. The
// callback verifies the Google-verified email before linking to an existing
// account.
// ---------------------------------------------------------------------------

const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPES = "openid email profile";

const pendingStates = new Map<string, { expiresAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

export function isGoogleConfigured(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret);
}

export function buildGoogleAuthorizeUrl(): string {
  const state = createState();
  return `${GOOGLE_AUTHORIZE}?${new URLSearchParams({
    client_id: env.googleClientId.trim(),
    redirect_uri: env.googleRedirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    prompt: "select_account",
    access_type: "online",
  }).toString()}`;
}

function createState(): string {
  const token = randomBytes(24).toString("base64url");
  pendingStates.set(token, { expiresAt: Date.now() + STATE_TTL_MS });
  return token;
}

function consumeState(state: string | undefined): boolean {
  if (!state) return false;
  const entry = pendingStates.get(state);
  if (!entry) return false;
  pendingStates.delete(state);
  return entry.expiresAt > Date.now();
}

export async function exchangeGoogleCode(code: string, state: string | undefined): Promise<GoogleProfile> {
  if (!consumeState(state)) throw new Error("Invalid or expired OAuth state");

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId.trim(),
      client_secret: env.googleClientSecret.trim(),
      redirect_uri: env.googleRedirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenRes.ok) {
    throw new Error("Google did not accept the authorization code");
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    throw new Error(tokenData.error ?? "Google did not return an access token");
  }

  const userRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!userRes.ok) throw new Error("Could not load your Google profile");

  const info = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!info.sub || !info.email) throw new Error("Google profile is missing identity fields");
  if (!info.email_verified) throw new Error("Your Google email is not verified");

  return {
    sub: info.sub,
    email: info.email,
    emailVerified: info.email_verified,
    name: info.name ?? info.email.split("@")[0],
    picture: info.picture ?? null,
  };
}