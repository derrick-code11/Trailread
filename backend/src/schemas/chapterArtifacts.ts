import { z } from 'zod'

export const quizAttemptAnswerSchema = z.object({
  questionId: z.string().min(1).max(128),
  selectedIndex: z.number().int().min(0).max(9),
})

export const quizAttemptBodySchema = z.object({
  answers: z.array(quizAttemptAnswerSchema).min(1).max(10),
})

export type QuizAttemptBody = z.infer<typeof quizAttemptBodySchema>
