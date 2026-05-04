import { apiUrl, parseJson, ApiRequestError } from '@/lib/jsonFetch'

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

export async function postChapterChat(
  chapterId: string,
  body: {
    question: string
    conversationId?: string
  },
): Promise<ChapterChatResponse> {
  return postJson(`/api/v1/chapters/${encodeURIComponent(chapterId)}/chat`, body)
}

export function canOpenChapter(book: BookDetailResponse['book'], chapter: BookDetailChapter): boolean {
  void chapter
  return book.started
}
