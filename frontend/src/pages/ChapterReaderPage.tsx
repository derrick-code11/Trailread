import {
  ArrowLeft,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Headphones,
  CheckCircle2,
  ListChecks,
  Loader2,
  PartyPopper,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  READER_FONT_SIZE_KEY,
  READER_MEASURE_KEY,
  READER_SPACING_KEY,
  type ReaderMeasure,
  type ReaderSpacing,
} from "@/components/reader/ReaderPreferences";
import { ChapterChatPanel } from "@/components/reader/ChapterChatPanel";
import { PodcastPlayer } from "@/components/reader/PodcastPlayer";
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
  getChapterPodcastStatus,
  getChapterQuiz,
  getChapterSummary,
  postChapterComplete,
  postChapterPodcast,
  postQuizAttempt,
  type BookDetailResponse,
  type ChapterPodcastStatusResponse,
  type ChapterQuizResponse,
  type ChapterResponse,
  type ChapterSummaryResponse,
  type QuizAttemptResponse,
} from "@/lib/booksApi";
import { cn } from "@/lib/utils";

type PageTurnDirection = "next" | "prev";
type ReaderView = "read" | "summary" | "quiz";
type LoadStatus = "idle" | "loading" | "ready" | "not-ready" | "error";

type LoadableState<T> = {
  status: LoadStatus;
  data: T | null;
  error: string | null;
};

function createLoadableState<T>(): LoadableState<T> {
  return { status: "idle", data: null, error: null };
}

