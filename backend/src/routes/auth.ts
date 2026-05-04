import { Router } from 'express'
import { env } from '../config/env.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { validateBody } from '../middlewares/validateBody.js'
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordBodySchema,
  signupBodySchema,
} from '../schemas/auth.js'
import * as authService from '../services/authService.js'

export const authRouter = Router()

authRouter.post(
  '/signup',
  validateBody(signupBodySchema),
  asyncHandler(async (req, res) => {
    const result = await authService.signup(req.body, res)
    res.status(201).json(result)
  }),
)

authRouter.post(
  '/login',
  validateBody(loginBodySchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body, res)
    res.json(result)
  }),
)

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[env.SESSION_COOKIE_NAME], res)
    res.status(204).send()
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.auth!.user.id)
    res.json(result)
  }),
)

authRouter.post(
  '/forgot-password',
  validateBody(forgotPasswordBodySchema),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body)
    res.json(result)
  }),
)

authRouter.post(
  '/reset-password',
  validateBody(resetPasswordBodySchema),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body)
    res.json(result)
  }),
)
