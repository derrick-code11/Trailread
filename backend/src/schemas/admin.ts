import { z } from 'zod'
import { BookStatus } from '@prisma/client'

export const adminBooksListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(BookStatus).optional(),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'status']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type AdminBooksListQuery = z.infer<typeof adminBooksListQuerySchema>

export const gutenbergSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Query is required'),
})

export const adminImportBodySchema = z.object({
  gutenbergId: z.coerce.number().int().positive(),
})

export const adminPatchChapterBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((b) => b.title !== undefined || b.isPublished !== undefined, {
    message: 'Provide title and/or isPublished',
  })

export type AdminPatchChapterBody = z.infer<typeof adminPatchChapterBodySchema>
