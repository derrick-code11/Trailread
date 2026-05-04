import { BookStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { getGutenbergCoverUrl } from './gutendexService.js'

export async function listPublishedBooks(params: {
  page: number
  pageSize: number
  sortBy: 'title' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}) {
  const { page, pageSize, sortBy, sortOrder } = params
  const where: Prisma.BookWhereInput = { status: BookStatus.PUBLISHED }

  const orderBy: Prisma.BookOrderByWithRelationInput =
    sortBy === 'title' ? { title: sortOrder } : { createdAt: sortOrder }

  const [totalItems, rows] = await prisma.$transaction([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        author: true,
        slug: true,
        language: true,
        description: true,
        coverUrl: true,
        gutenbergId: true,
        publishedAt: true,
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return {
    data: rows.map(({ gutenbergId, ...b }) => ({
      ...b,
      coverUrl: b.coverUrl ?? getGutenbergCoverUrl(gutenbergId),
      publishedAt: b.publishedAt?.toISOString() ?? null,
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  }
}
