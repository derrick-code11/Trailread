import { z } from 'zod'

export const progressEventSchema = z.object({
  paragraphId: z.string().uuid(),
  visibleRatio: z.number().min(0).max(1),
  dwellSeconds: z.number().min(0).max(90),
  scrollVelocity: z.number().min(0),
  pageFocused: z.boolean(),
  finalParagraphSeen: z.boolean(),
  clientBatchId: z.string().max(64).optional(),
})

export const progressEventsBodySchema = z.object({
  events: z.array(progressEventSchema).min(1).max(150),
})

export type ProgressEventsBody = z.infer<typeof progressEventsBodySchema>

export const completeChapterBodySchema = z.preprocess(
  (raw) => (raw == null || typeof raw !== 'object' ? {} : raw),
  z.object({}).strip(),
)

export type CompleteChapterBody = z.infer<typeof completeChapterBodySchema>
