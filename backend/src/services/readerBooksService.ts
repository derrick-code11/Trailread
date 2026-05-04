import { BookStatus, ChapterProgressStatus } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { prisma } from '../lib/prisma.js'
import { assertUuid, requireReadableChapter } from './chapterAccess.js'
import { getChapterProgressPayloadForJson } from './chapterProgressService.js'
import { getGutenbergCoverUrl } from './gutendexService.js'

export async function startBook(userId: string, bookId: string) {
  assertUuid(bookId, 'bookId')

  const book = await prisma.book.findFirst({
    where: { id: bookId, status: BookStatus.PUBLISHED },
    include: {
      chapters: {
        where: { isPublished: true },
        orderBy: { chapterNumber: 'asc' },
      },
    },
  })

  if (!book) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Book not found', {})
  }

  const published = book.chapters
  if (published.length === 0) {
    throw new AppError('VALIDATION_ERROR', 422, 'Book has no published chapters', {})
  }

  const firstChapter = published[0]!

  const chapterIds = published.map((c) => c.id)
  const existingRows = await prisma.userChapterProgress.findMany({
    where: { userId, chapterId: { in: chapterIds } },
    select: { chapterId: true },
  })
  const existingChapterIds = new Set(existingRows.map((r) => r.chapterId))

  const progressToCreate = published
    .filter((ch) => !existingChapterIds.has(ch.id))
    .map((ch) => ({
      userId,
      chapterId: ch.id,
      status: ChapterProgressStatus.UNLOCKED,
      totalParagraphCount: ch.paragraphCount,
    }))

  await prisma.$transaction(
    async (tx) => {
      await tx.userBook.upsert({
        where: { userId_bookId: { userId, bookId } },
        create: {
          userId,
          bookId,
          currentChapterId: firstChapter.id,
          lastOpenedAt: new Date(),
        },
        update: {
          lastOpenedAt: new Date(),
        },
      })

      if (progressToCreate.length > 0) {
        await tx.userChapterProgress.createMany({
          data: progressToCreate,
          skipDuplicates: true,
        })
      }
    },
    { maxWait: 10_000, timeout: 20_000 },
  )

  return getReaderBookBySlug(userId, book.slug)
}

export async function getReaderBookBySlug(userId: string, slug: string) {
  const book = await prisma.book.findFirst({
    where: { slug, status: BookStatus.PUBLISHED },
    include: {
      chapters: {
        where: { isPublished: true },
        orderBy: { chapterNumber: 'asc' },
        select: {
          id: true,
          chapterNumber: true,
          title: true,
          paragraphCount: true,
        },
      },
    },
  })

  if (!book) {
    throw new AppError('BOOK_NOT_FOUND', 404, 'Book not found', {})
  }

  const userBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } },
  })

  const chapterIds = book.chapters.map((c) => c.id)
  const progressRows =
    chapterIds.length === 0
      ? []
      : await prisma.userChapterProgress.findMany({
          where: { userId, chapterId: { in: chapterIds } },
        })
  const progressByChapter = new Map(progressRows.map((p) => [p.chapterId, p]))

  const started = Boolean(userBook)

  return {
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      slug: book.slug,
      language: book.language,
      description: book.description,
      coverUrl: book.coverUrl ?? getGutenbergCoverUrl(book.gutenbergId),
      publishedAt: book.publishedAt?.toISOString() ?? null,
      started,
      chapters: book.chapters.map((c) => {
        const p = progressByChapter.get(c.id)
        const progressStatus: string | null = !started
          ? null
          : p
            ? p.status
            : ChapterProgressStatus.LOCKED
        return {
          id: c.id,
          chapterNumber: c.chapterNumber,
          title: c.title,
          paragraphCount: c.paragraphCount,
          progressStatus,
        }
      }),
    },
  }
}

export async function getReaderChapter(userId: string, chapterId: string) {
  assertUuid(chapterId, 'chapterId')

  const { chapter } = await requireReadableChapter(userId, chapterId, true)

  const progress = await getChapterProgressPayloadForJson(userId, chapterId)

  return {
    chapter: {
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      book: chapter.book,
      paragraphs: chapter.paragraphs,
      ...progress,
    },
  }
}
