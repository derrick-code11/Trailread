import { ArtifactStatus, ArtifactType, ChapterProgressStatus, Prisma } from '@prisma/client'
import OpenAI from 'openai'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'
import { assertPodcastGenerationRateLimit } from '../lib/podcastRateLimiter.js'
import { prisma } from '../lib/prisma.js'
import type { QuizAttemptBody } from '../schemas/chapterArtifacts.js'
import { enqueueArtifactJob } from '../queue/artifactQueue.js'
import { buildPodcastStorageKey, createSignedPlaybackUrl, uploadAudioObject } from './objectStorageService.js'

type ChapterWithParagraphs = Awaited<ReturnType<typeof loadChapterForArtifactWork>>

type SummaryCharacter = {
  name: string
  description: string
}

type SummaryContent = {
  summary: string
  keyEvents: string[]
  characters: SummaryCharacter[]
  themes: string[]
}

type QuizQuestion = {
  id: string
  prompt: string
  options: string[]
  correctAnswerIndex: number
  explanation: string
}

type QuizContent = {
  questions: QuizQuestion[]
}

type PodcastScriptContent = {
  script: string
  estimatedDurationSeconds: number
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

function parseJsonObject<T>(raw: string | null | undefined, label: string): T {
  if (!raw) {
    throw new AppError('INTERNAL_ERROR', 500, `Missing ${label} response`, {})
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new AppError('INTERNAL_ERROR', 500, `Invalid ${label} response`, {})
  }
}

function ensureStringArray(input: unknown, min: number, max: number): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .slice(0, max)
    .slice(0, Math.max(min, max))
}

function truncateParagraphs(chapter: ChapterWithParagraphs, maxChars: number): string {
  let total = 0
  const parts: string[] = []
  for (const paragraph of chapter.paragraphs) {
    const text = paragraph.text.trim()
    if (!text) continue
    const labelled = `Paragraph ${paragraph.paragraphIndex + 1}: ${text}`
    total += labelled.length
    if (total > maxChars) break
    parts.push(labelled)
  }
  return parts.join('\n\n')
}

async function loadChapterForArtifactWork(chapterId: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          author: true,
        },
      },
      paragraphs: {
        orderBy: { paragraphIndex: 'asc' },
        select: {
          paragraphIndex: true,
          text: true,
        },
      },
    },
  })

  if (!chapter) {
    throw new AppError('CHAPTER_NOT_FOUND', 404, 'Chapter not found', {})
  }

  return chapter
}

async function requireCompletedChapterForUser(userId: string, chapterId: string) {
  const chapter = await loadChapterForArtifactWork(chapterId)
  const progress = await prisma.userChapterProgress.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  })

  if (!progress || progress.status !== ChapterProgressStatus.COMPLETED) {
    throw new AppError('FORBIDDEN', 403, 'Finish this chapter to unlock this recap.', {})
  }

  return { chapter, progress }
}

function getArtifactNotReadyError(message: string): AppError {
  return new AppError('AI_ARTIFACT_NOT_READY', 404, message, {})
}

function summaryFromArtifact(artifact: { contentJson: Prisma.JsonValue | null }) {
  const content = (artifact.contentJson ?? {}) as SummaryContent
  return {
    summary: typeof content.summary === 'string' ? content.summary : '',
    keyEvents: Array.isArray(content.keyEvents) ? content.keyEvents.filter((v): v is string => typeof v === 'string') : [],
    characters: Array.isArray(content.characters)
      ? content.characters.filter(
          (value): value is SummaryCharacter =>
            Boolean(value) &&
            typeof value === 'object' &&
            typeof (value as SummaryCharacter).name === 'string' &&
            typeof (value as SummaryCharacter).description === 'string',
        )
      : [],
    themes: Array.isArray(content.themes) ? content.themes.filter((v): v is string => typeof v === 'string') : [],
  }
}

function quizFromArtifact(artifact: { contentJson: Prisma.JsonValue | null }) {
  const content = (artifact.contentJson ?? {}) as QuizContent
  const questions = Array.isArray(content.questions)
    ? content.questions.filter(
        (value): value is QuizQuestion =>
          Boolean(value) &&
          typeof value === 'object' &&
          typeof value.id === 'string' &&
          typeof value.prompt === 'string' &&
          Array.isArray(value.options) &&
          typeof value.correctAnswerIndex === 'number' &&
          typeof value.explanation === 'string',
      )
    : []
  return { questions }
}

