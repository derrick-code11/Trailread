import { BookOpen, ChevronRight, Clock3, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BookCover } from '@/components/books/BookCover'
import { Button } from '@/components/ui/button'
import { ApiRequestError, canOpenChapter, getBookBySlug, startBook, type BookDetailResponse } from '@/lib/booksApi'

const FALLBACK_BOOK_SUMMARIES: Record<string, string> = {
  'great-expectations':
    'Pip, an orphan raised on the Kent marshes, is drawn from a humble childhood into London society after receiving a mysterious fortune from an unknown benefactor. As his expectations rise, he must confront ambition, shame, loyalty, and the true cost of becoming a gentleman.',
}

export function BookDetailPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<BookDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    if (!bookSlug) return
    const res = await getBookBySlug(bookSlug)
    setData(res)
  }, [bookSlug])

  useEffect(() => {
    if (!bookSlug) return
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        await load()
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof ApiRequestError ? e.message : 'Could not load book.'
          setError(msg)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookSlug, load])

  const handleStartAndGoToChapter = async (chapterNumber: number) => {
    if (!data) return
    setStarting(true)
    setError(null)
    try {
      const res = await startBook(data.book.id)
      setData(res)
      navigate(`/app/books/${encodeURIComponent(res.book.slug)}/chapters/${chapterNumber}`)
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not start book.')
    } finally {
      setStarting(false)
    }
  }

  if (!bookSlug) {
    return <p className="text-[var(--color-text-secondary)]">Missing book.</p>
  }

  if (error && !data) {
    return (
      <div className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[var(--shadow-tr-xs)]">
        <p className="text-[var(--color-text-primary)]">{error}</p>
        <Link to="/app/books" className="mt-4 inline-block text-sm font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline">
          Back to library
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-16 text-[var(--color-text-secondary)]">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }

  const { book } = data
  const chapters = [...book.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
  const firstPublished = chapters[0] ?? null
  const firstReadable = chapters.find((c) => canOpenChapter(book, c)) ?? null
  const totalParagraphs = chapters.reduce((sum, chapter) => sum + chapter.paragraphCount, 0)
  const summary = book.description?.trim() || FALLBACK_BOOK_SUMMARIES[book.slug] || null
  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-[18px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[30px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-tr-sm)] sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[14rem_1fr] lg:items-start">
          <div className="flex h-full items-center justify-center lg:min-h-[24rem]">
            <BookCover
              title={book.title}
              author={book.author}
              coverUrl={book.coverUrl}
              className="w-44 lg:w-full"
            />
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.4rem,7vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
              {book.title}
            </h1>
            <p className="mt-4 text-lg text-[var(--color-text-secondary)]">{book.author ?? 'Unknown author'}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                <BookOpen className="size-4 text-[var(--color-primary-700)]" aria-hidden />
                {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                <Clock3 className="size-4 text-[var(--color-primary-700)]" aria-hidden />
                {totalParagraphs.toLocaleString()} paragraphs
              </span>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-[15px]">
              {summary ?? 'No summary is available for this book yet.'}
            </p>

            {!book.started && firstPublished ? (
              <Button className="mt-7 rounded-full px-5" size="lg" disabled={starting} onClick={() => void handleStartAndGoToChapter(firstPublished.chapterNumber)}>
                {starting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Starting…
                  </>
                ) : (
                  <>
                    Start reading
                    <ChevronRight className="size-4" aria-hidden />
                  </>
                )}
              </Button>
            ) : null}

            {book.started && firstReadable ? (
              <Button className="mt-7 rounded-full px-5" size="lg" asChild>
                <Link to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${firstReadable.chapterNumber}`}>
                  Continue reading
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-tr-xs)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Contents</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Chapters</h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{chapters.length} total</p>
        </div>

        <ol className="mt-5 divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-[18px] border border-[var(--color-border-subtle)]">
          {chapters.map((c) => {
            const open = canOpenChapter(book, c)
            const isFirstPublished = firstPublished != null && c.id === firstPublished.id
            const rowClass =
              'group grid gap-3 bg-[var(--color-bg-elevated)] px-4 py-4 text-sm outline-none transition-colors sm:grid-cols-[4.5rem_1fr_auto] sm:items-center'

            const innerMain = (
              <>
                <span className="font-display text-xl font-semibold tabular-nums text-[var(--color-text-tertiary)]">
                  {String(c.chapterNumber).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--color-text-primary)]">
                    {c.title?.trim() ? c.title : `Chapter ${c.chapterNumber}`}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{c.paragraphCount} paragraphs</span>
                </span>
              </>
            )

            if (!book.started) {
              if (isFirstPublished) {
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={starting}
                      onClick={() => void handleStartAndGoToChapter(c.chapterNumber)}
                      className={`${rowClass} w-full cursor-pointer text-left hover:bg-[var(--color-bg-muted)] focus-visible:bg-[var(--color-bg-muted)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-300)] disabled:cursor-wait disabled:opacity-70`}
                    >
                      {innerMain}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold sm:justify-self-end">
                        <span className="text-[var(--color-primary-700)]">Read</span>
                        <ChevronRight className="size-4 text-[var(--color-primary-700)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </button>
                  </li>
                )
              }
              return (
                <li key={c.id}>
                  <div className={`${rowClass} cursor-default bg-[var(--color-bg-elevated)]/60 text-[var(--color-text-secondary)]`}>
                    {innerMain}
                    <span className="inline-flex items-center gap-1 text-xs font-medium sm:justify-self-end">
                      <span className="text-[var(--color-text-tertiary)]">Open chapter 1 first</span>
                    </span>
                  </div>
                </li>
              )
            }

            const inner = (
              <>
                {innerMain}
                <span className="inline-flex items-center gap-1 text-xs font-semibold sm:justify-self-end">
                  <span className="text-[var(--color-primary-700)]">Read</span>
                  <ChevronRight className="size-4 text-[var(--color-primary-700)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </>
            )

            if (!open) {
              return (
                <li key={c.id}>
                  <div className={`${rowClass} cursor-default`}>{inner}</div>
                </li>
              )
            }

            return (
              <li key={c.id}>
                <Link
                  to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${c.chapterNumber}`}
                  className={`${rowClass} hover:bg-[var(--color-bg-muted)] focus-visible:bg-[var(--color-bg-muted)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-300)]`}
                >
                  {inner}
                </Link>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
