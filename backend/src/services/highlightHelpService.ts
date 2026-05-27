import OpenAI from 'openai'
import { AppError } from '../errors/AppError.js'
import { env } from '../config/env.js'
import { assertHighlightRateLimit } from '../lib/highlightRateLimiter.js'
import { requireReadableChapter } from './chapterAccess.js'
import type { HighlightHelpBody, HighlightPronunciationBody } from '../schemas/highlightHelp.js'

let openaiClient: OpenAI | null = null
type Para = { id: string; paragraphIndex: number; wordCount: number; text: string }
type HighlightSelectionBody = Pick<HighlightHelpBody, 'selectedText' | 'paragraphStartIndex' | 'paragraphEndIndex'>

const MAX_PRONUNCIATION_WORDS = 4
const PRONUNCIATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const PRONUNCIATION_CACHE_MAX_ENTRIES = 500
const pronunciationAudioCache = new Map<string, { audio: Buffer; expiresAt: number }>()

function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new AppError('INTERNAL_ERROR', 500, 'OpenAI is not configured', {})
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }
  return openaiClient
}

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function selectionAppearsIn(haystack: string, needle: string): boolean {
  const h = normalizeForMatch(haystack)
  const n = normalizeForMatch(needle)
  if (n.length === 0) return false
  return h.includes(n)
}

async function loadValidatedHighlightSelection(userId: string, chapterId: string, body: HighlightSelectionBody) {
  const { chapter } = await requireReadableChapter(userId, chapterId, true)
  const paragraphs = chapter.paragraphs as Para[]
  const { paragraphStartIndex, paragraphEndIndex, selectedText } = body

  if (paragraphEndIndex < paragraphStartIndex) {
    throw new AppError('VALIDATION_ERROR', 422, 'paragraphEndIndex must be >= paragraphStartIndex', {})
  }

  const inRange = paragraphs.filter(
    (p) => p.paragraphIndex >= paragraphStartIndex && p.paragraphIndex <= paragraphEndIndex,
  )

  const joined =
    inRange.length > 0
      ? inRange
          .slice()
          .sort((a, b) => a.paragraphIndex - b.paragraphIndex)
          .map((p) => p.text)
          .join('\n\n')
      : ''

  const fullChapter = paragraphs
    .slice()
    .sort((a, b) => a.paragraphIndex - b.paragraphIndex)
    .map((p) => p.text)
    .join('\n\n')

  const needle = selectedText.trim()
  const inDeclaredRange = joined.length > 0 && selectionAppearsIn(joined, needle)
  const inChapter = selectionAppearsIn(fullChapter, needle)

  if (!inDeclaredRange && !inChapter) {
    throw new AppError(
      'VALIDATION_ERROR',
      422,
      'Selected text was not found in this chapter. Try a slightly shorter selection.',
      {},
    )
  }

  return { needle, fullChapter }
}

function normalizePronunciationText(selectedText: string): string {
  return selectedText
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^[\s"'“”‘’([{<]+|[\s"'“”‘’)\]}>.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function assertPronounceableText(text: string): void {
  const words = text.split(/\s+/).filter(Boolean)
  if (text.length === 0) {
    throw new AppError('VALIDATION_ERROR', 422, 'Select a word to hear its pronunciation.', {})
  }
  if (words.length > MAX_PRONUNCIATION_WORDS) {
    throw new AppError('VALIDATION_ERROR', 422, 'Select one word or a short phrase for pronunciation.', {})
  }
  if (!/[A-Za-z]/.test(text)) {
    throw new AppError('VALIDATION_ERROR', 422, 'Select a word containing letters for pronunciation.', {})
  }
}

function pronunciationCacheKey(text: string): string {
  return [env.OPENAI_TTS_MODEL, env.OPENAI_TTS_VOICE, text.toLocaleLowerCase('en-US')].join(':')
}

function getCachedPronunciationAudio(key: string): Buffer | null {
  const cached = pronunciationAudioCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    pronunciationAudioCache.delete(key)
    return null
  }
  return cached.audio
}

function setCachedPronunciationAudio(key: string, audio: Buffer): void {
  if (pronunciationAudioCache.size >= PRONUNCIATION_CACHE_MAX_ENTRIES) {
    const oldestKey = pronunciationAudioCache.keys().next().value
    if (oldestKey) pronunciationAudioCache.delete(oldestKey)
  }
  pronunciationAudioCache.set(key, {
    audio,
    expiresAt: Date.now() + PRONUNCIATION_CACHE_TTL_MS,
  })
}

function modeInstruction(mode: HighlightHelpBody['mode']): string {
  switch (mode) {
    case 'EXPLAIN':
      return 'Explain the quoted passage in plain language for a thoughtful adult reader. Stay grounded in the provided chapter context only.'
    case 'SIMPLIFY':
      return 'Rewrite the quoted passage in simpler, clearer language while preserving meaning. Use the chapter context only; do not invent plot beyond the excerpt and context.'
    case 'DEFINE':
      return 'Define or clarify difficult words and phrases in the quoted passage, using the chapter context only.'
    case 'CONTEXT':
      return 'Describe how the quoted passage fits into the surrounding scene or argument in this chapter only. Do not reference other chapters.'
    default:
      return 'Help the reader understand the quoted passage using only the chapter context.'
  }
}

export async function runHighlightHelp(userId: string, chapterId: string, body: HighlightHelpBody) {
  await assertHighlightRateLimit(userId)

  const { needle, fullChapter } = await loadValidatedHighlightSelection(userId, chapterId, body)
  const { mode } = body
  const contextCap = 28_000
  const chapterContext =
    fullChapter.length > contextCap ? `${fullChapter.slice(0, contextCap)}\n…` : fullChapter

  const system = `You help readers understand fiction and literary nonfiction. Answer using ONLY the chapter text provided. If the chapter does not support a confident answer, say so briefly. Do not mention other chapters or future events. Keep the response under about 220 words unless the mode requires brevity (definitions can be shorter).`

  const userMsg = `${modeInstruction(mode)}

Chapter context (same chapter only):
"""
${chapterContext}
"""

Quoted selection:
"""
${needle}
"""
`

  const client = getOpenAI()
  const model = env.OPENAI_CHAT_MODEL

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    max_tokens: 500,
    temperature: 0.4,
  })

  const answer = completion.choices[0]?.message?.content?.trim()
  if (!answer) {
    throw new AppError('INTERNAL_ERROR', 500, 'Empty model response', {})
  }

  return { answer, mode }
}

export async function synthesizeHighlightPronunciation(
  userId: string,
  chapterId: string,
  body: HighlightPronunciationBody,
): Promise<Buffer> {
  const { needle } = await loadValidatedHighlightSelection(userId, chapterId, body)
  const text = normalizePronunciationText(needle)
  assertPronounceableText(text)

  const cacheKey = pronunciationCacheKey(text)
  const cachedAudio = getCachedPronunciationAudio(cacheKey)
  if (cachedAudio) return cachedAudio

  await assertHighlightRateLimit(userId)
  const response = await getOpenAI().audio.speech.create({
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    input: text,
    instructions:
      'Pronounce the input once in a natural General American English accent. Speak clearly and do not add extra words.',
    response_format: 'mp3',
  })
  const arrayBuffer = await response.arrayBuffer()
  const audio = Buffer.from(arrayBuffer)
  setCachedPronunciationAudio(cacheKey, audio)
  return audio
}
