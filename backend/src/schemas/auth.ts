import { z } from 'zod'

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export const signupBodySchema = z.object({
  email: z.string().trim().email(),
  password: passwordSchema,
})

export const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email(),
})

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export type SignupBody = z.infer<typeof signupBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>