export async function ensureChapterArtifactsExist(bookId: string, chapterId: string): Promise<void> {
  for (const type of [
    ArtifactType.CHAPTER_SUMMARY,
    ArtifactType.CHAPTER_QUIZ,
    ArtifactType.PODCAST_SCRIPT,
    ArtifactType.PODCAST_AUDIO,
  ]) {
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

export async function pregenerateChapterArtifacts(chapterId: string): Promise<void> {
  await processArtifactJob(chapterId, ArtifactType.CHAPTER_SUMMARY, { force: false })
  await processArtifactJob(chapterId, ArtifactType.CHAPTER_QUIZ, { force: false })
  await processArtifactJob(chapterId, ArtifactType.PODCAST_SCRIPT, { force: false })
  await processArtifactJob(chapterId, ArtifactType.PODCAST_AUDIO, { force: false })
}

export async function getChapterSummary(userId: string, chapterId: string) {
  const { chapter } = await requireCompletedChapterForUser(userId, chapterId)
  const artifact = await prisma.aiArtifact.findUnique({
    where: { chapterId_type: { chapterId, type: ArtifactType.CHAPTER_SUMMARY } },
  })

  if (!artifact || artifact.status !== ArtifactStatus.READY || !artifact.contentJson) {
    throw getArtifactNotReadyError('Chapter summary is still being prepared.')
  }

  return {
    chapterId: chapter.id,
    title: chapter.title,
    chapterNumber: chapter.chapterNumber,
    ...summaryFromArtifact(artifact),
  }
}

export async function getChapterQuiz(userId: string, chapterId: string) {
  const { chapter } = await requireCompletedChapterForUser(userId, chapterId)
  const artifact = await prisma.aiArtifact.findUnique({
    where: { chapterId_type: { chapterId, type: ArtifactType.CHAPTER_QUIZ } },
  })

  if (!artifact || artifact.status !== ArtifactStatus.READY || !artifact.contentJson) {
    throw getArtifactNotReadyError('Chapter quiz is still being prepared.')
  }

  const quiz = quizFromArtifact(artifact)

  return {
    chapterId: chapter.id,
    title: chapter.title,
    chapterNumber: chapter.chapterNumber,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
    })),
  }
}

export async function submitChapterQuizAttempt(userId: string, chapterId: string, body: QuizAttemptBody) {
  const { chapter } = await requireCompletedChapterForUser(userId, chapterId)
  const artifact = await prisma.aiArtifact.findUnique({
    where: { chapterId_type: { chapterId, type: ArtifactType.CHAPTER_QUIZ } },
  })

  if (!artifact || artifact.status !== ArtifactStatus.READY || !artifact.contentJson) {
    throw getArtifactNotReadyError('Chapter quiz is still being prepared.')
  }

  const quiz = quizFromArtifact(artifact)
  if (quiz.questions.length === 0) {
    throw new AppError('INTERNAL_ERROR', 500, 'Quiz artifact is empty', {})
  }

  const answerMap = new Map(body.answers.map((answer) => [answer.questionId, answer.selectedIndex]))
  const results = quiz.questions.map((question) => {
    const selectedIndex = answerMap.get(question.id)
    const correctIndex = question.correctAnswerIndex
    return {
      questionId: question.id,
      prompt: question.prompt,
      options: question.options,
      selectedIndex: typeof selectedIndex === 'number' ? selectedIndex : null,
      correctIndex,
      correct: selectedIndex === correctIndex,
      explanation: question.explanation,
    }
  })

  const score = results.filter((result) => result.correct).length
  const total = quiz.questions.length

  await prisma.quizAttempt.create({
    data: {
      userId,
      chapterId: chapter.id,
      artifactId: artifact.id,
      score,
      total,
      answersJson: body.answers as unknown as Prisma.InputJsonValue,
    },
  })

  return {
    chapterId: chapter.id,
    score,
    total,
    results,
  }
}

