import {
  ArtifactStatus,
  ArtifactType,
  ChapterProgressStatus,
} from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { prisma } from '../lib/prisma.js'
import { requireReadableChapter } from './chapterAccess.js'
import type { ProgressEventsBody } from '../schemas/chapterReader.js'

const FAST_SCROLL_PX_PER_S = 950
const MAX_DWELL_PER_EVENT = 45

function dwellToMarkRead(wordCount: number): number {
  return Math.max(16, wordCount * 0.32)
}

function calendarDateUtc(ianaTz: string, now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  return new Date(Date.UTC(y, m - 1, d))
}

function paragraphReadRatio(readParagraphCount: number, totalParagraphCount: number): number {
  const total = Math.max(1, totalParagraphCount)
  return readParagraphCount / total
}

export async function getChapterProgressPayloadForJson(userId: string, chapterId: string) {
  const cp = await prisma.userChapterProgress.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  })
  if (!cp) {
    return {}
  }

  return {
    progressStatus: cp.status,
    readParagraphCount: cp.readParagraphCount,
    totalParagraphCount: cp.totalParagraphCount,
    completionConfidence: paragraphReadRatio(cp.readParagraphCount, cp.totalParagraphCount),
    dwellSeconds: cp.dwellSeconds,
  }
}

export async function appendProgressEvents(userId: string, chapterId: string, body: ProgressEventsBody) {
  const { chapter } = await requireReadableChapter(userId, chapterId, false)

  const cp = await prisma.userChapterProgress.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  })
  if (!cp) {
    throw new AppError('INTERNAL_ERROR', 500, 'Missing chapter progress', {})
  }

  if (cp.status === ChapterProgressStatus.COMPLETED) {
    return getChapterProgressPayloadForJson(userId, chapterId)
  }

  let chapterDwellDelta = 0

  for (const ev of body.events) {
    const paragraph = chapter.paragraphs.find((p) => p.id === ev.paragraphId)
    if (!paragraph) continue

    let dwellDelta = 0
    if (ev.pageFocused && ev.scrollVelocity < FAST_SCROLL_PX_PER_S) {
      dwellDelta = Math.min(MAX_DWELL_PER_EVENT, ev.dwellSeconds)
    }
    chapterDwellDelta += dwellDelta

    const existing = await prisma.userParagraphProgress.findUnique({
      where: { userId_paragraphId: { userId, paragraphId: paragraph.id } },
    })

    const newMaxRatio = Math.max(existing?.maxVisibleRatio ?? 0, ev.visibleRatio)
    const newDwell = (existing?.dwellSeconds ?? 0) + dwellDelta
    const read =
      newMaxRatio >= 0.55 && newDwell >= dwellToMarkRead(paragraph.wordCount || 1)

    await prisma.userParagraphProgress.upsert({
      where: { userId_paragraphId: { userId, paragraphId: paragraph.id } },
      create: {
        userId,
        paragraphId: paragraph.id,
        dwellSeconds: newDwell,
        maxVisibleRatio: newMaxRatio,
        read,
        readAt: read ? new Date() : null,
      },
      update: {
        dwellSeconds: newDwell,
        maxVisibleRatio: newMaxRatio,
        read,
        readAt: read ? (existing?.readAt ?? new Date()) : existing?.readAt ?? null,
      },
    })
  }

  const readCount = await prisma.userParagraphProgress.count({
    where: { userId, paragraph: { chapterId }, read: true },
  })

  const total = Math.max(cp.totalParagraphCount, chapter.paragraphs.length)

  const ppRows = await prisma.userParagraphProgress.findMany({
    where: { userId, paragraph: { chapterId } },
    include: { paragraph: { select: { paragraphIndex: true } } },
  })
  let lastSeenIdx = cp.lastParagraphIndex ?? -1
  for (const r of ppRows) {
    if ((r.maxVisibleRatio ?? 0) >= 0.1) {
      lastSeenIdx = Math.max(lastSeenIdx, r.paragraph.paragraphIndex)
    }
  }
  for (const ev of body.events) {
    if (ev.finalParagraphSeen) {
      const p = chapter.paragraphs.find((x) => x.id === ev.paragraphId)
      if (p) lastSeenIdx = Math.max(lastSeenIdx, p.paragraphIndex)
    }
  }

  const newDwellTotal = cp.dwellSeconds + Math.floor(chapterDwellDelta)
  const confidence = total > 0 ? readCount / total : 0

  let nextStatus = cp.status
  if (readCount > 0 || chapterDwellDelta > 0) {
    if (cp.status === ChapterProgressStatus.UNLOCKED || cp.status === ChapterProgressStatus.LOCKED) {
      nextStatus = ChapterProgressStatus.IN_PROGRESS
    }
  }

  await prisma.userChapterProgress.update({
    where: { userId_chapterId: { userId, chapterId } },
    data: {
      readParagraphCount: readCount,
      totalParagraphCount: total,
      dwellSeconds: newDwellTotal,
      lastParagraphIndex: lastSeenIdx >= 0 ? lastSeenIdx : cp.lastParagraphIndex,
      completionConfidence: confidence,
      status: nextStatus,
      startedAt: cp.startedAt ?? new Date(),
    },
  })

  return {
    readParagraphCount: readCount,
    totalParagraphCount: total,
    completionConfidence: paragraphReadRatio(readCount, total),
    dwellSeconds: newDwellTotal,
  }
}

