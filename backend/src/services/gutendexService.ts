import { AppError } from '../errors/AppError.js'

const BASE = 'https://gutendex.com/books'

export function getGutenbergCoverUrl(gutenbergId: number | null | undefined): string | null {
  if (!gutenbergId) return null
  return `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.medium.jpg`
}

export type GutendexSearchHit = {
  gutenbergId: number
  title: string
  authors: string[]
  languages: string[]
}

export async function searchGutendex(query: string): Promise<GutendexSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const url = new URL(BASE + '/')
  url.searchParams.set('search', q)

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new AppError('INTERNAL_ERROR', 502, 'Gutendex search failed', {})
  }

  const json = (await res.json()) as {
    results?: Array<{
      id: number
      title: string
      authors: Array<{ name: string }>
      languages: string[]
    }>
  }

  const results = json.results ?? []
  return results.map((r) => ({
    gutenbergId: r.id,
    title: String(r.title ?? '').trim() || 'Untitled',
    authors: (r.authors ?? []).map((a) => String(a.name ?? '').trim()).filter(Boolean),
    languages: r.languages?.length ? r.languages : ['en'],
  }))
}

export type GutendexBookDetail = {
  gutenbergId: number
  title: string
  authors: string[]
  languages: string[]
  plainTextUrl: string | null
  htmlUrl: string | null
  coverUrl: string | null
}

function pickPlainTextUrl(formats: Record<string, string> | undefined): string | null {
  if (!formats) return null
  const keys = Object.keys(formats)
  const utf = keys.find((k) => k.includes('text/plain') && k.includes('utf-8'))
  if (utf) return formats[utf] ?? null
  const plain = keys.find((k) => k.startsWith('text/plain'))
  if (plain) return formats[plain] ?? null
  return null
}

function pickHtmlUrl(formats: Record<string, string> | undefined): string | null {
  if (!formats) return null
  const html = Object.entries(formats).find(([key]) => key.includes('text/html'))?.[1]
  return html ?? null
}

function pickCoverUrl(formats: Record<string, string> | undefined): string | null {
  if (!formats) return null
  const jpg = formats['image/jpeg']
  if (jpg) return jpg

  const imageKey = Object.keys(formats).find((key) => key.startsWith('image/'))
  return imageKey ? formats[imageKey] ?? null : null
}

export async function fetchGutendexBook(gutenbergId: number): Promise<GutendexBookDetail | null> {
  const url = `${BASE}/${gutenbergId}/`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) return null

  const r = (await res.json()) as {
    id: number
    title: string
    authors: Array<{ name: string }>
    languages: string[]
    formats: Record<string, string>
  }

  return {
    gutenbergId: r.id,
    title: String(r.title ?? '').trim() || 'Untitled',
    authors: (r.authors ?? []).map((a) => String(a.name ?? '').trim()).filter(Boolean),
    languages: r.languages?.length ? r.languages : ['en'],
    plainTextUrl: pickPlainTextUrl(r.formats),
    htmlUrl: pickHtmlUrl(r.formats),
    coverUrl: pickCoverUrl(r.formats) ?? getGutenbergCoverUrl(r.id),
  }
}

export async function fetchHtmlFromUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' })
  if (!res.ok) {
    throw new AppError('INTERNAL_ERROR', 502, 'Failed to download book HTML', { status: res.status })
  }
  const html = await res.text()
  if (html.length < 200) {
    throw new AppError('INTERNAL_ERROR', 422, 'Downloaded HTML is too short', {})
  }
  return html
}

export async function fetchPlainTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new AppError('INTERNAL_ERROR', 502, 'Failed to download book source text', { status: res.status })
  }
  const text = await res.text()
  if (text.length < 200) {
    throw new AppError('INTERNAL_ERROR', 422, 'Downloaded source text is too short', {})
  }
  return text
}
