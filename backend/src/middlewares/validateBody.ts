import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema } from 'zod'
import { AppError } from '../errors/AppError.js'

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      next(new AppError('VALIDATION_ERROR', 422, 'Invalid request body', result.error.flatten()))
      return
    }
    req.body = result.data
    next()
  }
}
