import {
  ArrowLeft,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  READER_FONT_SIZE_KEY,
  READER_MEASURE_KEY,
  READER_SPACING_KEY,
  type ReaderMeasure,
  type ReaderSpacing,
} from "@/components/reader/ReaderPreferences";
import { ChapterChatPanel } from "@/components/reader/ChapterChatPanel";
import {
  readerMeasureClass,
  readerSpacingClass,
} from "@/components/reader/readerLayout";
import { Button } from "@/components/ui/button";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import {
  ApiRequestError,
  canOpenChapter,
  getBookBySlug,
  getChapter,
  postChapterComplete,
  type BookDetailResponse,
  type ChapterResponse,
} from "@/lib/booksApi";
import { cn } from "@/lib/utils";

type PageTurnDirection = "next" | "prev";

export function ChapterReaderPage() {
  const { bookSlug, chapterNumber } = useParams<{
    bookSlug: string;
    chapterNumber: string;
  }>();
  const navigate = useNavigate();
  const n = Number(chapterNumber);
  const invalid = !bookSlug || !Number.isFinite(n) || n < 1;

  const [bookPayload, setBookPayload] = useState<BookDetailResponse | null>(
    null,
  );
  const [chapterPayload, setChapterPayload] = useState<ChapterResponse | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string | undefined>(
    undefined,
  );
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeErr, setCompleteErr] = useState<string | null>(null);
  const [pageTurn, setPageTurn] = useState<PageTurnDirection | null>(null);

  const [fontSizePx] = useLocalStorageState(READER_FONT_SIZE_KEY, 18);
  const [measure] = useLocalStorageState<ReaderMeasure>(
    READER_MEASURE_KEY,
    "normal",
  );
  const [spacing] = useLocalStorageState<ReaderSpacing>(
    READER_SPACING_KEY,
    "normal",
  );

  const articleRef = useRef<HTMLElement | null>(null);
  const hasLoadedChapterRef = useRef(false);
  const lastChapterNumberRef = useRef<number | null>(null);
  const pageTurnRef = useRef<PageTurnDirection | null>(null);

  const chapterMeta = useMemo(() => {
    if (!bookPayload) return null;
    return bookPayload.book.chapters.find((c) => c.chapterNumber === n) ?? null;
  }, [bookPayload, n]);

  useEffect(() => {
    pageTurnRef.current = pageTurn;
  }, [pageTurn]);

  useEffect(() => {
    if (invalid || !bookSlug) return;
    let cancelled = false;
    let clearTurnTimer: number | undefined;
    (async () => {
      setLoadError(null);
      const keepCurrentChapter = hasLoadedChapterRef.current;
      if (!keepCurrentChapter) {
        setChapterPayload(null);
        setProgressStatus(undefined);
      } else if (!pageTurnRef.current) {
        const previous = lastChapterNumberRef.current;
        if (previous != null && previous !== n) {
          setPageTurn(n > previous ? "next" : "prev");
        }
      }
      try {
        const bookRes = await getBookBySlug(bookSlug);
        if (cancelled) return;
        setBookPayload(bookRes);
        const meta = bookRes.book.chapters.find((c) => c.chapterNumber === n);
        if (!meta) {
          setLoadError("This chapter is not available.");
          return;
        }
        const chRes = await getChapter(meta.id);
        if (cancelled) return;
        setChapterPayload(chRes);
        const c = chRes.chapter;
        setProgressStatus(c.progressStatus);
        hasLoadedChapterRef.current = true;
        lastChapterNumberRef.current = n;
        if (keepCurrentChapter) {
          clearTurnTimer = window.setTimeout(() => {
            if (!cancelled) setPageTurn(null);
          }, 260);
          window.scrollTo({ top: 0, behavior: "auto" });
        } else {
          setPageTurn(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPageTurn(null);
          if (e instanceof ApiRequestError) {
            if (e.code === "FORBIDDEN") {
              setLoadError(
                "Start this book from its page before opening chapters.",
              );
            } else {
              setLoadError(e.message);
            }
          } else {
            setLoadError("Could not load chapter.");
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      if (clearTurnTimer != null) window.clearTimeout(clearTurnTimer);
    };
  }, [bookSlug, n, invalid]);

  const handleComplete = async () => {
    if (!chapterPayload) return;
    setCompleteBusy(true);
    setCompleteErr(null);
    try {
      await postChapterComplete(chapterPayload.chapter.id);
      const bookRes = await getBookBySlug(bookSlug!);
      const sorted = [...bookRes.book.chapters].sort(
        (a, b) => a.chapterNumber - b.chapterNumber,
      );
      const idx = sorted.findIndex((c) => c.chapterNumber === n);
      const nextMeta =
        idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1]! : null;
      if (nextMeta && canOpenChapter(bookRes.book, nextMeta)) {
        setPageTurn("next");
        navigate(
          `/app/books/${encodeURIComponent(bookRes.book.slug)}/chapters/${nextMeta.chapterNumber}`,
        );
      } else {
        navigate(`/app/books/${encodeURIComponent(bookRes.book.slug)}`);
      }
    } catch (e) {
      setCompleteErr(
        e instanceof ApiRequestError
          ? e.message
          : "Could not complete chapter.",
      );
    } finally {
      setCompleteBusy(false);
    }
  };

  if (invalid) {
    return (
      <div className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[var(--shadow-tr-xs)]">
        <p className="text-[var(--color-text-primary)]">
          Invalid chapter link.
        </p>
        <Link
          to="/app/books"
          className="mt-4 inline-block text-sm font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
        >
          Back to library
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[var(--shadow-tr-xs)]">
        <p className="text-[var(--color-text-primary)]">{loadError}</p>
        <Link
          to={
            bookSlug
              ? `/app/books/${encodeURIComponent(bookSlug)}`
              : "/app/books"
          }
          className="mt-4 inline-block text-sm font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
        >
          Back to book
        </Link>
      </div>
    );
  }

  if (!bookPayload || !chapterPayload || !chapterMeta) {
    return (
      <div
        className="rounded-[30px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-10 shadow-[var(--shadow-tr-sm)] sm:px-8"
        aria-busy="true"
        aria-label="Preparing chapter"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <div className="mx-auto h-3 w-32 animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
            <div className="mx-auto mt-4 h-10 w-64 max-w-full animate-pulse rounded-full bg-[var(--color-bg-muted)]" />
            <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
              Preparing your chapter
            </p>
          </div>

          <div className="space-y-4">
            <div className="h-4 w-full animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
            <div className="h-4 w-[92%] animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
            <div className="h-4 w-[96%] animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
            <div className="h-4 w-[84%] animate-pulse rounded-full bg-[var(--color-bg-sunken)]" />
          </div>
        </div>
      </div>
    );
  }

  const book = bookPayload.book;
  const ch = chapterPayload.chapter;
  const sorted = [...book.chapters].sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );
  const idx = sorted.findIndex((c) => c.chapterNumber === n);
  const prevRaw = idx > 0 ? sorted[idx - 1]! : null;
  const nextRaw = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1]! : null;
  const prevOpen = Boolean(prevRaw && canOpenChapter(book, prevRaw));
  const nextOpen = Boolean(nextRaw && canOpenChapter(book, nextRaw));

  const displayTitle = ch.title?.trim()
    ? ch.title
    : chapterMeta.title?.trim()
      ? chapterMeta.title
      : `Chapter ${ch.chapterNumber}`;
  const progressLabel = `${idx + 1} of ${sorted.length}`;
  /** How far through the book this chapter is (matches “Chapter X of Y” in the header). */
  const bookProgressPercent =
    sorted.length > 0 ? Math.round(((idx + 1) / sorted.length) * 100) : 0;

  const isCompleted = progressStatus === "COMPLETED";
  const showMarkComplete = !isCompleted;
  const beginPageTurn = (direction: PageTurnDirection) => {
    setPageTurn(direction);
  };

  return (
    <div className="relative left-1/2 w-full -translate-x-1/2 lg:w-[calc(100vw-15rem-4rem)] lg:max-w-[118rem]">
      <div className="grid gap-8 xl:grid-cols-[minmax(46rem,1fr)_18rem] 2xl:grid-cols-[minmax(56rem,1fr)_20rem] 2xl:gap-10">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[30px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-8 shadow-[var(--shadow-tr-sm)] sm:px-6 sm:py-12 lg:px-8 xl:px-10 2xl:px-14">
            {pageTurn ? (
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[30px] bg-[var(--color-bg-surface)]/20 [perspective:1600px]">
                <div
                  className={cn(
                    "trailread-page-turn",
                    pageTurn === "next" ? "trailread-page-turn-next" : "trailread-page-turn-prev",
                  )}
                />
              </div>
            ) : null}
            <article
              ref={articleRef}
              className={cn(
                "font-display mx-auto text-[var(--color-text-primary)]",
                readerMeasureClass(measure),
              )}
              style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.72 }}
            >
              <div className="mb-10 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-text-tertiary)]">
                  {book.title}
                </p>
                <h2 className="mt-3 font-display text-[clamp(2rem,6vw,4rem)] font-semibold leading-none tracking-[-0.04em]">
                  {displayTitle}
                </h2>
              </div>

              {isCompleted ? (
                <p className="mb-8 text-center text-sm font-medium text-[var(--color-primary-700)]">
                  You have completed this chapter.
                </p>
              ) : null}

              {completeErr ? (
                <p className="mb-4 text-center text-sm text-red-600 dark:text-red-400">
                  {completeErr}
                </p>
              ) : null}

              {showMarkComplete ? (
                <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    type="button"
                    className="rounded-full px-6"
                    disabled={completeBusy}
                    onClick={() => void handleComplete()}
                  >
                    {completeBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    Mark chapter complete
                  </Button>
                </div>
              ) : null}

              <div
                className={cn(
                  "[&>p:first-child]:first-letter:float-left [&>p:first-child]:first-letter:mr-2 [&>p:first-child]:first-letter:font-display [&>p:first-child]:first-letter:text-[4.4em] [&>p:first-child]:first-letter:font-semibold [&>p:first-child]:first-letter:leading-[0.8]",
                  readerSpacingClass(spacing),
                )}
              >
                {ch.paragraphs.map((p) => (
                  <p key={p.id} data-paragraph-index={p.paragraphIndex}>
                    {p.text}
                  </p>
                ))}
              </div>
            </article>
          </div>

          <nav className="flex flex-wrap items-center justify-between gap-3 pb-4">
            {prevOpen && prevRaw ? (
              <Link
                to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${prevRaw.chapterNumber}`}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-bg-muted)]"
                onClick={() => beginPageTurn("prev")}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous chapter
              </Link>
            ) : (
              <span />
            )}
            {nextOpen && nextRaw ? (
              <Link
                to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${nextRaw.chapterNumber}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] shadow-[var(--shadow-tr-sm)] transition hover:-translate-y-0.5"
                onClick={() => beginPageTurn("next")}
              >
                Next chapter
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <Link
                to={`/app/books/${encodeURIComponent(book.slug)}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] shadow-[var(--shadow-tr-sm)] transition hover:-translate-y-0.5"
              >
                Back to book
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:flex xl:max-h-[calc(100vh-3rem)] xl:flex-col xl:self-start xl:space-y-0 xl:gap-4">
          <section className="rounded-[24px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 shadow-[var(--shadow-tr-sm)]">
            <Link
              to={`/app/books/${encodeURIComponent(book.slug)}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{book.title}</span>
            </Link>

            <div className="mt-4">
              <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-[var(--color-text-primary)]">
                {displayTitle}
              </h1>
              <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
                Chapter {progressLabel}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                <BookMarked className="size-3.5 text-[var(--color-primary-700)]" aria-hidden />
                {progressLabel}
              </span>
              <Link
                to="/app/settings"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden />
                Settings
              </Link>
            </div>

            <div
              className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--color-bg-sunken)]"
              aria-label={`Book progress: ${progressLabel}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={bookProgressPercent}
            >
              <div className="h-full rounded-full bg-[var(--color-primary-500)]" style={{ width: `${bookProgressPercent}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {prevOpen && prevRaw ? (
                <Link
                  to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${prevRaw.chapterNumber}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-700)] transition hover:bg-[var(--color-bg-muted)]"
                  onClick={() => beginPageTurn("prev")}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-secondary)]/60">
                  <ChevronLeft className="size-4" aria-hidden />
                  Previous
                </span>
              )}

              {nextOpen && nextRaw ? (
                <Link
                  to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${nextRaw.chapterNumber}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-text-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-inverse)] transition hover:-translate-y-0.5"
                  onClick={() => beginPageTurn("next")}
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-secondary)]/60">
                  Next
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              )}
            </div>
          </section>

          <ChapterChatPanel key={`assistant-${ch.id}`} chapterId={ch.id} articleRef={articleRef} />
        </div>
      </div>
    </div>
  );
}
