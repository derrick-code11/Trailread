import type { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import type { Response } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'
import { prisma } from '../lib/prisma.js'
import { generateOpaqueToken, hashToken } from '../utils/tokens.js'
import { sessionCookieClearOptions, sessionCookieOptions } from '../utils/sessionCookie.js'
import { forgotPasswordPublicMessage, sendPasswordResetEmail } from './emailService.js'
import type { ForgotPasswordBody, LoginBody, ResetPasswordBody, SignupBody } from '../schemas/auth.js'

const BCRYPT_ROUNDS = 12
const RESET_TOKEN_MS = 45 * 60 * 1000

function userPublicFields(user: {
  id: string
  email: string
  role: UserRole
  dailyGoalMinutes: number
  timezone: string
  readingStreakCurrent: number
  readingStreakBest: number
  lastStreakDate: Date | null
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    dailyGoalMinutes: user.dailyGoalMinutes,
    timezone: user.timezone,
    readingStreakCurrent: user.readingStreakCurrent,
    readingStreakBest: user.readingStreakBest,
    lastStreakDate: user.lastStreakDate?.toISOString().slice(0, 10) ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

async function createSession(userId: string): Promise<{ plainToken: string; expiresAt: Date }> {
  const plainToken = generateOpaqueToken()
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  return { plainToken, expiresAt }
}

function setSessionCookie(res: Response, plainToken: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, plainToken, sessionCookieOptions())
}

export async function signup(body: SignupBody, res: Response) {
  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)

  let user
  try {
    user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
      },
    })
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: string }).code : ''
    if (code === 'P2002') {
      throw new AppError('CONFLICT', 409, 'An account with this email already exists', {})
    }
    throw e
  }

  const { plainToken } = await createSession(user.id)
  setSessionCookie(res, plainToken)

  return { user: userPublicFields(user) }
}

export async function login(body: LoginBody, res: Response) {
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  })

  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new AppError('UNAUTHENTICATED', 401, 'Invalid email or password', {})
  }

  const { plainToken } = await createSession(user.id)
  setSessionCookie(res, plainToken)

  return { user: userPublicFields(user) }
}

export async function logout(sessionTokenPlain: string | undefined, res: Response): Promise<void> {
  res.clearCookie(env.SESSION_COOKIE_NAME, sessionCookieClearOptions())

  if (!sessionTokenPlain) return

  const tokenHash = hashToken(sessionTokenPlain)
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  })

  if (!user) {
    throw new AppError('UNAUTHENTICATED', 401, 'Session is no longer valid', {})
  }

  return { user: userPublicFields(user) }
}

export async function forgotPassword(body: ForgotPasswordBody): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  })

  if (!user) {
    return { message: forgotPasswordPublicMessage() }
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  })

  const plainToken = generateOpaqueToken()
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MS)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  const resetUrl = `${env.WEB_APP_ORIGIN.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(plainToken)}`

  try {
    await sendPasswordResetEmail(user.email, resetUrl)
  } catch {
    // Still return generic message; log handled in email layer
  }

  return { message: forgotPasswordPublicMessage() }
}

export async function resetPassword(body: ResetPasswordBody): Promise<{ message: string }> {
  const tokenHash = hashToken(body.token)

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  })

  if (!record) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid or expired reset token', {})
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  return { message: 'Password updated. Sign in with your new password.' }
}