async function ensurePendingArtifacts(bookId: string, chapterId: string) {
  for (const type of [ArtifactType.CHAPTER_SUMMARY, ArtifactType.CHAPTER_QUIZ]) {
    await prisma.aiArtifact.upsert({
      where: { chapterId_type: { chapterId, type } },
      create: {
        bookId,
        chapterId,
        type,
        status: ArtifactStatus.PENDING,
      },
      update: {},
    })
  }
}

async function incrementReadingDayForCompletion(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  })
  const tz = user?.timezone && user.timezone.length > 0 ? user.timezone : 'UTC'
  const day = calendarDateUtc(tz, new Date())

  await prisma.readingDay.upsert({
    where: { userId_calendarDate: { userId, calendarDate: day } },
    create: {
      userId,
      calendarDate: day,
      chaptersCompletedCount: 1,
      minutesRead: 0,
    },
    update: {
      chaptersCompletedCount: { increment: 1 },
    },
  })
}

export async function completeChapter(userId: string, chapterId: string) {
  const { chapter } = await requireReadableChapter(userId, chapterId, false)

  const cp = await prisma.userChapterProgress.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  })
  if (!cp) {
    throw new AppError('INTERNAL_ERROR', 500, 'Missing chapter progress', {})
  }

  if (cp.status === ChapterProgressStatus.COMPLETED) {
    return { ok: true as const, alreadyComplete: true as const }
  }

  const confidence = paragraphReadRatio(cp.readParagraphCount, cp.totalParagraphCount)

  await prisma.$transaction(async (tx) => {
    await tx.userChapterProgress.update({
      where: { userId_chapterId: { userId, chapterId } },
      data: {
        status: ChapterProgressStatus.COMPLETED,
        completedAt: new Date(),
        manuallyCompleted: false,
        completionConfidence: confidence,
      },
    })

    const nextChapter = await tx.chapter.findFirst({
      where: {
        bookId: chapter.bookId,
        isPublished: true,
        chapterNumber: { gt: chapter.chapterNumber },
      },
      orderBy: { chapterNumber: 'asc' },
    })

    await tx.userBook.update({
      where: { userId_bookId: { userId, bookId: chapter.bookId } },
      data: {
        currentChapterId: nextChapter?.id ?? chapterId,
        lastOpenedAt: new Date(),
      },
    })
  })

  await ensurePendingArtifacts(chapter.bookId, chapterId)
  await incrementReadingDayForCompletion(userId)

  return { ok: true as const }
}
