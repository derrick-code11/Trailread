import { BookOpen, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  READER_FONT_SIZE_KEY,
  READER_MEASURE_KEY,
  READER_SPACING_KEY,
  ReaderPreferences,
  type ReaderMeasure,
  type ReaderSpacing,
} from '@/components/reader/ReaderPreferences'
import { readerMeasureClass, readerSpacingClass } from '@/components/reader/readerLayout'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { useThemePreference, type ThemePreference } from '@/hooks/useThemePreference'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const [theme, setTheme] = useThemePreference()
  const [fontSizePx, setFontSizePx] = useLocalStorageState(READER_FONT_SIZE_KEY, 18)
  const [measure, setMeasure] = useLocalStorageState<ReaderMeasure>(READER_MEASURE_KEY, 'normal')
  const [spacing, setSpacing] = useLocalStorageState<ReaderSpacing>(READER_SPACING_KEY, 'normal')

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-tr-sm)] sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-700)]">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Preferences
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,7vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
          Settings
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
          Tune Trailread so the reader feels more like your own quiet page.
        </p>
      </header>

      <section className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-tr-xs)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-[var(--color-primary-50)] p-2 text-[var(--color-primary-700)]">
              {theme === 'dark' ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Appearance</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                Choose the color theme used across Trailread.
              </p>
            </div>
          </div>

          <div className="flex w-fit gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-1">
            <ThemeButton theme="light" currentTheme={theme} setTheme={setTheme} icon={Sun} label="Light" />
            <ThemeButton theme="dark" currentTheme={theme} setTheme={setTheme} icon={Moon} label="Dark" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-tr-xs)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-[var(--color-primary-50)] p-2 text-[var(--color-primary-700)]">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Reader</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                These settings apply automatically when you open any chapter.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <ReaderPreferences
              fontSizePx={fontSizePx}
              setFontSizePx={(px) => setFontSizePx(px)}
              measure={measure}
              setMeasure={(m) => setMeasure(m)}
              spacing={spacing}
              setSpacing={(s) => setSpacing(s)}
            />
          </div>
        </div>

        <aside className="rounded-[24px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-tr-xs)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Preview</p>
          <div
            className={cn('mt-5 font-display text-[var(--color-text-primary)]', readerMeasureClass(measure), readerSpacingClass(spacing))}
            style={{ fontSize: `${Math.min(fontSizePx, 20)}px`, lineHeight: 1.72 }}
          >
            <p>
              The marshes were just a long black horizontal line then, as I stopped to look after him.
            </p>
            <p className="text-[var(--color-text-secondary)]">
              Your page width, spacing, and type size are saved on this device.
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
}

function ThemeButton({
  theme,
  currentTheme,
  setTheme,
  icon: Icon,
  label,
}: {
  theme: ThemePreference
  currentTheme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  icon: typeof Sun
  label: string
}) {
  const selected = currentTheme === theme

  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? 'default' : 'ghost'}
      className="rounded-full px-3"
      aria-pressed={selected}
      onClick={() => setTheme(theme)}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Button>
  )
}
