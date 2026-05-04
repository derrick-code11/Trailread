import { z } from 'zod'

export const booksListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['title', 'createdAt']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type BooksListQuery = z.infer<typeof booksListQuerySchema>
