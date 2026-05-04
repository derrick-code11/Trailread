import { ReadingMode } from '@prisma/client'
import OpenAI from 'openai'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'
import { assertChapterChatRateLimit } from '../lib/chatRateLimiter.js'
import { prisma } from '../lib/prisma.js'
import type { ChapterChatBody } from '../schemas/chapterChat.js'
import { requireReadableChapter } from './chapterAccess.js'
import { embedTexts } from './chunkEmbedService.js'

const TOP_CHUNK_LIMIT = 6
const MIN_TOP_CHUNK_LIMIT = 4
const MAX_CONTEXT_CHARS_PER_CHUNK = 4_800

type ChapterChunkRow = {
  id: string
  chunkIndex: number
  text: string
  paragraphStartIndex: number
  paragraphEndIndex: number
  distance: number
}

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new AppError('INTERNAL_ERROR', 500, 'OpenAI is not configured', {})
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }
  return openaiClient
}

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

function truncateChunk(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= MAX_CONTEXT_CHARS_PER_CHUNK) return trimmed
  return `${trimmed.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK)}...`
}

function isFutureSpoilerQuestion(question: string): boolean {
  const q = question.toLowerCase()
  return [
    /\bwhat happens next\b/,
    /\bnext chapter\b/,
    /\blater in (the )?(book|story|novel)\b/,
    /\bhow (does|will) (it|this|the story) end\b/,
    /\bending\b/,
    /\bspoiler\b/,
    /\bdoes .{1,80}\b(die|survive|marry|return|win|lose)\b/,
    /\bwill .{1,80}\b(die|survive|marry|return|win|lose|happen)\b/,
  ].some((pattern) => pattern.test(q))
}

function isTooVagueQuestion(question: string): boolean {
  const words = question
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words.length < 3 || /^(help|explain|why|what|who|how)\??$/i.test(question.trim())
}

async function retrieveChapterChunks(chapterId: string, embedding: number[]): Promise<ChapterChunkRow[]> {
  const rows = await prisma.$queryRawUnsafe<ChapterChunkRow[]>(
    `SELECT
       id::text AS id,
       chunk_index AS "chunkIndex",
       text,
       paragraph_start_index AS "paragraphStartIndex",
       paragraph_end_index AS "paragraphEndIndex",
       (embedding <=> $2::vector) AS distance
     FROM chapter_chunks
     WHERE chapter_id = $1::uuid
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    chapterId,
    vectorLiteral(embedding),
    TOP_CHUNK_LIMIT,
  )

  return rows
}

function buildContext(chunks: ChapterChunkRow[]): string {
  return chunks
    .map((chunk, idx) => {
      const label = `Source ${idx + 1}: paragraphs ${chunk.paragraphStartIndex}-${chunk.paragraphEndIndex}`
      return `${label}\n"""\n${truncateChunk(chunk.text)}\n"""`
    })
    .join('\n\n')
}

export async function runChapterChat(userId: string, chapterId: string, body: ChapterChatBody) {
  await assertChapterChatRateLimit(userId)

  const { chapter, userBook } = await requireReadableChapter(userId, chapterId, false)
  const question = body.question.trim()

  if (userBook.mode === ReadingMode.GUIDED && isFutureSpoilerQuestion(question)) {
    throw new AppError(
      'VALIDATION_ERROR',
      422,
      'I can only answer from the current chapter. Try asking about something that has happened in this chapter.',
      {},
    )
  }

  const limitationMessage =
    'Answers are grounded only in this chapter. If the retrieved text does not support an answer, the assistant will say so.'

  if (isTooVagueQuestion(question)) {
    return {
      answer: 'Ask a more specific question about a character, scene, quote, or idea from this chapter.',
      conversationId: body.conversationId ?? null,
      limitationMessage,
      grounding: [],
    }
  }

  const [embedding] = await embedTexts([question])
  if (!embedding) {
    throw new AppError('INTERNAL_ERROR', 500, 'Could not embed question', {})
  }

  const chunks = await retrieveChapterChunks(chapterId, embedding)
  if (chunks.length < MIN_TOP_CHUNK_LIMIT) {
    return {
      answer:
        'I do not have enough indexed chapter context to answer this yet. Try again after this book finishes processing.',
      conversationId: body.conversationId ?? null,
      limitationMessage,
      grounding: chunks.map((chunk) => ({
        chunkId: chunk.id,
        paragraphStartIndex: chunk.paragraphStartIndex,
        paragraphEndIndex: chunk.paragraphEndIndex,
        relevance: Number((1 - chunk.distance).toFixed(4)),
      })),
    }
  }

  const system = `You are Trailread's chapter chat assistant. Answer using ONLY the provided current-chapter sources.
If the sources do not contain enough evidence, say that the chapter text does not support a confident answer.
Do not mention future chapters, outside summaries, or facts not present in the sources.
Keep answers concise, clear, and useful for an adult reader.`

  const userMsg = `Book: ${chapter.book.title}
Chapter ${chapter.chapterNumber}${chapter.title ? `: ${chapter.title}` : ''}

Current-chapter sources:
${buildContext(chunks)}

Reader question:
${question}`

  const completion = await getOpenAI().chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    max_tokens: 650,
    temperature: 0.35,
  })

  const answer = completion.choices[0]?.message?.content?.trim()
  if (!answer) {
    throw new AppError('INTERNAL_ERROR', 500, 'Empty model response', {})
  }

  return {
    answer,
    conversationId: body.conversationId ?? null,
    limitationMessage,
    grounding: chunks.map((chunk) => ({
      chunkId: chunk.id,
      paragraphStartIndex: chunk.paragraphStartIndex,
      paragraphEndIndex: chunk.paragraphEndIndex,
      relevance: Number((1 - chunk.distance).toFixed(4)),
    })),
  }
}
