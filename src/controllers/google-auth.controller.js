import env from "../config/env.js";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  isGoogleConfigured,
} from "../services/google.js";
import { loginOrLinkGoogle } from "../services/auth.js";

function redirectBack(res, query) {
  const origin = env.googleAppOrigin.replace(/\/$/, "");
  res.redirect(`${origin}/login${query ? `?${query}` : ""}`);
}

export const authorize = (_req, res) => {
  if (!isGoogleConfigured()) {
    return redirectBack(res, "google_error=not_configured");
  }
  res.redirect(buildGoogleAuthorizeUrl());
};

export const callback = async (req, res) => {
  const { error, code, state } = req.query;

  if (error || !code) {
    return redirectBack(res, `google_error=${encodeURIComponent(error ?? "missing_code")}`);
  }

  try {
    const profile = await exchangeGoogleCode(code, state);
    await loginOrLinkGoogle(res, profile, req);
    redirectBack(res, "google=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    redirectBack(res, `google_error=${encodeURIComponent(message)}`);
  }
}