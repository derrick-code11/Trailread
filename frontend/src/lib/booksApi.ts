import { apiUrl, parseBlob, parseJson, ApiRequestError } from '@/lib/jsonFetch'

export { ApiRequestError }

export type HighlightHelpMode = 'EXPLAIN' | 'SIMPLIFY' | 'DEFINE' | 'CONTEXT'

export type ChapterChatGrounding = {
  chunkId: string
  paragraphStartIndex: number
  paragraphEndIndex: number
  relevance: number
}

export type ChapterChatResponse = {
  answer: string
  conversationId: string | null
  limitationMessage: string
  grounding: ChapterChatGrounding[]
}

export type ChapterSummaryResponse = {
  chapterId: string
  title: string | null
  chapterNumber: number
  summary: string
  keyEvents: string[]
  characters: { name: string; description: string }[]
  themes: string[]
}

export type ChapterQuizResponse = {
  chapterId: string
  title: string | null
  chapterNumber: number
  questions: {
    id: string
    prompt: string
    options: string[]
  }[]
}

export type QuizAttemptRequest = {
  answers: {
    questionId: string
    selectedIndex: number
  }[]
}

export type QuizAttemptResponse = {
  chapterId: string
  score: number
  total: number
  results: {
    questionId: string
    prompt: string
    options: string[]
    selectedIndex: number | null
    correctIndex: number
    correct: boolean
    explanation: string
  }[]
}

export type ChapterPodcastStatusResponse = {
  chapterId: string
  status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED'
  audioUrl: string | null
  durationSeconds: number | null
  transcript: string | null
  error: string | null
}

export type CatalogBook = {
  id: string
  title: string
  author: string | null
  slug: string
  language: string
  description: string | null
  coverUrl: string | null
  publishedAt: string | null
}

export type BookDetailChapter = {
  id: string
  chapterNumber: number
  title: string | null
  paragraphCount: number
  progressStatus: string | null
}

export type BookDetailResponse = {
  book: CatalogBook & {
    started: boolean
    chapters: BookDetailChapter[]
  }
}

export type ChapterParagraph = {
  id: string
  paragraphIndex: number
  text: string
}

export type ChapterResponse = {
  chapter: {
    id: string
    chapterNumber: number
    title: string | null
    book: { id: string; title: string; slug: string }
    paragraphs: ChapterParagraph[]
    progressStatus?: string
  }
}

export type Paginated<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
}

async function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<T>(res)
}

export async function listBooks(params?: {
  page?: number
  pageSize?: number
  sortBy?: 'title' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}): Promise<Paginated<CatalogBook>> {
  const sp = new URLSearchParams()
  if (params?.page) sp.set('page', String(params.page))
  if (params?.pageSize) sp.set('pageSize', String(params.pageSize))
  if (params?.sortBy) sp.set('sortBy', params.sortBy)
  if (params?.sortOrder) sp.set('sortOrder', params.sortOrder)
  const q = sp.toString()
  const res = await fetch(apiUrl(`/api/v1/books${q ? `?${q}` : ''}`), { credentials: 'include' })
  return parseJson<Paginated<CatalogBook>>(res)
}

export async function getBookBySlug(slug: string): Promise<BookDetailResponse> {
  const res = await fetch(apiUrl(`/api/v1/books/${encodeURIComponent(slug)}`), {
    credentials: 'include',
  })
  return parseJson<BookDetailResponse>(res)
}

export async function startBook(bookId: string): Promise<BookDetailResponse> {
  return postJson<BookDetailResponse>(`/api/v1/books/${encodeURIComponent(bookId)}/start`, {})
}

export async function getChapter(chapterId: string): Promise<ChapterResponse> {
  const res = await fetch(apiUrl(`/api/v1/chapters/${encodeURIComponent(chapterId)}`), {
    credentials: 'include',
  })
  return parseJson<ChapterResponse>(res)
}

export async function postChapterComplete(chapterId: string): Promise<{ ok: boolean; alreadyComplete?: boolean }> {
  return postJson(`/api/v1/chapters/${encodeURIComponent(chapterId)}/complete`, {})
}

export async function postHighlightHelp(
  chapterId: string,
  body: {
    selectedText: string
    paragraphStartIndex: number
    paragraphEndIndex: number
    mode: HighlightHelpMode
  },
): Promise<{ answer: string; mode: HighlightHelpMode }> {
  return postJson(`/api/v1/chapters/${encodeURIComponent(chapterId)}/highlight-help`, body)
}

export async function postHighlightPronunciation(
  chapterId: string,
  body: {
    selectedText: string
    paragraphStartIndex: number
    paragraphEndIndex: number
  },
): Promise<Blob> {
  const res = await fetch(apiUrl(`/api/v1/chapters/${encodeURIComponent(chapterId)}/highlight-pronunciation`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseBlob(res)
}

export async function postChapterChat(
  chapterId: string,
  body: {
    question: string
    conversationId?: string
  },
): Promise<ChapterChatResponse> {
  return postJson(`/api/v1/chapters/${encodeURIComponent(chapterId)}/chat`, body)
}

export async function getChapterSummary(chapterId: string): Promise<ChapterSummaryResponse> {
  const res = await fetch(apiUrl(`/api/v1/chapters/${encodeURIComponent(chapterId)}/summary`), {
    credentials: 'include',
  })
  return parseJson<ChapterSummaryResponse>(res)
}

export async function getChapterQuiz(chapterId: string): Promise<ChapterQuizResponse> {
  const res = await fetch(apiUrl(`/api/v1/chapters/${encodeURIComponent(chapterId)}/quiz`), {
    credentials: 'include',
  })
  return parseJson<ChapterQuizResponse>(res)
}

export async function postQuizAttempt(
  chapterId: string,
  body: QuizAttemptRequest,
): Promise<QuizAttemptResponse> {
  return postJson(`/api/v1/chapters/${encodeURIComponent(chapterId)}/quiz-attempts`, body)
}

export async function getChapterPodcastStatus(chapterId: string): Promise<ChapterPodcastStatusResponse> {
  const res = await fetch(apiUrl(`/api/v1/chapters/${encodeURIComponent(chapterId)}/podcast`), {
    credentials: 'include',
  })
  return parseJson<ChapterPodcastStatusResponse>(res)
}

export async function postChapterPodcast(chapterId: string): Promise<ChapterPodcastStatusResponse> {
  return postJson(`/api/v1/chapters/${encodeURIComponent(chapterId)}/podcast`, {})
}

export function canOpenChapter(book: BookDetailResponse['book'], chapter: BookDetailChapter): boolean {
  void chapter
  return book.started
}
