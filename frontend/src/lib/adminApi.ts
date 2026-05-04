import { apiUrl, parseJson, ApiRequestError } from '@/lib/jsonFetch'

export { ApiRequestError }

export type AdminBookRow = {
  id: string
  title: string
  author: string | null
  slug: string
  status: string
  gutenbergId: number | null
  language: string
  coverUrl: string | null
  updatedAt: string
  createdAt: string
  publishedAt: string | null
}

export type GutendexHit = {
  gutenbergId: number
  title: string
  authors: string[]
  languages: string[]
}

export type IngestionJobDetail = {
  id: string
  bookId: string
  status: string
  step: string | null
  error: string | null
  inputJson: unknown
  resultJson: unknown
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export async function adminListBooks(params?: {
  page?: number
  pageSize?: number
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}) {
  const sp = new URLSearchParams()
  if (params?.page) sp.set('page', String(params.page))
  if (params?.pageSize) sp.set('pageSize', String(params.pageSize))
  if (params?.status) sp.set('status', params.status)
  if (params?.sortBy) sp.set('sortBy', params.sortBy)
  if (params?.sortOrder) sp.set('sortOrder', params.sortOrder)
  const q = sp.toString()
  const res = await fetch(apiUrl(`/api/v1/admin/books${q ? `?${q}` : ''}`), { credentials: 'include' })
  return parseJson<{ data: AdminBookRow[]; pagination: PaginatedMeta }>(res)
}

type PaginatedMeta = { page: number; pageSize: number; totalItems: number; totalPages: number }

export async function searchGutenberg(query: string, options?: { signal?: AbortSignal }) {
  const res = await fetch(
    apiUrl(`/api/v1/admin/gutenberg/search?q=${encodeURIComponent(query)}`),
    { credentials: 'include', signal: options?.signal },
  )
  return parseJson<{ data: GutendexHit[] }>(res)
}

export async function importGutenbergBook(gutenbergId: number) {
  const res = await fetch(apiUrl('/api/v1/admin/books/import'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ gutenbergId }),
  })
  return parseJson<{ bookId: string; jobId: string }>(res)
}

export async function deleteAdminBook(bookId: string) {
  const res = await fetch(apiUrl(`/api/v1/admin/books/${bookId}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) await parseJson<never>(res)
}

export async function getIngestionJob(bookId: string, jobId: string) {
  const res = await fetch(apiUrl(`/api/v1/admin/books/${bookId}/ingestion-jobs/${jobId}`), {
    credentials: 'include',
  })
  return parseJson<IngestionJobDetail>(res)
}

export type ReviewChapter = {
  id: string
  chapterNumber: number
  title: string | null
  wordCount: number
  paragraphCount: number
  isPublished: boolean
  updatedAt: string
}

export type ReviewResponse = {
  book: {
    id: string
    title: string
    author: string | null
    slug: string
    status: string
    gutenbergId: number | null
    coverUrl: string | null
    sourceUrl: string | null
    createdAt: string
    updatedAt: string
  }
  chapters: ReviewChapter[]
  recentIngestionJobs: Array<{
    id: string
    status: string
    step: string | null
    error: string | null
    createdAt: string
    completedAt: string | null
  }>
}

export async function getBookReview(bookId: string) {
  const res = await fetch(apiUrl(`/api/v1/admin/books/${bookId}/review`), { credentials: 'include' })
  return parseJson<ReviewResponse>(res)
}

export async function getAdminChapterContent(chapterId: string) {
  const res = await fetch(apiUrl(`/api/v1/admin/chapters/${encodeURIComponent(chapterId)}/content`), {
    credentials: 'include',
  })
  return parseJson<{
    chapter: {
      id: string
      chapterNumber: number
      title: string | null
      book: { id: string; title: string; slug: string }
      paragraphs: Array<{ id: string; paragraphIndex: number; text: string }>
    }
  }>(res)
}

export async function patchChapter(chapterId: string, body: { title?: string; isPublished?: boolean }) {
  const res = await fetch(apiUrl(`/api/v1/admin/chapters/${chapterId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return parseJson<{ chapter: ReviewChapter }>(res)
}

export async function publishBook(bookId: string) {
  const res = await fetch(apiUrl(`/api/v1/admin/books/${bookId}/publish`), {
    method: 'POST',
    credentials: 'include',
  })
  return parseJson<{ ok: boolean }>(res)
}

export async function unpublishBook(bookId: string) {
  const res = await fetch(apiUrl(`/api/v1/admin/books/${bookId}/unpublish`), {
    method: 'POST',
    credentials: 'include',
  })
  return parseJson<{ ok: boolean }>(res)
}
