import type { User, UserRole } from '@prisma/client'

export type AuthedUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'role'
  | 'dailyGoalMinutes'
  | 'timezone'
  | 'readingStreakCurrent'
  | 'readingStreakBest'
  | 'lastStreakDate'
  | 'createdAt'
>

declare global {
  namespace Express {
    interface Request {
      sessionId?: string
      auth?: {
        user: AuthedUser
        sessionRowId: string
      }
    }
  }
}

export type { UserRole }