export async function requestChapterPodcast(userId: string, chapterId: string) {
  const { chapter } = await requireCompletedChapterForUser(userId, chapterId)
  await assertPodcastGenerationRateLimit(userId)

  await ensureChapterArtifactsExist(chapter.bookId, chapterId)
  await prisma.aiArtifact.upsert({
    where: { chapterId_type: { chapterId, type: ArtifactType.PODCAST_SCRIPT } },
    create: {
      bookId: chapter.bookId,
      chapterId,
      type: ArtifactType.PODCAST_SCRIPT,
      status: ArtifactStatus.PENDING,
    },
    update: {
      status: ArtifactStatus.PENDING,
      contentJson: Prisma.JsonNull,
      error: null,
      storageKey: null,
    },
  })

  await prisma.aiArtifact.upsert({
    where: { chapterId_type: { chapterId, type: ArtifactType.PODCAST_AUDIO } },
    create: {
      bookId: chapter.bookId,
      chapterId,
      type: ArtifactType.PODCAST_AUDIO,
      status: ArtifactStatus.PENDING,
    },
    update: {
      status: ArtifactStatus.PENDING,
      contentJson: Prisma.JsonNull,
      error: null,
      storageKey: null,
    },
  })

  await enqueueArtifactJob({ chapterId, type: ArtifactType.PODCAST_AUDIO })
  return getChapterPodcastStatus(userId, chapterId)
}

export async function getChapterPodcastStatus(userId: string, chapterId: string) {
  const { chapter } = await requireCompletedChapterForUser(userId, chapterId)
  const audioArtifact = await prisma.aiArtifact.findUnique({
    where: { chapterId_type: { chapterId, type: ArtifactType.PODCAST_AUDIO } },
  })

  if (!audioArtifact) {
    return {
      chapterId: chapter.id,
      status: ArtifactStatus.PENDING,
      audioUrl: null,
      durationSeconds: null,
      transcript: null,
      error: null,
    }
  }

  let audioUrl: string | null = null
  let durationSeconds: number | null = null
  let transcript: string | null = null
  const content = (audioArtifact.contentJson ?? {}) as { durationSeconds?: number; transcript?: string }
  if (typeof content.durationSeconds === 'number') durationSeconds = content.durationSeconds
  if (typeof content.transcript === 'string') transcript = content.transcript

  if (audioArtifact.status === ArtifactStatus.READY && audioArtifact.storageKey) {
    audioUrl = await createSignedPlaybackUrl(audioArtifact.storageKey)
  }

  return {
    chapterId: chapter.id,
    status: audioArtifact.status,
    audioUrl,
    durationSeconds,
    transcript,
    error: audioArtifact.status === ArtifactStatus.FAILED ? audioArtifact.error ?? 'Podcast generation failed.' : null,
  }
}

async function updateArtifactGenerating(chapterId: string, type: ArtifactType) {
  await prisma.aiArtifact.upsert({
    where: { chapterId_type: { chapterId, type } },
    create: {
      chapterId,
      bookId: (await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId }, select: { bookId: true } })).bookId,
      type,
      status: ArtifactStatus.GENERATING,
    },
    update: {
      status: ArtifactStatus.GENERATING,
      error: null,
    },
  })
}

async function saveArtifactReady(
  chapterId: string,
  type: ArtifactType,
  params: { contentJson?: Prisma.InputJsonValue; model?: string; storageKey?: string | null },
) {
  await prisma.aiArtifact.update({
    where: { chapterId_type: { chapterId, type } },
    data: {
      status: ArtifactStatus.READY,
      contentJson: params.contentJson,
      model: params.model,
      storageKey: params.storageKey ?? null,
      error: null,
    },
  })
}

async function saveArtifactFailed(chapterId: string, type: ArtifactType, message: string) {
  await prisma.aiArtifact.upsert({
    where: { chapterId_type: { chapterId, type } },
    create: {
      chapterId,
      bookId: (await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId }, select: { bookId: true } })).bookId,
      type,
      status: ArtifactStatus.FAILED,
      error: message.slice(0, 2000),
    },
    update: {
      status: ArtifactStatus.FAILED,
      error: message.slice(0, 2000),
    },
  })
}

