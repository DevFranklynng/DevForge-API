import env from "../config/env.js";
import {
  buildAuthorizeUrl,
  disconnectCredential,
  exchangeCode,
  getCredentialStatus,
  isGithubConfigured,
  listUserRepositories,
  storeCredential,
} from "../services/github.js";
import { asyncHandler, BadRequestError, UnauthorizedError } from "../utils/http.js";

export const authorize = asyncHandler(async (req, res) => {
  if (!isGithubConfigured()) {
    throw BadRequestError(
      "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the server environment.",
    );
  }
  res.redirect(buildAuthorizeUrl(req.userId));
});

export const callback = asyncHandler(async (req, res) => {
  const { error, error_description, code, state } = req.query;

  const origin = env.githubAppOrigin.replace(/\/$/, "");
  const fail = (reason) => res.redirect(`${origin}/github?link_error=${encodeURIComponent(reason)}`);

  if (error) return fail(error_description ?? error);
  if (!code) return fail("GitHub did not return an authorization code");

  try {
    const credential = await exchangeCode(code, state);
    await storeCredential(credential);
    res.redirect(`${origin}/github?linked=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown GitHub error";
    fail(message);
  }
});

export const status = asyncHandler(async (req, res) => {
  const result = await getCredentialStatus(req.userId);
  res.json({ github: result });
});

export const repos = asyncHandler(async (req, res) => {
  try {
    const repositories = await listUserRepositories(req.userId);
    res.json({ repositories });
  } catch (err) {
    throw UnauthorizedError(err instanceof Error ? err.message : "GitHub account is not connected");
  }
});

export const disconnect = asyncHandler(async (req, res) => {
  await disconnectCredential(req.userId);
  res.json({ ok: true });
});