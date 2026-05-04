import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'
import { prisma } from '../lib/prisma.js'
import { hashToken } from '../utils/tokens.js'
import { asyncHandler } from './asyncHandler.js'

async function loadSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const plain =
    typeof req.cookies?.[env.SESSION_COOKIE_NAME] === 'string'
      ? req.cookies[env.SESSION_COOKIE_NAME]
      : undefined

  if (!plain) {
    next(new AppError('UNAUTHENTICATED', 401, 'Authentication required', {}))
    return
  }

  const tokenHash = hashToken(plain)
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          dailyGoalMinutes: true,
          timezone: true,
          readingStreakCurrent: true,
          readingStreakBest: true,
          lastStreakDate: true,
          createdAt: true,
        },
      },
    },
  })

  if (!session) {
    next(new AppError('UNAUTHENTICATED', 401, 'Invalid or expired session', {}))
    return
  }

  req.auth = {
    user: session.user,
    sessionRowId: session.id,
  }
  next()
}

export const requireAuth = asyncHandler(loadSession)