async function generateSummaryContent(chapter: ChapterWithParagraphs): Promise<SummaryContent> {
  const prompt = `Create a concise chapter recap for a classic literature reading companion.
Return JSON with this exact shape:
{
  "summary": string,
  "keyEvents": string[],
  "characters": [{"name": string, "description": string}],
  "themes": string[]
}
Requirements:
- plain English
- grounded only in the chapter text
- 3 to 5 key events
- up to 4 characters
- 2 to 4 themes
- no spoilers beyond the chapter`

  const response = await getOpenAI().responses.create({
    model: env.OPENAI_CHAT_MODEL,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: prompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Book: ${chapter.book.title}
Chapter ${chapter.chapterNumber}${chapter.title ? `: ${chapter.title}` : ''}

Chapter text:
${truncateParagraphs(chapter, 12000)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'chapter_summary',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'keyEvents', 'characters', 'themes'],
          properties: {
            summary: { type: 'string' },
            keyEvents: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
            characters: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'description'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
              minItems: 1,
              maxItems: 4,
            },
            themes: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
          },
        },
      },
    },
  })

  const parsed = parseJsonObject<SummaryContent>(response.output_text, 'summary')
  return {
    summary: parsed.summary?.trim() ?? '',
    keyEvents: ensureStringArray(parsed.keyEvents, 3, 5).slice(0, 5),
    characters: Array.isArray(parsed.characters)
      ? parsed.characters
          .filter(
            (value): value is SummaryCharacter =>
              Boolean(value) && typeof value.name === 'string' && typeof value.description === 'string',
          )
          .slice(0, 4)
      : [],
    themes: ensureStringArray(parsed.themes, 2, 4).slice(0, 4),
  }
}

async function generateQuizContent(chapter: ChapterWithParagraphs): Promise<QuizContent> {
  const response = await getOpenAI().responses.create({
    model: env.OPENAI_CHAT_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: `Create a multiple-choice quiz grounded only in the chapter text.
Return JSON:
{
  "questions": [{
    "id": string,
    "prompt": string,
    "options": string[],
    "correctAnswerIndex": number,
    "explanation": string
  }]
}
Requirements:
- 3 to 5 questions
- exactly 4 answer options per question
- only one correct answer
- explanations should be short and plain-English
- no spoilers beyond the chapter`,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Book: ${chapter.book.title}
Chapter ${chapter.chapterNumber}${chapter.title ? `: ${chapter.title}` : ''}

Chapter text:
${truncateParagraphs(chapter, 12000)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'chapter_quiz',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['questions'],
          properties: {
            questions: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'prompt', 'options', 'correctAnswerIndex', 'explanation'],
                properties: {
                  id: { type: 'string' },
                  prompt: { type: 'string' },
                  options: {
                    type: 'array',
                    minItems: 4,
                    maxItems: 4,
                    items: { type: 'string' },
                  },
                  correctAnswerIndex: { type: 'integer', minimum: 0, maximum: 3 },
                  explanation: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })

  const parsed = parseJsonObject<QuizContent>(response.output_text, 'quiz')
  const questions = Array.isArray(parsed.questions) ? parsed.questions : []
  return {
    questions: questions.slice(0, 5).map((question, index) => ({
      id: question.id?.trim() || `q${index + 1}`,
      prompt: question.prompt.trim(),
      options: question.options.slice(0, 4).map((option) => option.trim()),
      correctAnswerIndex: question.correctAnswerIndex,
      explanation: question.explanation.trim(),
    })),
  }
}

async function generatePodcastScriptContent(chapter: ChapterWithParagraphs): Promise<PodcastScriptContent> {
  const response = await getOpenAI().responses.create({
    model: env.OPENAI_CHAT_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: `Write a single-narrator podcast recap for a chapter of classic literature.
Return JSON:
{
  "script": string,
  "estimatedDurationSeconds": number
}
Requirements:
- 2 to 3 minutes spoken length
- grounded only in this chapter
- plain English
- mention main events, character dynamics, and why the chapter matters
- no intro music cues, no speaker labels, no spoilers beyond the chapter`,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Book: ${chapter.book.title}
Chapter ${chapter.chapterNumber}${chapter.title ? `: ${chapter.title}` : ''}

Chapter text:
${truncateParagraphs(chapter, 14000)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'chapter_podcast_script',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['script', 'estimatedDurationSeconds'],
          properties: {
            script: { type: 'string' },
            estimatedDurationSeconds: { type: 'integer', minimum: 90, maximum: 240 },
          },
        },
      },
    },
  })

  const parsed = parseJsonObject<PodcastScriptContent>(response.output_text, 'podcast script')
  return {
    script: parsed.script.trim(),
    estimatedDurationSeconds: parsed.estimatedDurationSeconds,
  }
}