function formatMinutes(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "About 2-3 minutes";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function ChapterReaderPage() {
  const { bookSlug, chapterNumber } = useParams<{
    bookSlug: string;
    chapterNumber: string;
  }>();
  const location = useLocation();
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

  const [summaryState, setSummaryState] =
    useState<LoadableState<ChapterSummaryResponse>>(createLoadableState);
  const [quizState, setQuizState] =
    useState<LoadableState<ChapterQuizResponse>>(createLoadableState);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizStep, setQuizStep] = useState(0);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizAttemptResponse | null>(
    null,
  );
  const [quizSubmitError, setQuizSubmitError] = useState<string | null>(null);
  const [podcastState, setPodcastState] =
    useState<ChapterPodcastStatusResponse | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [podcastBusy, setPodcastBusy] = useState(false);
  const [podcastError, setPodcastError] = useState<string | null>(null);
  const [podcastPollNonce, setPodcastPollNonce] = useState(0);
  const [showCompletionCelebration, setShowCompletionCelebration] =
    useState(false);

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
  const chapterEndRef = useRef<HTMLElement | null>(null);
  const hasLoadedChapterRef = useRef(false);
  const lastChapterNumberRef = useRef<number | null>(null);
  const pageTurnRef = useRef<PageTurnDirection | null>(null);

  const currentView: ReaderView = location.pathname.endsWith("/summary")
    ? "summary"
    : location.pathname.endsWith("/quiz")
      ? "quiz"
      : "read";

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

      setSummaryState(createLoadableState());
      setQuizState(createLoadableState());
      setQuizAnswers({});
      setQuizStep(0);
      setQuizResult(null);
      setQuizSubmitError(null);
      setPodcastState(null);
      setPodcastError(null);
      setPodcastPollNonce(0);
      setShowCompletionCelebration(false);

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
        setProgressStatus(chRes.chapter.progressStatus);
        setShowCompletionCelebration(false);
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

  const chapterId = chapterPayload?.chapter.id ?? null;
  const isCompleted = progressStatus === "COMPLETED";

  useEffect(() => {
    if (!chapterId || !isCompleted) return;
    let cancelled = false;
    let timer: number | undefined;

    const loadSummary = async () => {
      setSummaryState((current) =>
        current.status === "ready"
          ? current
          : { status: "loading", data: current.data, error: null },
      );

      try {
        const result = await getChapterSummary(chapterId);
        if (cancelled) return;
        setSummaryState({ status: "ready", data: result, error: null });
      } catch (error) {
        if (cancelled) return;
        if (
          error instanceof ApiRequestError &&
          error.code === "AI_ARTIFACT_NOT_READY"
        ) {
          setSummaryState({ status: "not-ready", data: null, error: null });
          timer = window.setTimeout(loadSummary, 4000);
          return;
        }
        setSummaryState({
          status: "error",
          data: null,
          error:
            error instanceof ApiRequestError
              ? error.message
              : "Could not load the chapter summary.",
        });
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [chapterId, isCompleted]);

  useEffect(() => {
    if (!chapterId || !isCompleted) return;
    let cancelled = false;
    let timer: number | undefined;

    const loadQuiz = async () => {
      setQuizState((current) =>
        current.status === "ready"
          ? current
          : { status: "loading", data: current.data, error: null },
      );

      try {
        const result = await getChapterQuiz(chapterId);
        if (cancelled) return;
        setQuizState({ status: "ready", data: result, error: null });
      } catch (error) {
        if (cancelled) return;
        if (
          error instanceof ApiRequestError &&
          error.code === "AI_ARTIFACT_NOT_READY"
        ) {
          setQuizState({ status: "not-ready", data: null, error: null });
          timer = window.setTimeout(loadQuiz, 4000);
          return;
        }
        setQuizState({
          status: "error",
          data: null,
          error:
            error instanceof ApiRequestError
              ? error.message
              : "Could not load the chapter quiz.",
        });
      }
    };

    void loadQuiz();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [chapterId, isCompleted]);

  useEffect(() => {
    if (!chapterId || !isCompleted) return;
    let cancelled = false;

    const loadPodcast = async () => {
      setPodcastLoading(true);
      try {
        const result = await getChapterPodcastStatus(chapterId);
        if (cancelled) return;
        setPodcastState(result);
        setPodcastError(null);
      } catch (error) {
        if (cancelled) return;
        setPodcastError(
          error instanceof ApiRequestError
            ? error.message
            : "Could not load podcast status.",
        );
      } finally {
        if (!cancelled) setPodcastLoading(false);
      }
    };

    void loadPodcast();
    return () => {
      cancelled = true;
    };
  }, [chapterId, isCompleted]);

  useEffect(() => {
    if (!chapterId || !isCompleted || podcastPollNonce === 0) return;
    let cancelled = false;
    let timer: number | undefined;

    const pollPodcast = async () => {
      try {
        const result = await getChapterPodcastStatus(chapterId);
        if (cancelled) return;
        setPodcastState(result);
        setPodcastError(null);
        if (result.status === "PENDING" || result.status === "GENERATING") {
          timer = window.setTimeout(pollPodcast, 5000);
        }
      } catch (error) {
        if (cancelled) return;
        setPodcastError(
          error instanceof ApiRequestError
            ? error.message
            : "Could not refresh podcast status.",
        );
      }
    };

    void pollPodcast();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [chapterId, isCompleted, podcastPollNonce]);

  useEffect(() => {
    if (currentView === "read") return;
    chapterEndRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [currentView, chapterId]);

  const refreshChapterShell = async () => {
    if (!bookSlug || !chapterId) return;
    const [bookRes, chapterRes] = await Promise.all([
      getBookBySlug(bookSlug),
      getChapter(chapterId),
    ]);
    setBookPayload(bookRes);
    setChapterPayload(chapterRes);
    setProgressStatus(chapterRes.chapter.progressStatus);
  };

  const handleComplete = async () => {
    if (!chapterPayload) return;
    setCompleteBusy(true);
    setCompleteErr(null);
    try {
      await postChapterComplete(chapterPayload.chapter.id);
      await refreshChapterShell();
      setShowCompletionCelebration(true);
      window.setTimeout(() => {
        chapterEndRef.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      }, 80);
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

  const handleQuizSubmit = async () => {
    if (!chapterId || !quizState.data) return;
    setQuizSubmitting(true);
    setQuizSubmitError(null);
    try {
      const result = await postQuizAttempt(chapterId, {
        answers: quizState.data.questions.map((question) => ({
          questionId: question.id,
          selectedIndex: quizAnswers[question.id] ?? -1,
        })),
      });
      setQuizResult(result);
    } catch (error) {
      setQuizSubmitError(
        error instanceof ApiRequestError
          ? error.message
          : "Could not submit this quiz attempt.",
      );
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleGeneratePodcast = async () => {
    if (!chapterId) return;
    setPodcastBusy(true);
    setPodcastError(null);
    try {
      const result = await postChapterPodcast(chapterId);
      setPodcastState(result);
      if (result.status === "PENDING" || result.status === "GENERATING") {
        setPodcastPollNonce((value) => value + 1);
      }
    } catch (error) {
      setPodcastError(
        error instanceof ApiRequestError
          ? error.message
          : "Could not start podcast generation.",
      );
    } finally {
      setPodcastBusy(false);
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
  const bookProgressPercent =
    sorted.length > 0 ? Math.round(((idx + 1) / sorted.length) * 100) : 0;
  const nextHref = nextRaw
    ? `/app/books/${encodeURIComponent(book.slug)}/chapters/${nextRaw.chapterNumber}`
    : `/app/books/${encodeURIComponent(book.slug)}`;
  const completionTone = showCompletionCelebration ? "celebration" : "quiet";

  const quizQuestions = quizState.data?.questions ?? [];
  const activeQuestion = quizQuestions[quizStep] ?? null;
  const unansweredCount = quizQuestions.filter(
    (question) => quizAnswers[question.id] == null,
  ).length;

  const renderSummaryCard = () => {
    if (!isCompleted) {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <div className="flex items-center gap-3">
            <ScrollText className="size-5 text-[var(--color-primary-700)]" />
            <div>
              <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
                Chapter summary
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Finish the chapter to unlock the recap.
              </p>
            </div>
          </div>
        </section>
      );
    }

    if (summaryState.status === "loading" || summaryState.status === "idle") {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Preparing your chapter summary…
          </div>
        </section>
      );
    }

    if (summaryState.status === "not-ready") {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <p className="text-sm text-[var(--color-text-secondary)]">
            The summary is still generating. Stay on this page and it will fill
            in automatically.
          </p>
        </section>
      );
    }

    if (summaryState.status === "error" || !summaryState.data) {
      return (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {summaryState.error ?? "Could not load the chapter summary."}
        </section>
      );
    }

    return (
      <section className="rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-tr-sm)]">
        <div className="flex items-center gap-3">
          <ScrollText className="size-5 text-[var(--color-primary-700)]" />
          <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
              Chapter summary
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Recap of what mattered in this chapter.
            </p>
          </div>
        </div>

        <p className="mt-5 text-base leading-7 text-[var(--color-text-primary)]">
          {summaryState.data.summary}
        </p>

        {summaryState.data.keyEvents.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Key events
            </h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {summaryState.data.keyEvents.map((event) => (
                <div
                  key={event}
                  className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 text-sm leading-6 text-[var(--color-text-secondary)]"
                >
                  {event}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {summaryState.data.characters.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Characters
            </h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {summaryState.data.characters.map((character) => (
                <div
                  key={character.name}
                  className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4"
                >
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {character.name}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {character.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {summaryState.data.themes.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              Themes
            </h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {summaryState.data.themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderQuizCard = () => {
    if (!isCompleted) {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <div className="flex items-center gap-3">
            <ListChecks className="size-5 text-[var(--color-primary-700)]" />
            <div>
              <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
                Quick check
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Finish the chapter to unlock your optional quiz.
              </p>
            </div>
          </div>
        </section>
      );
    }

    if (quizState.status === "loading" || quizState.status === "idle") {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Building your quiz…
          </div>
        </section>
      );
    }

    if (quizState.status === "not-ready") {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <p className="text-sm text-[var(--color-text-secondary)]">
            The quiz is still generating. It should be ready in a moment.
          </p>
        </section>
      );
    }

    if (quizState.status === "error" || !quizState.data) {
      return (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {quizState.error ?? "Could not load the chapter quiz."}
        </section>
      );
    }

    return (
      <section className="rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-tr-sm)]">
        <div className="flex items-center gap-3">
          <ListChecks className="size-5 text-[var(--color-primary-700)]" />
          <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
              Quick check
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Optional review to help the chapter stick.
            </p>
          </div>
        </div>

        {quizResult ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                Result
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-[var(--color-text-primary)]">
                {quizResult.score} / {quizResult.total}
              </p>
            </div>

            {quizResult.results.map((result, resultIndex) => (
              <div
                key={result.questionId}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  Question {resultIndex + 1}
                </p>
                <p className="mt-2 text-base font-medium leading-7 text-[var(--color-text-primary)]">
                  {result.prompt}
                </p>
                <p
                  className={cn(
                    "mt-3 text-sm font-semibold",
                    result.correct ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {result.correct ? "Correct" : "Not quite"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  You chose{" "}
                  {result.selectedIndex == null
                    ? "no answer"
                    : result.options[result.selectedIndex]}
                  . Correct answer: {result.options[result.correctIndex]}.
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {result.explanation}
                </p>
              </div>
            ))}
          </div>
        ) : activeQuestion ? (
          <div className="mt-6">
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                Question {quizStep + 1} of {quizQuestions.length}
              </p>
              <p className="mt-2 text-lg font-medium leading-7 text-[var(--color-text-primary)]">
                {activeQuestion.prompt}
              </p>

              <div className="mt-4 space-y-3">
                {activeQuestion.options.map((option, optionIndex) => {
                  const selected = quizAnswers[activeQuestion.id] === optionIndex;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition",
                        selected
                          ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-900)]"
                          : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]",
                      )}
                      onClick={() =>
                        setQuizAnswers((current) => ({
                          ...current,
                          [activeQuestion.id]: optionIndex,
                        }))
                      }
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {quizSubmitError ? (
              <p className="mt-3 text-sm text-red-600">{quizSubmitError}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {unansweredCount > 0
                  ? `${unansweredCount} question${unansweredCount === 1 ? "" : "s"} left`
                  : "All questions answered"}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={quizStep === 0}
                  onClick={() => setQuizStep((value) => Math.max(0, value - 1))}
                >
                  Previous
                </Button>

                {quizStep < quizQuestions.length - 1 ? (
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() =>
                      setQuizStep((value) =>
                        Math.min(quizQuestions.length - 1, value + 1),
                      )
                    }
                  >
                    Next question
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={quizSubmitting || unansweredCount > 0}
                    onClick={() => void handleQuizSubmit()}
                  >
                    {quizSubmitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    Submit quiz
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderPodcastCard = () => {
    if (!isCompleted) {
      return (
        <section className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6">
          <div className="flex items-center gap-3">
            <Headphones className="size-5 text-[var(--color-primary-700)]" />
            <div>
              <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
                Audio recap
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Finish the chapter before generating a short recap.
              </p>
            </div>
          </div>
        </section>
      );
    }

    const status = podcastState?.status ?? "PENDING";

    return (
      <section className="rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-tr-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Headphones className="size-5 text-[var(--color-primary-700)]" />
            <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
              Audio recap
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Single-narrator recap
            </p>
          </div>
        </div>

          <Button
            type="button"
            className="rounded-full"
            disabled
            onClick={() => void handleGeneratePodcast()}
          >
            {podcastBusy || status === "GENERATING" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {status === "READY"
              ? "Regenerate recap"
              : status === "FAILED"
                ? "Generate again"
                : "Generate recap"}
          </Button>
        </div>

        {podcastError ? (
          <p className="mt-4 text-sm text-red-600">{podcastError}</p>
        ) : null}

        {podcastLoading && !podcastState ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking recap status…
          </div>
        ) : null}

        {status === "PENDING" ? (
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            Generate a 2 to 3 minute recap when you want a spoken review of the
            chapter.
          </p>
        ) : null}

        {status === "GENERATING" ? (
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            Your recap is being generated now. This page will refresh the player
            automatically when it is ready.
          </p>
        ) : null}

        {status === "FAILED" ? (
          <p className="mt-4 text-sm leading-6 text-red-700">
            {podcastState?.error ?? "Podcast generation failed."}
          </p>
        ) : null}

        {status === "READY" && podcastState?.audioUrl ? (
          <div className="mt-5 space-y-4">
            <PodcastPlayer
              key={podcastState.audioUrl}
              src={podcastState.audioUrl}
              durationSeconds={podcastState.durationSeconds}
            />
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              This recap covers the main events, characters, and themes from the
              chapter without going beyond the current reading context.
            </p>
          </div>
        ) : null}
      </section>
    );
  };

  const artifactCards =
    currentView === "quiz"
      ? [renderQuizCard(), renderSummaryCard(), renderPodcastCard()]
      : currentView === "summary"
        ? [renderSummaryCard(), renderQuizCard(), renderPodcastCard()]
        : [renderSummaryCard(), renderQuizCard(), renderPodcastCard()];

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
                    pageTurn === "next"
                      ? "trailread-page-turn-next"
                      : "trailread-page-turn-prev",
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

              {completeErr ? (
                <p className="mb-4 text-center text-sm text-red-600 dark:text-red-400">
                  {completeErr}
                </p>
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

              <section
                ref={chapterEndRef}
                className="mt-12 border-t border-[var(--color-border-subtle)] pt-8"
              >
                {!isCompleted ? (
                  <div className="rounded-[28px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-6 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                      Chapter end
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-semibold text-[var(--color-text-primary)]">
                      Ready to move on?
                    </h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                      Mark this chapter complete when you feel ready. Summary,
                      quiz, and audio recap will appear right here.
                    </p>
                    <div className="mt-6 flex justify-center">
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
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 shadow-[var(--shadow-tr-sm)]">
                      <div className="flex flex-wrap items-start gap-4">
                        <div
                          className={cn(
                            "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                            completionTone === "celebration"
                              ? "bg-[var(--color-primary-100)] text-[var(--color-primary-800)]"
                              : "bg-[var(--color-bg-surface)] text-[var(--color-primary-700)]",
                          )}
                        >
                          {completionTone === "celebration" ? (
                            <PartyPopper className="size-6" aria-hidden />
                          ) : (
                            <CheckCircle2 className="size-6" aria-hidden />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                            {completionTone === "celebration"
                              ? "Chapter complete"
                              : "Completed chapter"}
                          </p>
                          <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--color-text-primary)]">
                            {completionTone === "celebration"
                              ? "Review what you just read"
                              : "Review this chapter any time"}
                          </h3>
                          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                            {completionTone === "celebration"
                              ? "Nice work. Summary, quiz, and audio recap are ready below, and you can move on whenever you want."
                              : "Summary, quiz, and recap stay here so you can revisit them before moving on."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {artifactCards.map((card, cardIndex) => (
                      <div key={cardIndex}>{card}</div>
                    ))}

                    <div className="flex flex-wrap justify-end gap-3">
                      <Link
                        to={nextHref}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-text-inverse)] shadow-[var(--shadow-tr-sm)] transition hover:-translate-y-0.5"
                      >
                        {nextOpen && nextRaw ? "Next chapter" : "Back to book"}
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </div>
                )}
              </section>
            </article>
          </div>

          {!isCompleted ? (
            <nav className="flex flex-wrap items-center justify-between gap-3 pb-4">
            {prevOpen && prevRaw ? (
              <Link
                to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${prevRaw.chapterNumber}`}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-primary-700)] hover:bg-[var(--color-bg-muted)]"
                onClick={() => setPageTurn("prev")}
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
                onClick={() => setPageTurn("next")}
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
          ) : null}
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
                <BookMarked
                  className="size-3.5 text-[var(--color-primary-700)]"
                  aria-hidden
                />
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
              <div
                className="h-full rounded-full bg-[var(--color-primary-500)]"
                style={{ width: `${bookProgressPercent}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {prevOpen && prevRaw ? (
                <Link
                  to={`/app/books/${encodeURIComponent(book.slug)}/chapters/${prevRaw.chapterNumber}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-700)] transition hover:bg-[var(--color-bg-muted)]"
                  onClick={() => setPageTurn("prev")}
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
                  onClick={() => setPageTurn("next")}
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

          <ChapterChatPanel
            key={`assistant-${ch.id}-${currentView}`}
            chapterId={ch.id}
            articleRef={articleRef}
          />
        </div>
      </div>
    </div>
  );
}
