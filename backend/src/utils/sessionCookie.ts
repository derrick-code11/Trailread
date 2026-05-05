import type { CookieOptions } from "express";
import { env } from "../config/env.js";

function sessionCookieBaseOptions(): Pick<
  CookieOptions,
  "httpOnly" | "sameSite" | "secure" | "path"
> {
  const production = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: production ? "none" : "lax",
    secure: production,
    path: "/",
  };
}

export function sessionCookieOptions(): CookieOptions {
  const maxAgeMs = env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
  return {
    ...sessionCookieBaseOptions(),
    maxAge: maxAgeMs,
  };
}

export function sessionCookieClearOptions(): CookieOptions {
  return sessionCookieBaseOptions();
}
