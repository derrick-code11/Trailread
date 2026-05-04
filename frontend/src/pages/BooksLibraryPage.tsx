import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/books/BookCover'
import { ApiRequestError, listBooks, type CatalogBook } from '@/lib/booksApi'

export function BooksLibraryPage() {
  const [books, setBooks] = useState<CatalogBook[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await listBooks({ page: 1, pageSize: 50, sortBy: 'title', sortOrder: 'asc' })
        if (!cancelled) setBooks(res.data)
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof ApiRequestError ? e.message : 'Could not load books.'
          setError(msg)
          setBooks([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (books === null && !error) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Preparing library">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="h-9 w-32 animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
            <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">Preparing your library</p>
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
        </header>

        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <li key={index} className="space-y-3">
              <div className="aspect-[2/3] animate-pulse rounded-[18px] bg-[var(--color-bg-sunken)] shadow-[var(--shadow-tr-xs)]" />
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
              <div className="h-3 w-3/5 animate-pulse rounded-full bg-[var(--color-bg-muted)]" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[var(--shadow-tr-xs)]">
        <p className="text-[var(--color-text-primary)]">{error}</p>
        <Button type="button" className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">Browse your published collection.</p>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {books?.length ?? 0} {(books?.length ?? 0) === 1 ? 'book' : 'books'}
        </p>
      </header>

      {books && books.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border-subtle)] px-4 py-12 text-center text-sm text-[var(--color-text-secondary)]">
          No published books yet. An admin can import titles from Project Gutenberg.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {books?.map((b) => (
            <li key={b.id}>
              <Link
                to={`/app/books/${encodeURIComponent(b.slug)}`}
                className="group block outline-none"
              >
                <BookCover
                  title={b.title}
                  author={b.author}
                  coverUrl={b.coverUrl}
                  className="w-full transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-primary-300)]"
                />
                <h2 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-text-primary)]">
                  {b.title}
                </h2>
                <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{b.author ?? 'Unknown author'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
