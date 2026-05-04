import { Minus, Plus, Type } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type ReaderMeasure = 'narrow' | 'normal' | 'wide'
export type ReaderSpacing = 'tight' | 'normal' | 'relaxed'

export const READER_FONT_SIZE_KEY = 'trailread.reader.fontSize'
export const READER_MEASURE_KEY = 'trailread.reader.measure'
export const READER_SPACING_KEY = 'trailread.reader.spacing'

type Props = {
  fontSizePx: number
  setFontSizePx: (n: number) => void
  measure: ReaderMeasure
  setMeasure: (m: ReaderMeasure) => void
  spacing: ReaderSpacing
  setSpacing: (s: ReaderSpacing) => void
}

const MEASURES: ReaderMeasure[] = ['narrow', 'normal', 'wide']
const SPACINGS: ReaderSpacing[] = ['tight', 'normal', 'relaxed']

export function ReaderPreferences({
  fontSizePx,
  setFontSizePx,
  measure,
  setMeasure,
  spacing,
  setSpacing,
}: Props) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-[var(--color-primary-50)] p-2 text-[var(--color-primary-700)]">
            <Type className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Text size</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Adjust the default size used in the reader.</p>
          </div>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Smaller text"
            onClick={() => setFontSizePx(Math.max(14, fontSizePx - 1))}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-[2.5rem] text-center text-sm tabular-nums">{fontSizePx}px</span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Larger text"
            onClick={() => setFontSizePx(Math.min(26, fontSizePx + 1))}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Page width</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Choose how wide each reading page should feel.</p>
        </div>
        <div className="flex w-fit gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-1">
          {MEASURES.map((m) => (
            <Button
              key={m}
              type="button"
              variant={measure === m ? 'default' : 'outline'}
              size="sm"
              className="capitalize"
              onClick={() => setMeasure(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Paragraph spacing</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Set the rhythm between paragraphs.</p>
        </div>
        <div className="flex w-fit gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-1">
          {SPACINGS.map((s) => (
            <Button
              key={s}
              type="button"
              variant={spacing === s ? 'default' : 'outline'}
              size="sm"
              className="capitalize"
              onClick={() => setSpacing(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
