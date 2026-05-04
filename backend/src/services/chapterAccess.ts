import { BookStatus } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { prisma } from '../lib/prisma.js'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertUuid(id: string, label: string): void {
  if (!uuidRegex.test(id)) {
    throw new AppError('VALIDATION_ERROR', 422, `Invalid ${label}`, {})
  }
}

export async function requireReadableChapter(
  userId: string,
  chapterId: string,
  includeParagraphText: boolean,
) {
  assertUuid(chapterId, 'chapterId')

  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      isPublished: true,
      book: { status: BookStatus.PUBLISHED },
    },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      paragraphs: {
        orderBy: { paragraphIndex: 'asc' },
        select: includeParagraphText
          ? { id: true, paragraphIndex: true, wordCount: true, text: true }
          : { id: true, paragraphIndex: true, wordCount: true },
      },
    },
  })

  if (!chapter) {
    throw new AppError('CHAPTER_NOT_FOUND', 404, 'Chapter not found', {})
  }

  const userBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId: chapter.bookId } },
  })

  if (!userBook) {
    throw new AppError('FORBIDDEN', 403, 'Start this book before opening chapters', {})
  }

  return { chapter, userBook }
}
