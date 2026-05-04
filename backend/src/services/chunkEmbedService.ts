import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'

const CHUNK_CHARS = 5500
const BATCH = 64

export function splitIntoChunks(fullText: string): string[] {
  const t = fullText.trim()
  if (!t) return []
  const chunks: string[] = []
  for (let i = 0; i < t.length; i += CHUNK_CHARS) {
    chunks.push(t.slice(i, i + CHUNK_CHARS))
  }
  return chunks
}

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }
  return openaiClient
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenAI()
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
    const resp = await client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: batch,
    })
    for (const item of resp.data) {
      out.push(item.embedding as number[])
    }
  }
  return out
}

export async function insertChapterChunks(params: {
  bookId: string
  chapterId: string
  chapterNumber: number
  chunks: string[]
  embeddings: number[][]
  paragraphStartIndex: number
  paragraphEndIndex: number
}): Promise<void> {
  const { bookId, chapterId, chapterNumber, chunks, embeddings, paragraphStartIndex, paragraphEndIndex } =
    params

  if (chunks.length !== embeddings.length) {
    throw new Error('chunks and embeddings length mismatch')
  }

  for (let i = 0; i < chunks.length; i++) {
    const id = randomUUID()
    const vec = `[${embeddings[i].join(',')}]`
    await prisma.$executeRawUnsafe(
      `INSERT INTO chapter_chunks (id, book_id, chapter_id, chapter_number, chunk_index, text, paragraph_start_index, paragraph_end_index, embedding)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::int, $5::int, $6::text, $7::int, $8::int, $9::text::vector)`,
      id,
      bookId,
      chapterId,
      chapterNumber,
      i,
      chunks[i],
      paragraphStartIndex,
      paragraphEndIndex,
      vec,
    )
  }
}
