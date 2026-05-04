import type { ErrorRequestHandler } from 'express'
import { env } from '../config/env.js'

function httpStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const n = Number((err as { status: unknown }).status)
    if (Number.isFinite(n) && n >= 400 && n < 600) return n
  }
  return 500
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  const safeStatus = httpStatus(err)
  const message =
    safeStatus === 500 ? 'Internal server error' : err instanceof Error ? err.message : 'Error'

  if (safeStatus >= 500) {
    console.error(err)
  }

  res.status(safeStatus).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(env.NODE_ENV !== 'production' && err instanceof Error ? { detail: err.message } : {}),
    },
  })
}
