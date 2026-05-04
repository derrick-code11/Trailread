import { BookOpen, ChevronRight, Clock, Library, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/books/BookCover'
import { useAuth } from '@/context/AuthContext'
import { ApiRequestError, listBooks, type CatalogBook } from '@/lib/booksApi'

export function AppHomePage() {
  const { user } = useAuth()
  const firstName = user?.email?.split('@')[0] ?? 'Reader'
  const [books, setBooks] = useState<CatalogBook[] | null>(null)
  const [bookCount, setBookCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await listBooks({ page: 1, pageSize: 6, sortBy: 'title', sortOrder: 'asc' })
        if (!cancelled) {
          setBooks(res.data)
          setBookCount(res.pagination.totalItems)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiRequestError ? e.message : 'Could not load your library.')
          setBooks([])
          setBookCount(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const featuredBook = books?.[0] ?? null
  const shelfBooks = books?.slice(0, 4) ?? []

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 overflow-hidden rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-tr-sm)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-700)]">
              <Sparkles className="size-3.5" aria-hidden />
              Your reading room
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,7vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-[var(--color-text-primary)]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
              Pick up a classic, settle into a quieter page, and keep your library close at hand.
            </p>
          </div>
          <Button className="rounded-full px-4" asChild>
            <Link to="/app/books">
              Browse library
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4">
            <Clock className="size-4 text-[var(--color-primary-700)]" aria-hidden />
            <p className="mt-5 text-2xl font-semibold tracking-tight">Tonight</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">A calm place to resume reading.</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4">
            <Library className="size-4 text-[var(--color-primary-700)]" aria-hidden />
            <p className="mt-5 text-2xl font-semibold tracking-tight">{bookCount ?? '—'}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Books on your shelf.</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4">
            <BookOpen className="size-4 text-[var(--color-primary-700)]" aria-hidden />
            <p className="mt-5 text-2xl font-semibold tracking-tight">Reader</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Personalized type and spacing.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-5 shadow-[var(--shadow-tr-sm)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Up next</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Continue reading</h2>
            </div>
            <span className="rounded-full bg-[var(--color-primary-50)] px-3 py-1 text-xs font-medium text-[var(--color-primary-700)]">
              Fresh shelf
            </span>
          </div>

          {featuredBook ? (
            <Link
              to={`/app/books/${encodeURIComponent(featuredBook.slug)}`}
              className="group mt-6 grid gap-5 rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 outline-none transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-tr-sm)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)] sm:grid-cols-[8rem_1fr]"
            >
              <BookCover
                title={featuredBook.title}
                author={featuredBook.author}
                coverUrl={featuredBook.coverUrl}
                className="mx-auto w-32 sm:w-full"
              />
              <div className="flex min-w-0 flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-700)]">Featured classic</p>
                <h3 className="mt-2 line-clamp-2 font-display text-3xl font-semibold leading-tight tracking-tight">
                  {featuredBook.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{featuredBook.author ?? 'Unknown author'}</p>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {featuredBook.description ??
                    'Open the book overview to choose a chapter and start reading in the refreshed reader.'}
                </p>
              </div>
            </Link>
          ) : (
            <div className="mt-6 rounded-[20px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 text-center">
              <BookOpen className="mx-auto size-8 text-[var(--color-text-tertiary)]" aria-hidden />
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                {error ?? 'When your library has books, your next read will appear here.'}
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-tr-xs)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">Mini shelf</h2>
            <Link to="/app/books" className="text-sm font-medium text-[var(--color-primary-700)] hover:underline">
              See all
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {books === null
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="aspect-[2/3] animate-pulse rounded-[10px] bg-[var(--color-bg-sunken)]" />
                ))
              : shelfBooks.length > 0
                ? shelfBooks.map((book) => (
                    <Link key={book.id} to={`/app/books/${encodeURIComponent(book.slug)}`} className="group block outline-none">
                      <BookCover
                        title={book.title}
                        author={book.author}
                        coverUrl={book.coverUrl}
                        className="transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-primary-300)]"
                      />
                      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug">{book.title}</p>
                    </Link>
                  ))
                : (
                    <p className="col-span-2 rounded-[16px] border border-dashed border-[var(--color-border-subtle)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                      Your shelf is empty for now.
                    </p>
                  )}
          </div>
        </aside>
      </section>
    </div>
  )
}
