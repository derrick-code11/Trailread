import { BookStatus, IngestionJobStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { ensureChapterArtifactsExist, pregenerateChapterArtifacts } from '../services/chapterArtifactsService.js'
import { parseHtmlIntoChapters } from '../services/chapterHtmlParseService.js'
import { parsePlainTextIntoChapters, wordCount, type ParsedChapter } from '../services/chapterParseService.js'
import { embedTexts, insertChapterChunks, splitIntoChunks } from '../services/chunkEmbedService.js'
import { fetchGutendexBook, fetchHtmlFromUrl, fetchPlainTextFromUrl } from '../services/gutendexService.js'

export async function processIngestionJob(ingestionJobId: string): Promise<void> {
  const job = await prisma.ingestionJob.findUnique({
    where: { id: ingestionJobId },
    include: { book: true },
  })

  if (!job) {
    console.warn(`[ingestion] job not found: ${ingestionJobId}`)
    return
  }

  const book = job.book
  if (!book.gutenbergId) {
    await failJob(ingestionJobId, book.id, 'Book is missing gutenbergId')
    return
  }

  try {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.RUNNING,
        startedAt: new Date(),
        step: 'fetch_metadata',
        error: null,
      },
    })

    const detail = await fetchGutendexBook(book.gutenbergId)
    if (!detail) {
      throw new Error('Gutendex book not found')
    }
    if (!detail.htmlUrl && !detail.plainTextUrl) {
      throw new Error('No HTML or plain text URL in Gutendex metadata for this book')
    }

    await prisma.book.update({
      where: { id: book.id },
      data: {
        title: detail.title,
        author: detail.authors[0] ?? book.author,
        language: detail.languages[0] ?? book.language,
        sourceUrl: detail.htmlUrl ?? detail.plainTextUrl,
        status: BookStatus.FETCHING_SOURCE,
      },
    })

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { step: 'fetch_source' },
    })

    let sourceFormat: 'html' | 'plain_text' = 'plain_text'
    let parsed: ParsedChapter[] = []

    if (detail.htmlUrl) {
      const html = await fetchHtmlFromUrl(detail.htmlUrl)
      parsed = parseHtmlIntoChapters(html)
      if (parsed.length > 0) {
        sourceFormat = 'html'
      }
    }

    if (parsed.length === 0) {
      if (!detail.plainTextUrl) {
        throw new Error('HTML parsing found no chapters and no plain text fallback is available')
      }
      const rawText = await fetchPlainTextFromUrl(detail.plainTextUrl)
      parsed = parsePlainTextIntoChapters(rawText)
      sourceFormat = 'plain_text'
    }

    await prisma.book.update({
      where: { id: book.id },
      data: { status: BookStatus.PARSING_CHAPTERS },
    })

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { step: 'parse_chapters' },
    })

    await prisma.chapter.deleteMany({ where: { bookId: book.id } })

    await prisma.book.update({
      where: { id: book.id },
      data: { status: BookStatus.GENERATING_EMBEDDINGS },
    })

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { step: 'generating_embeddings' },
    })

    let chapterNumber = 0
    for (const ch of parsed) {
      chapterNumber += 1
      const combined = ch.paragraphs.join('\n\n')
      const wc = wordCount(combined)
      const paraCount = ch.paragraphs.length

      const chapter = await prisma.chapter.create({
        data: {
          bookId: book.id,
          chapterNumber,
          title: ch.title,
          wordCount: wc,
          paragraphCount: paraCount,
          isPublished: true,
        },
      })

      let pIdx = 0
      for (const text of ch.paragraphs) {
        const wcP = wordCount(text)
        await prisma.paragraph.create({
          data: {
            chapterId: chapter.id,
            paragraphIndex: pIdx,
            text,
            wordCount: wcP,
          },
        })
        pIdx += 1
      }

      const chunks = splitIntoChunks(combined)
      if (chunks.length === 0) continue

      const embeddings = await embedTexts(chunks)
      await insertChapterChunks({
        bookId: book.id,
        chapterId: chapter.id,
        chapterNumber,
        chunks,
        embeddings,
        paragraphStartIndex: 0,
        paragraphEndIndex: Math.max(0, ch.paragraphs.length - 1),
      })

      await ensureChapterArtifactsExist(book.id, chapter.id)
      await pregenerateChapterArtifacts(chapter.id)
    }

    await prisma.book.update({
      where: { id: book.id },
      data: {
        status: BookStatus.NEEDS_REVIEW,
      },
    })

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.COMPLETED,
        completedAt: new Date(),
        step: 'completed',
        resultJson: { chapterCount: parsed.length, sourceFormat } as Prisma.InputJsonValue,
        error: null,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    try {
      await prisma.chapter.deleteMany({ where: { bookId: book.id } })
    } catch {
      /* best-effort cleanup */
    }
    await failJob(ingestionJobId, book.id, message)
  }
}

async function failJob(ingestionJobId: string, bookId: string, message: string): Promise<void> {
  console.error(`[ingestion] failed ${ingestionJobId}: ${message}`)
  await prisma.ingestionJob.updateMany({
    where: { id: ingestionJobId },
    data: {
      status: IngestionJobStatus.FAILED,
      completedAt: new Date(),
      step: 'failed',
      error: message.slice(0, 2000),
    },
  })
  await prisma.book.updateMany({
    where: { id: bookId },
    data: { status: BookStatus.FAILED },
  })
}
