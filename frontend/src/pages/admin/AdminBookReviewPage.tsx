import { BookOpen, Eye, EyeOff, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { BookCover } from '@/components/books/BookCover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ApiRequestError,
  getAdminChapterContent,
  getBookReview,
  patchChapter,
  publishBook,
  unpublishBook,
  type ReviewChapter,
  type ReviewResponse,
} from '@/lib/adminApi'
import { cn } from '@/lib/utils'

export function AdminBookReviewPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReviewChapter | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getAdminChapterContent>> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [chapterSearch, setChapterSearch] = useState('')

  const refresh = useCallback(async () => {
    if (!bookId) return
    const r = await getBookReview(bookId)
    setReview(r)
    setSelected((prev) => {
      if (r.chapters.length === 0) return null
      if (prev) {
        const m = r.chapters.find((c) => c.id === prev.id)
        if (m) return m
      }
      return r.chapters[0]
    })
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    ;(async () => {
      try {
        await refresh()
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiRequestError ? e.message : 'Failed to load review.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, refresh])

  useEffect(() => {
    if (!selected) return
    /* eslint-disable react-hooks/set-state-in-effect -- mirror selected chapter into title field */
    setTitleDraft(selected.title ?? '')
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only when chapter id or persisted title changes
  }, [selected?.id, selected?.title])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      setPreviewLoading(true)
      try {
        const res = await getAdminChapterContent(selected.id)
        if (!cancelled) setPreview(res)
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preview tracks selected chapter id only
  }, [selected?.id])

  const filteredChapters = useMemo(() => {
    if (!review) return []
    const query = chapterSearch.trim().toLowerCase()
    if (!query) return review.chapters

    return review.chapters.filter((chapter) => {
      const title = chapter.title?.trim() || `Chapter ${chapter.chapterNumber}`
      return title.toLowerCase().includes(query) || String(chapter.chapterNumber).includes(query)
    })
  }, [chapterSearch, review])

  const publishedChapterCount = useMemo(
    () => review?.chapters.filter((chapter) => chapter.isPublished).length ?? 0,
    [review],
  )

  const totalWordCount = useMemo(
    () => review?.chapters.reduce((total, chapter) => total + chapter.wordCount, 0) ?? 0,
    [review],
  )

  if (!bookId) {
    return <p>Missing book id.</p>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-border-subtle)] p-6">
        <p>{error}</p>
        <Link to="/admin/books" className="mt-4 inline-block text-sm font-medium text-[var(--color-primary-700)] underline">
          Back to list
        </Link>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Loading review…
      </div>
    )
  }

  const book = review.book

  async function saveTitle() {
    if (!selected) return
    setSaving(true)
    setActionMsg(null)
    try {
      await patchChapter(selected.id, { title: titleDraft.trim() })
      await refresh()
      setActionMsg('Saved.')
    } catch (e) {
      setActionMsg(e instanceof ApiRequestError ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublished(next: boolean) {
    if (!selected) return
    setSaving(true)
    setActionMsg(null)
    try {
      await patchChapter(selected.id, { isPublished: next })
      await refresh()
      setActionMsg('Updated.')
    } catch (e) {
      setActionMsg(e instanceof ApiRequestError ? e.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  async function onPublish() {
    setActionMsg(null)
    try {
      await publishBook(book.id)
      await refresh()
      setActionMsg('Published.')
    } catch (e) {
      setActionMsg(e instanceof ApiRequestError ? e.message : 'Publish failed.')
    }
  }

  async function onUnpublish() {
    setActionMsg(null)
    try {
      await unpublishBook(book.id)
      await refresh()
      setActionMsg('Unpublished.')
    } catch (e) {
      setActionMsg(e instanceof ApiRequestError ? e.message : 'Unpublish failed.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-tr-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-tr-xs)] sm:p-6">
        <p className="text-xs text-[var(--color-text-secondary)]">
          <Link to="/admin/books" className="hover:text-[var(--color-text-primary)]">
            Admin books
          </Link>
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[156px_minmax(0,1fr)_auto]">
          <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} className="w-32 sm:w-full" />

          <div className="min-w-0 self-end">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {book.status.replace('_', ' ')}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {book.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{book.author ?? 'Unknown author'}</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--color-text-tertiary)]">Chapters</dt>
                <dd className="mt-1 font-semibold text-[var(--color-text-primary)]">{review.chapters.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-tertiary)]">Visible</dt>
                <dd className="mt-1 font-semibold text-[var(--color-text-primary)]">{publishedChapterCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-tertiary)]">Words</dt>
                <dd className="mt-1 font-semibold text-[var(--color-text-primary)]">{totalWordCount.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-start gap-2 sm:col-start-2 sm:row-start-2 lg:col-start-auto lg:row-start-auto lg:justify-end">
            {book.status !== 'PUBLISHED' ? (
              <Button type="button" onClick={() => void onPublish()}>
                Publish
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => void onUnpublish()}>
                Unpublish
              </Button>
            )}
          </div>
        </div>
      </section>

      {actionMsg ? <p className="text-sm text-[var(--color-text-secondary)]">{actionMsg}</p> : null}

      <div className="grid min-h-[640px] gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <aside className="min-w-0 rounded-[var(--radius-tr-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-tr-xs)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]">
          <div className="border-b border-[var(--color-border-subtle)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Chapters</h2>
              <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                {filteredChapters.length}
              </span>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" aria-hidden />
              <Input
                value={chapterSearch}
                onChange={(event) => setChapterSearch(event.target.value)}
                placeholder="Search chapters"
                className="pl-9"
                aria-label="Search chapters"
              />
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2 lg:max-h-[calc(100vh-15rem)]">
            {filteredChapters.length > 0 ? (
              <ol className="space-y-1">
                {filteredChapters.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(c)
                        setTitleDraft(c.title ?? '')
                      }}
                      className={cn(
                        'grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                        selected?.id === c.id
                          ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-900)]'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)]',
                      )}
                    >
                      <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                        {String(c.chapterNumber).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.title?.trim() || `Chapter ${c.chapterNumber}`}</span>
                        <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                          {c.paragraphCount} paragraphs · {c.wordCount.toLocaleString()} words
                        </span>
                      </span>
                      {c.isPublished ? (
                        <Eye className="size-4 text-[var(--color-primary-700)]" aria-label="Visible" />
                      ) : (
                        <EyeOff className="size-4 text-[var(--color-text-tertiary)]" aria-label="Hidden" />
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]">No chapters match that search.</p>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-[var(--radius-tr-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-tr-xs)]">
          {selected ? (
            <>
              <div className="border-b border-[var(--color-border-subtle)] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      <BookOpen className="size-3.5" aria-hidden />
                      Chapter {selected.chapterNumber}
                    </p>
                    <h2 className="mt-2 truncate font-display text-xl font-semibold text-[var(--color-text-primary)]">
                      {selected.title?.trim() || `Chapter ${selected.chapterNumber}`}
                    </h2>
                  </div>
                  <label className="flex items-center gap-2 rounded-full bg-[var(--color-bg-muted)] px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.isPublished}
                      onChange={(e) => void togglePublished(e.target.checked)}
                    />
                    Visible
                  </label>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="ch-title">Chapter title</Label>
                    <Input
                      id="ch-title"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                    />
                  </div>
                  <Button type="button" disabled={saving} onClick={() => void saveTitle()} className="self-end">
                    Save title
                  </Button>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Text preview</h3>
                {previewLoading ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading text…
                  </p>
                ) : preview ? (
                  <article className="mt-3 max-h-[min(72vh,680px)] overflow-y-auto rounded-[var(--radius-tr-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-5 py-6 font-display text-[16px] leading-8 text-[var(--color-text-primary)] sm:px-8">
                    {preview.chapter.paragraphs.map((p) => (
                      <p key={p.id} className="mb-5 last:mb-0">
                        {p.text}
                      </p>
                    ))}
                  </article>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Could not load preview.</p>
                )}
              </div>
            </>
          ) : (
            <p className="p-6 text-sm text-[var(--color-text-secondary)]">No chapters parsed yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
