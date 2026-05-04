export function ProgressPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">
          Streaks, goals, and history will appear here.
        </p>
      </header>
      <div className="rounded-[var(--radius-tr-md)] border border-dashed border-[var(--color-border-default)] px-4 py-16 text-center text-sm text-[var(--color-text-secondary)]">
        No progress data yet. Start reading a book to track your streaks.
      </div>
    </div>
  )
}
