import { BookOpen, CalendarClock, Eye, LibraryBig, Loader2, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  ApiRequestError,
  adminListBooks,
  deleteAdminBook,
  type AdminBookRow,
} from '@/lib/adminApi'
import { cn } from '@/lib/utils'

export function AdminBooksListPage() {
  const [rows, setRows] = useState<AdminBookRow[] | null>(null)
  const [totalItems, setTotalItems] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminListBooks({ page: 1, pageSize: 50, sortBy: 'updatedAt', sortOrder: 'desc' })
        if (!cancelled) {
          setRows(res.data)
          setTotalItems(res.pagination.totalItems)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiRequestError ? e.message : 'Failed to load books.')
          setRows([])
          setTotalItems(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onDeleteBook(book: AdminBookRow) {
    const confirmed = window.confirm(`Delete "${book.title}"? This removes the book, chapters, progress, and ingestion history.`)
    if (!confirmed) return

    setActionError(null)
    setDeletingId(book.id)
    try {
      await deleteAdminBook(book.id)
      setRows((current) => current?.filter((row) => row.id !== book.id) ?? current)
      setTotalItems((current) => (current === null ? current : Math.max(0, current - 1)))
    } catch (e) {
      setActionError(e instanceof ApiRequestError ? e.message : 'Failed to delete book.')
    } finally {
      setDeletingId(null)
    }
  }

  if (rows === null && !error) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] shadow-[var(--shadow-tr-xs)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading books…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[var(--shadow-tr-xs)]">
        <p className="text-[var(--color-text-primary)]">{error}</p>
        <Button type="button" className="mt-4 rounded-full" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <header className="overflow-hidden rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-tr-sm)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-700)]">
              <LibraryBig className="size-3.5" aria-hidden />
              Admin library
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,7vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
              Books
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
              Import, review, publish, and remove titles from the Trailread catalog.
            </p>
          </div>
          <Button className="rounded-full px-4" asChild>
            <Link to="/admin/books/new">
              <Plus className="size-4" aria-hidden />
              Import book
            </Link>
          </Button>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <StatCard icon={BookOpen} label="Catalog books" value={String(totalItems ?? rows?.length ?? 0)} />
          <StatCard
            icon={Eye}
            label="Published"
            value={String(rows?.filter((book) => book.status === 'PUBLISHED').length ?? 0)}
          />
          <StatCard
            icon={CalendarClock}
            label="Needs review"
            value={String(rows?.filter((book) => book.status === 'NEEDS_REVIEW').length ?? 0)}
          />
        </div>
      </header>

      {actionError ? (
        <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {actionError}
        </div>
      ) : null}

      {rows && rows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-16 text-center shadow-[var(--shadow-tr-xs)]">
          <BookOpen className="mx-auto size-10 text-[var(--color-text-tertiary)]" aria-hidden />
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">No books yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">
            Import a Project Gutenberg title to start building the catalog.
          </p>
          <Button className="mt-6 rounded-full" asChild>
            <Link to="/admin/books/new">Import first book</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-tr-xs)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">Catalog</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {rows?.length ?? 0} visible {rows?.length === 1 ? 'title' : 'titles'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--color-bg-elevated)] text-xs uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Book</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Source</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {rows?.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-[var(--color-bg-hover)]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <BookThumbnail book={b} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--color-text-primary)]">{b.title}</p>
                          <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                            {b.author ?? 'Unknown author'} · /{b.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                      {b.gutenbergId ? `Gutenberg #${b.gutenbergId}` : 'Manual'}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                      <time dateTime={b.updatedAt}>{new Date(b.updatedAt).toLocaleDateString()}</time>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="rounded-full" asChild>
                          <Link to={`/admin/books/${b.id}/review`}>Review</Link>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={`Delete ${b.title}`}
                          disabled={deletingId === b.id}
                          onClick={() => void onDeleteBook(b)}
                        >
                          {deletingId === b.id ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4">
      <Icon className="size-4 text-[var(--color-primary-700)]" aria-hidden />
      <p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{label}</p>
    </div>
  )
}

function BookThumbnail({ book }: { book: AdminBookRow }) {
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt=""
        className="h-14 w-10 shrink-0 rounded-md border border-black/10 object-cover shadow-[0_6px_14px_rgba(28,26,22,0.14)]"
      />
    )
  }

  return (
    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-black/10 bg-[var(--color-primary-700)] text-sm font-semibold text-[var(--color-text-inverse)] shadow-[0_6px_14px_rgba(28,26,22,0.14)]">
      {book.title.trim().charAt(0).toUpperCase() || 'B'}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PUBLISHED: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-800/70',
    NEEDS_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-800/70',
    IMPORTING_METADATA: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-200 dark:ring-blue-800/70',
    FETCHING_SOURCE: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-200 dark:ring-blue-800/70',
    PARSING_CHAPTERS: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-200 dark:ring-blue-800/70',
    GENERATING_EMBEDDINGS: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-200 dark:ring-blue-800/70',
    FAILED: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/45 dark:text-red-200 dark:ring-red-800/70',
    DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700',
    UNPUBLISHED: 'bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700',
  }

  return (
    <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1', styles[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700')}>
      {status.toLowerCase().replaceAll('_', ' ')}
    </span>
  )
}
