import { Loader2, MessageSquare, Send, Sparkles, Volume2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
  ApiRequestError,
  postChapterChat,
  postHighlightHelp,
  postHighlightPronunciation,
  type ChapterChatGrounding,
  type HighlightHelpMode,
} from "@/lib/booksApi";
import { cn } from "@/lib/utils";

type Props = {
  chapterId: string;
  articleRef: React.RefObject<HTMLElement | null>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounding?: ChapterChatGrounding[];
};

type SelectionState = {
  text: string;
  startIdx: number;
  endIdx: number;
};

const HIGHLIGHT_MODES: HighlightHelpMode[] = [
  "EXPLAIN",
  "SIMPLIFY",
  "DEFINE",
  "CONTEXT",
];

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatParagraphRange(source: ChapterChatGrounding): string {
  const start = source.paragraphStartIndex + 1;
  const end = source.paragraphEndIndex + 1;
  return start === end ? `Paragraph ${start}` : `Paragraphs ${start}-${end}`;
}

function containsInArticle(article: HTMLElement, node: Node | null): boolean {
  if (!node) return false;
  const el =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as Element | null);
  return Boolean(el && article.contains(el));
}

function paragraphIndexFromNode(n: Node | null): number | null {
  let el: HTMLElement | null =
    n?.nodeType === Node.TEXT_NODE
      ? (n.parentElement as HTMLElement | null)
      : (n as HTMLElement | null);
  while (el && el.dataset.paragraphIndex == null) {
    el = el.parentElement;
  }
  const v = el?.dataset.paragraphIndex;
  return v != null && v !== "" ? Number(v) : null;
}

function modeLabel(mode: HighlightHelpMode): string {
  switch (mode) {
    case "EXPLAIN":
      return "Explain";
    case "SIMPLIFY":
      return "Simplify";
    case "DEFINE":
      return "Define";
    case "CONTEXT":
      return "Context";
  }
}

