import { AppError } from '../errors/AppError.js'

export function pathParam(name: string, value: string | string[] | undefined): string {
  if (typeof value === 'string' && value.length > 0) return value
  throw new AppError('VALIDATION_ERROR', 400, `Missing route parameter: ${name}`, {})
}
