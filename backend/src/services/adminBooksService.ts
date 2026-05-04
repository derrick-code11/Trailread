import { BookStatus, IngestionJobStatus, Prisma } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { prisma } from '../lib/prisma.js'
import { ensureUniqueBookSlug } from './bookSlugService.js'
import { enqueueIngestionJob } from '../queue/ingestionQueue.js'
import { fetchGutendexBook, getGutenbergCoverUrl } from './gutendexService.js'

export async function listAdminBooks(params: {
  page: number
  pageSize: number
  status?: BookStatus
  sortBy: 'title' | 'createdAt' | 'updatedAt' | 'status'
  sortOrder: 'asc' | 'desc'
}) {
  const { page, pageSize, status, sortBy, sortOrder } = params
  const where: Prisma.BookWhereInput = status ? { status } : {}

  const orderBy: Prisma.BookOrderByWithRelationInput =
    sortBy === 'title'
      ? { title: sortOrder }
      : sortBy === 'createdAt'
        ? { createdAt: sortOrder }
        : sortBy === 'status'
          ? { status: sortOrder }
          : { updatedAt: sortOrder }

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
        status: true,
        gutenbergId: true,
        language: true,
        coverUrl: true,
        updatedAt: true,
        createdAt: true,
        publishedAt: true,
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return {
    data: rows.map((b) => ({
      ...b,
      updatedAt: b.updatedAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
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

export async function importBook(gutenbergId: number): Promise<{ bookId: string; jobId: string }> {
  const existing = await prisma.book.findUnique({
    where: { gutenbergId },
    select: { id: true },
  })
  if (existing) {
    throw new AppError('CONFLICT', 409, 'This Project Gutenberg title is already imported', {})
  }

  const detail = await fetchGutendexBook(gutenbergId)
  if (!detail) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Gutenberg book not found', {})
  }
  if (!detail.plainTextUrl && !detail.htmlUrl) {
    throw new AppError(
      'VALIDATION_ERROR',
      422,
      'This title has no readable HTML or UTF-8 plain text on Gutendex; try another edition.',
      {},
    )
  }

  const slug = await ensureUniqueBookSlug(detail.title)

  const book = await prisma.book.create({
    data: {
      gutenbergId: detail.gutenbergId,
      title: detail.title,
      author: detail.authors[0] ?? 'Unknown',
      language: detail.languages[0] ?? 'en',
      slug,
      coverUrl: detail.coverUrl,
      sourceUrl: detail.htmlUrl ?? detail.plainTextUrl,
      status: BookStatus.IMPORTING_METADATA,
    },
  })

  const job = await prisma.ingestionJob.create({
    data: {
      bookId: book.id,
      status: IngestionJobStatus.QUEUED,
      step: 'queued',
      inputJson: { gutenbergId } satisfies Prisma.InputJsonValue,
    },
  })

  try {
    await enqueueIngestionJob(job.id)
  } catch {
    await prisma.$transaction([
      prisma.ingestionJob.delete({ where: { id: job.id } }),
      prisma.book.delete({ where: { id: book.id } }),
    ])
    throw new AppError(
      'INTERNAL_ERROR',
      503,
      'Job queue is unavailable. Ensure Redis is running and REDIS_URL is set.',
      {},
    )
  }

  return { bookId: book.id, jobId: job.id }
}

export async function deleteBook(bookId: string) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  })
  if (!book) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Book not found', {})
  }

  await prisma.book.delete({
    where: { id: bookId },
  })

  return { ok: true as const }
}

export async function getIngestionJob(bookId: string, jobId: string) {
  const job = await prisma.ingestionJob.findFirst({
    where: { id: jobId, bookId },
  })
  if (!job) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Ingestion job not found', {})
  }

  return {
    id: job.id,
    bookId: job.bookId,
    status: job.status,
    step: job.step,
    error: job.error,
    inputJson: job.inputJson,
    resultJson: job.resultJson,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  }
}

export async function getReviewPayload(bookId: string) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'asc' },
        select: {
          id: true,
          chapterNumber: true,
          title: true,
          wordCount: true,
          paragraphCount: true,
          isPublished: true,
          updatedAt: true,
        },
      },
      ingestionJobs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          step: true,
          error: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  })

  if (!book) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Book not found', {})
  }

  return {
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      slug: book.slug,
      status: book.status,
      gutenbergId: book.gutenbergId,
      coverUrl: book.coverUrl ?? getGutenbergCoverUrl(book.gutenbergId),
      sourceUrl: book.sourceUrl,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    },
    chapters: book.chapters.map((c) => ({
      ...c,
      updatedAt: c.updatedAt.toISOString(),
    })),
    recentIngestionJobs: book.ingestionJobs.map((j) => ({
      id: j.id,
      status: j.status,
      step: j.step,
      error: j.error,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
  }
}

export async function getAdminChapterContent(chapterId: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      book: { select: { id: true, title: true, slug: true } },
      paragraphs: {
        orderBy: { paragraphIndex: 'asc' },
        select: { id: true, paragraphIndex: true, text: true },
      },
    },
  })

  if (!chapter) {
    throw new AppError('CHAPTER_NOT_FOUND', 404, 'Chapter not found', {})
  }

  return {
    chapter: {
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      book: chapter.book,
      paragraphs: chapter.paragraphs,
    },
  }
}

export async function patchChapter(
  chapterId: string,
  body: { title?: string; isPublished?: boolean },
) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, bookId: true },
  })
  if (!chapter) {
    throw new AppError('CHAPTER_NOT_FOUND', 404, 'Chapter not found', {})
  }

  const updated = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
    },
  })

  return updated
}

async function assertPublishable(bookId: string): Promise<void> {
  const chapters = await prisma.chapter.findMany({
    where: { bookId, isPublished: true },
    select: { id: true },
  })

  if (chapters.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      422,
      'Publish requires at least one published chapter.',
      {},
    )
  }

  const counts = await prisma.$queryRaw<Array<{ chapter_id: string; cnt: bigint }>>`
    SELECT chapter_id, COUNT(*)::bigint AS cnt
    FROM chapter_chunks
    WHERE book_id = ${bookId}::uuid
    GROUP BY chapter_id
  `

  const countMap = new Map(counts.map((r) => [r.chapter_id, Number(r.cnt)]))

  for (const ch of chapters) {
    const n = countMap.get(ch.id) ?? 0
    if (n === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        422,
        'Every published chapter must have embeddings before publish.',
        {},
      )
    }
  }
}

export async function publishBook(bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Book not found', {})
  }

  await assertPublishable(bookId)

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: BookStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  })

  return { ok: true as const }
}

export async function unpublishBook(bookId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Book not found', {})
  }

  await prisma.book.update({
    where: { id: bookId },
    data: {
      status: BookStatus.UNPUBLISHED,
    },
  })

  return { ok: true as const }
}
