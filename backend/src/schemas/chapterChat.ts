import { z } from 'zod'

export const chapterChatBodySchema = z.object({
  question: z.string().trim().min(3).max(2_000),
  conversationId: z.string().trim().min(1).max(100).optional(),
})

export type ChapterChatBody = z.infer<typeof chapterChatBodySchema>
