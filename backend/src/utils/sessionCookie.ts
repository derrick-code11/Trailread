import type { CookieOptions } from 'express'
import { env } from '../config/env.js'

export function sessionCookieOptions(): CookieOptions {
  const maxAgeMs = env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeMs,
  }
}

export function sessionCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  }
}