async function synthesizePodcastAudio(script: string): Promise<Buffer> {
  const response = await getOpenAI().audio.speech.create({
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    input: script,
    response_format: 'mp3',
  })
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function processArtifactJob(
  chapterId: string,
  type: ArtifactType,
  options?: { force?: boolean },
): Promise<void> {
  const chapter = await loadChapterForArtifactWork(chapterId)
  const existing = await prisma.aiArtifact.findUnique({
    where: { chapterId_type: { chapterId, type } },
  })
  const force = options?.force ?? false
  if (!force && existing?.status === ArtifactStatus.READY && type !== ArtifactType.PODCAST_AUDIO) {
    return
  }

  try {
    await updateArtifactGenerating(chapterId, type)

    if (type === ArtifactType.CHAPTER_SUMMARY) {
      const content = await generateSummaryContent(chapter)
      await saveArtifactReady(chapterId, type, {
        contentJson: content as unknown as Prisma.InputJsonValue,
        model: env.OPENAI_CHAT_MODEL,
      })
      return
    }

    if (type === ArtifactType.CHAPTER_QUIZ) {
      const content = await generateQuizContent(chapter)
      await saveArtifactReady(chapterId, type, {
        contentJson: content as unknown as Prisma.InputJsonValue,
        model: env.OPENAI_CHAT_MODEL,
      })
      return
    }

    if (type === ArtifactType.PODCAST_SCRIPT) {
      const content = await generatePodcastScriptContent(chapter)
      await saveArtifactReady(chapterId, type, {
        contentJson: content as unknown as Prisma.InputJsonValue,
        model: env.OPENAI_CHAT_MODEL,
      })
      return
    }

    if (type === ArtifactType.PODCAST_AUDIO) {
      let scriptArtifact = await prisma.aiArtifact.findUnique({
        where: { chapterId_type: { chapterId, type: ArtifactType.PODCAST_SCRIPT } },
      })

      if (!scriptArtifact || scriptArtifact.status !== ArtifactStatus.READY || !scriptArtifact.contentJson) {
        await processArtifactJob(chapterId, ArtifactType.PODCAST_SCRIPT)
        scriptArtifact = await prisma.aiArtifact.findUnique({
          where: { chapterId_type: { chapterId, type: ArtifactType.PODCAST_SCRIPT } },
        })
      }

      if (!scriptArtifact || scriptArtifact.status !== ArtifactStatus.READY || !scriptArtifact.contentJson) {
        throw new Error('Podcast script was not ready')
      }

      const scriptContent = scriptArtifact.contentJson as PodcastScriptContent
      const script = typeof scriptContent.script === 'string' ? scriptContent.script : ''
      if (!script) {
        throw new Error('Podcast script is empty')
      }

      if (!force && existing?.status === ArtifactStatus.READY && existing.storageKey) {
        return
      }

      const audio = await synthesizePodcastAudio(script)
      const storageKey = buildPodcastStorageKey(chapter.bookId, chapter.id)
      await uploadAudioObject(storageKey, audio)
      await saveArtifactReady(chapterId, type, {
        storageKey,
        model: env.OPENAI_TTS_MODEL,
        contentJson: {
          durationSeconds:
            typeof scriptContent.estimatedDurationSeconds === 'number' ? scriptContent.estimatedDurationSeconds : null,
          transcript: script,
        } satisfies Prisma.InputJsonValue,
      })
      return
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await saveArtifactFailed(chapterId, type, message)
    throw error
  }
}
