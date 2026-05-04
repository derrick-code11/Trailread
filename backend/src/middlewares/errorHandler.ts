import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof SyntaxError && 'body' in err && (err as SyntaxError & { status?: number }).status === 400) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON body',
        details: {},
      },
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten(),
      },
    })
    return
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details && typeof err.details === 'object' ? err.details : {},
      },
    })
    return
  }

  console.error(err)

  const clientMessage = env.NODE_ENV === 'production' ? 'Internal server error' : err instanceof Error ? err.message : 'Internal server error'

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: clientMessage,
      details: {},
    },
  })
}
