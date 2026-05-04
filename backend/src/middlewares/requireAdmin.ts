import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/AppError.js'

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.user.role !== 'ADMIN') {
    next(new AppError('FORBIDDEN', 403, 'Admin access required', {}))
    return
  }
  next()
}
