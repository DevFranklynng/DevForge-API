import { randomBytes } from "node:crypto";
import env from "../config/env.js";

const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPES = "openid email profile";

const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

export function isGoogleConfigured() {
  return Boolean(env.googleClientId && env.googleClientSecret);
}

export function buildGoogleAuthorizeUrl() {
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

function createState() {
  const token = randomBytes(24).toString("base64url");
  pendingStates.set(token, { expiresAt: Date.now() + STATE_TTL_MS });
  return token;
}

function consumeState(state) {
  if (!state) return false;
  const entry = pendingStates.get(state);
  if (!entry) return false;
  pendingStates.delete(state);
  return entry.expiresAt > Date.now();
}

export async function exchangeGoogleCode(code, state) {
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

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error ?? "Google did not return an access token");
  }

  const userRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!userRes.ok) throw new Error("Could not load your Google profile");

  const info = await userRes.json();

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
