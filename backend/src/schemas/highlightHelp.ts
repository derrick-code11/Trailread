import { z } from 'zod'

export const highlightHelpModeSchema = z.enum(['EXPLAIN', 'SIMPLIFY', 'DEFINE', 'CONTEXT'])

export const highlightHelpBodySchema = z.object({
  /** Long selections (e.g. whole paragraphs) must be allowed; still bounded for payload safety. */
  selectedText: z.string().min(1).max(12_000),
  paragraphStartIndex: z.coerce.number().int().min(0),
  paragraphEndIndex: z.coerce.number().int().min(0),
  mode: highlightHelpModeSchema,
})

export const highlightPronunciationBodySchema = z.object({
  selectedText: z.string().min(1).max(160),
  paragraphStartIndex: z.coerce.number().int().min(0),
  paragraphEndIndex: z.coerce.number().int().min(0),
})

export type HighlightHelpBody = z.infer<typeof highlightHelpBodySchema>
export type HighlightPronunciationBody = z.infer<typeof highlightPronunciationBodySchema>
