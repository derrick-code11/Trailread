import { getApiBaseUrl } from '@/lib/apiBase'

export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

async function parseError(res: Response): Promise<never> {
  let message = res.statusText || 'Request failed'
  let code: string | undefined
  try {
    const body = (await res.json()) as ApiErrorBody
    if (body.error?.message) message = body.error.message
    code = body.error?.code
  } catch {
    /* ignore */
  }
  throw new ApiRequestError(message, res.status, code)
}

export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path}`
}
