import { getApiBaseUrl } from '@/lib/apiBase'

export type AuthUser = {
  id: string
  email: string
  role: string
  dailyGoalMinutes: number
  timezone: string
  readingStreakCurrent: number
  readingStreakBest: number
  lastStreakDate: string | null
  createdAt: string
}

type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class AuthApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

async function parseError(res: Response): Promise<never> {
  let message = res.statusText || 'Request failed'
  try {
    const body = (await res.json()) as ApiErrorBody
    if (body.error?.message) message = body.error.message
  } catch {
    /* ignore */
  }
  throw new AuthApiError(message, res.status)
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path}`
}

export async function login(body: { email: string; password: string }): Promise<{ user: AuthUser }> {
  const res = await fetch(apiUrl('/api/v1/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return parseJson<{ user: AuthUser }>(res)
}

export async function signup(body: { email: string; password: string }): Promise<{ user: AuthUser }> {
  const res = await fetch(apiUrl('/api/v1/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return parseJson<{ user: AuthUser }>(res)
}

export async function forgotPassword(body: { email: string }): Promise<{ message: string }> {
  const res = await fetch(apiUrl('/api/v1/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify(body),
  })
  return parseJson<{ message: string }>(res)
}

export async function resetPassword(body: { token: string; password: string }): Promise<{ message: string }> {
  const res = await fetch(apiUrl('/api/v1/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify(body),
  })
  return parseJson<{ message: string }>(res)
}

export async function getMe(): Promise<{ user: AuthUser }> {
  const res = await fetch(apiUrl('/api/v1/auth/me'), {
    method: 'GET',
    credentials: 'include',
  })
  return parseJson<{ user: AuthUser }>(res)
}

export async function logout(): Promise<void> {
  const res = await fetch(apiUrl('/api/v1/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) await parseError(res)
}