export function ChapterChatPanel({ chapterId, articleRef }: Props) {
  const [conversationId] = useState(() => createClientId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [highlightAnswer, setHighlightAnswer] = useState<string | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [pronunciationLoading, setPronunciationLoading] = useState(false);
  const [limitationMessage, setLimitationMessage] = useState(
    "Ask about the current chapter. Answers stay grounded to retrieved chapter passages.",
  );
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);
  const pronunciationObjectUrlRef = useRef<string | null>(null);
  const pronunciationRequestIdRef = useRef(0);
  const isHighlightMode = selection != null;
  const assistantActionLoading = highlightLoading || pronunciationLoading;

  const stopPronunciationAudio = useCallback(() => {
    pronunciationAudioRef.current?.pause();
    pronunciationAudioRef.current = null;
    if (pronunciationObjectUrlRef.current) {
      URL.revokeObjectURL(pronunciationObjectUrlRef.current);
      pronunciationObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, error]);

  useEffect(() => {
    return () => stopPronunciationAudio();
  }, [stopPronunciationAudio]);

  const onMouseUp = useCallback(() => {
    const article = articleRef.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!article || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }
    if (
      !containsInArticle(article, sel.anchorNode) ||
      !containsInArticle(article, sel.focusNode)
    ) {
      return;
    }

    const text = sel
      .toString()
      .replace(/\u00a0/g, " ")
      .trim();
    if (text.length < 2) {
      return;
    }

    const a = paragraphIndexFromNode(sel.anchorNode);
    const f = paragraphIndexFromNode(sel.focusNode);
    if (a == null || f == null || !Number.isFinite(a) || !Number.isFinite(f)) {
      return;
    }

    setSelection({ text, startIdx: Math.min(a, f), endIdx: Math.max(a, f) });
    setHighlightAnswer(null);
    setHighlightError(null);
    setPronunciationLoading(false);
    pronunciationRequestIdRef.current += 1;
    stopPronunciationAudio();
  }, [articleRef, stopPronunciationAudio]);

  useEffect(() => {
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseUp]);

  const submitQuestion = async (submittedQuestion: string) => {
    const trimmed = submittedQuestion.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: createClientId(),
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setLoading(true);

    try {
      const response = await postChapterChat(chapterId, {
        question: trimmed,
        conversationId,
      });

      setLimitationMessage(response.limitationMessage);
      setMessages((current) => [
        ...current,
        {
          id: createClientId(),
          role: "assistant",
          content: response.answer,
          grounding: response.grounding,
        },
      ]);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 429) {
        setError("Too many chapter chat messages today. Try again tomorrow.");
      } else {
        setError(
          e instanceof ApiRequestError
            ? e.message
            : "Could not answer that question.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const runHighlightHelp = async (mode: HighlightHelpMode) => {
    if (!selection) return;
    setHighlightLoading(true);
    setHighlightError(null);
    setHighlightAnswer(null);
    try {
      const response = await postHighlightHelp(chapterId, {
        selectedText: selection.text,
        paragraphStartIndex: selection.startIdx,
        paragraphEndIndex: selection.endIdx,
        mode,
      });
      setHighlightAnswer(response.answer);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 429) {
        setHighlightError(
          "Too many highlight requests this hour. Try again later.",
        );
      } else {
        setHighlightError(
          e instanceof ApiRequestError
            ? e.message
            : "Could not get help for this selection.",
        );
      }
    } finally {
      setHighlightLoading(false);
    }
  };

  const playHighlightPronunciation = async () => {
    if (!selection || pronunciationLoading) return;
    const requestId = pronunciationRequestIdRef.current + 1;
    pronunciationRequestIdRef.current = requestId;
    setPronunciationLoading(true);
    setHighlightError(null);
    try {
      const audioBlob = await postHighlightPronunciation(chapterId, {
        selectedText: selection.text,
        paragraphStartIndex: selection.startIdx,
        paragraphEndIndex: selection.endIdx,
      });
      if (pronunciationRequestIdRef.current !== requestId) return;
      stopPronunciationAudio();
      const objectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(objectUrl);
      pronunciationObjectUrlRef.current = objectUrl;
      pronunciationAudioRef.current = audio;
      audio.addEventListener(
        "ended",
        () => {
          stopPronunciationAudio();
        },
        { once: true },
      );
      await audio.play();
    } catch (e) {
      if (pronunciationRequestIdRef.current !== requestId) return;
      stopPronunciationAudio();
      if (e instanceof ApiRequestError && e.status === 429) {
        setHighlightError(
          "Too many highlight requests this hour. Try again later.",
        );
      } else {
        setHighlightError(
          e instanceof ApiRequestError
            ? e.message
            : "Could not play pronunciation for this selection.",
        );
      }
    } finally {
      if (pronunciationRequestIdRef.current === requestId) {
        setPronunciationLoading(false);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(question);
  };

  const clearSelection = () => {
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
    setSelection(null);
    setHighlightAnswer(null);
    setHighlightError(null);
    setHighlightLoading(false);
    setPronunciationLoading(false);
    pronunciationRequestIdRef.current += 1;
    stopPronunciationAudio();
  };

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-tr-sm)]",
        isHighlightMode
          ? "h-[24rem] xl:h-auto xl:flex-1"
          : "h-[40rem] xl:h-[34rem]",
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 pb-3 pt-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            {isHighlightMode ? (
              <Sparkles
                className="size-3.5 text-[var(--color-primary-700)]"
                aria-hidden
              />
            ) : (
              <MessageSquare
                className="size-3.5 text-[var(--color-primary-700)]"
                aria-hidden
              />
            )}
            {isHighlightMode ? "Chapter assistant" : "Chapter chat"}
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            {isHighlightMode
              ? "Use the selected passage for focused help."
              : "Ask questions grounded to the current chapter."}
          </p>
        </div>
        {isHighlightMode ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Return to chapter chat"
            onClick={clearSelection}
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-gutter:stable]"
        aria-live="polite"
      >
        {isHighlightMode ? (
          <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3">
            <p className="mb-3 text-xs leading-5 text-[var(--color-text-tertiary)]">
              Selection active. Choose how you want help with it.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {HIGHLIGHT_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full px-2.5 text-[11px] font-semibold"
                  disabled={assistantActionLoading}
                  onClick={() => void runHighlightHelp(mode)}
                >
                  {modeLabel(mode)}
                </Button>
              ))}
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="rounded-full"
                disabled={assistantActionLoading}
                aria-label="Play American English pronunciation"
                onClick={() => void playHighlightPronunciation()}
              >
                {pronunciationLoading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Volume2 className="size-3.5" aria-hidden />
                )}
              </Button>
            </div>
            {highlightLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Thinking...
              </div>
            ) : null}
            {pronunciationLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Preparing pronunciation...
              </div>
            ) : null}
            {highlightError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {highlightError}
              </p>
            ) : null}
            {highlightAnswer ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--color-text-primary)]">
                {highlightAnswer}
              </p>
            ) : null}
            {!highlightLoading && !highlightError && !highlightAnswer ? (
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-tertiary)]">
                Choose an action for the selected text, or close this mode to
                return to chapter chat.
              </p>
            ) : null}
          </section>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
            Type a question below to chat with the current chapter. Highlight
            text in the chapter to switch into assistant mode.
          </p>
        ) : null}

        {!isHighlightMode
          ? messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-2xl px-3 py-2 text-sm leading-6",
                  message.role === "user"
                    ? "ml-6 bg-[var(--color-primary-50)] text-[var(--color-primary-900)]"
                    : "mr-6 border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]",
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === "assistant" &&
                message.grounding &&
                message.grounding.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.grounding.slice(0, 4).map((source) => (
                      <span
                        key={source.chunkId}
                        className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]"
                      >
                        {formatParagraphRange(source)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          : null}

        {!isHighlightMode && loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Reading the chapter…
          </div>
        ) : null}

        {!isHighlightMode && error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>

      {!isHighlightMode ? (
        <div className="shrink-0 border-t border-[var(--color-border-subtle)] px-4 py-3">
          <p className="mb-2 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
            {limitationMessage}
          </p>
          <form className="flex items-end gap-2" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chapter-chat-question">
              Ask about this chapter
            </label>
            <textarea
              id="chapter-chat-question"
              value={question}
              rows={2}
              maxLength={2_000}
              placeholder="Ask about this chapter..."
              className="min-h-10 flex-1 resize-none rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm leading-5 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-300)]/30"
              disabled={loading}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitQuestion(question);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              disabled={loading || question.trim().length < 3}
              aria-label="Send chapter question"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
            </Button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
