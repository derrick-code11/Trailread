import { BookOpen, Loader2, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ApiRequestError,
  getIngestionJob,
  importGutenbergBook,
  searchGutenberg,
  type GutendexHit,
} from '@/lib/adminApi'

export function AdminBookNewPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [hits, setHits] = useState<GutendexHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchCacheRef = useRef(new Map<string, GutendexHit[]>())

  const [importingId, setImportingId] = useState<number | null>(null)
  const [pollBookId, setPollBookId] = useState<string | null>(null)
  const [pollJobId, setPollJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobStep, setJobStep] = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 220)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!debounced || debounced.length < 2) return

    const cached = searchCacheRef.current.get(debounced.toLowerCase())
    if (cached) {
      queueMicrotask(() => {
        setHits(cached)
        setSearching(false)
        setSearchError(null)
      })
      return
    }

    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const res = await searchGutenberg(debounced, { signal: controller.signal })
        searchCacheRef.current.set(debounced.toLowerCase(), res.data)
        if (!cancelled) setHits(res.data)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!cancelled) {
          setSearchError(e instanceof ApiRequestError ? e.message : 'Search failed.')
          setHits([])
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debounced])

  useEffect(() => {
    if (!pollBookId || !pollJobId) return
    let cancelled = false
    const tick = async () => {
      try {
        const job = await getIngestionJob(pollBookId, pollJobId)
        if (cancelled) return
        setJobStatus(job.status)
        setJobStep(job.step)
        setJobError(job.error)
        if (job.status === 'COMPLETED') {
          navigate(`/admin/books/${pollBookId}/review`)
          return
        }
        if (job.status === 'FAILED') {
          return
        }
      } catch {
        /* ignore transient errors while polling */
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pollBookId, pollJobId, navigate])

  async function onImport(gutenbergId: number) {
    setImportingId(gutenbergId)
    setJobError(null)
    try {
      const res = await importGutenbergBook(gutenbergId)
      setPollBookId(res.bookId)
      setPollJobId(res.jobId)
      setJobStatus('QUEUED')
      setJobStep('queued')
    } catch (e) {
      setJobError(e instanceof ApiRequestError ? e.message : 'Import failed.')
    } finally {
      setImportingId(null)
    }
  }

  const trimmedQuery = q.trim()
  const hasActiveSearch = debounced.length >= 2
  const hasPendingSearch = trimmedQuery.length >= 2 && trimmedQuery !== debounced
  const showSearchLoading = trimmedQuery.length >= 2 && (searching || hasPendingSearch)
  const visibleHits = hasActiveSearch ? hits : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            <BookOpen className="size-3.5 text-[var(--color-primary-700)]" aria-hidden />
            Admin import
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Import from Project Gutenberg</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Search Gutendex, choose a title, and Trailread will prepare it for review.
          </p>
        </div>
      </header>

      <section className="rounded-[24px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-tr-sm)] sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="guten-search">Search books</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <Input
              id="guten-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try a title or author, e.g. Pride and Prejudice"
              className="h-12 rounded-2xl pl-11 pr-10 text-base"
            />
            {showSearchLoading ? (
              <Loader2 className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--color-text-tertiary)]" aria-hidden />
            ) : null}
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {!trimmedQuery
              ? 'Results appear as you type.'
              : trimmedQuery.length < 2
                ? 'Type at least 2 characters to search.'
                : showSearchLoading
                  ? 'Searching Gutendex...'
                  : `${visibleHits.length} ${visibleHits.length === 1 ? 'result' : 'results'}${hasActiveSearch ? ` for "${debounced}"` : ''}.`}
          </p>
        </div>
      </section>

      {pollBookId && pollJobId ? (
        <div className="rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 text-sm shadow-[var(--shadow-tr-xs)]">
          <p className="font-semibold text-[var(--color-text-primary)]">Import in progress</p>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            Status: {jobStatus ?? '…'}
            {jobStep ? ` · ${jobStep}` : ''}
          </p>
          {jobError ? <p className="mt-2 text-[var(--color-error)]">{jobError}</p> : null}
        </div>
      ) : null}

      {hasActiveSearch && searchError ? <p className="text-sm text-[var(--color-error)]">{searchError}</p> : null}

      <section className="space-y-3">
        {hasActiveSearch ? (
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Search results
            </h2>
            {!showSearchLoading ? (
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {visibleHits.length} found
              </span>
            ) : null}
          </div>
        ) : null}

        <ul className="space-y-3">
        {showSearchLoading && hits.length === 0
          ? Array.from({ length: 3 }).map((_, index) => (
              <li
                key={index}
                className="flex flex-col gap-3 rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-[var(--color-bg-muted)]" />
                </div>
                <div className="h-8 w-20 animate-pulse rounded-lg bg-[var(--color-bg-sunken)]" />
              </li>
            ))
          : null}
        {visibleHits.map((h) => (
          <li
            key={h.gutenbergId}
            className="flex flex-col gap-4 rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-tr-xs)] transition-colors hover:border-[var(--color-border-strong)] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="line-clamp-2 font-semibold text-[var(--color-text-primary)]">{h.title}</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {h.authors[0] ?? 'Unknown author'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                  ID {h.gutenbergId}
                </span>
                {h.languages.slice(0, 2).map((language) => (
                  <span
                    key={language}
                    className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={importingId !== null || !!pollJobId}
              onClick={() => void onImport(h.gutenbergId)}
            >
              {importingId === h.gutenbergId ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Importing…
                </>
              ) : (
                'Import'
              )}
            </Button>
          </li>
        ))}
        </ul>

        {hasActiveSearch && !showSearchLoading && visibleHits.length === 0 && !searchError ? (
          <p className="rounded-[18px] border border-dashed border-[var(--color-border-subtle)] px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">
            No Gutendex matches found. Try a shorter title or the author&apos;s name.
          </p>
        ) : null}
      </section>

      {!trimmedQuery ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Type to search Gutendex.</p>
      ) : null}
    </div>
  )
}
