import { cn } from '@/lib/utils'

import type { ReaderMeasure, ReaderSpacing } from './ReaderPreferences'

export function readerMeasureClass(measure: ReaderMeasure): string {
  return cn(
    measure === 'narrow' && 'max-w-[46rem]',
    measure === 'normal' && 'max-w-[62rem]',
    measure === 'wide' && 'max-w-[76rem]',
  )
}

export function readerSpacingClass(spacing: ReaderSpacing): string {
  return cn(
    spacing === 'tight' && 'space-y-3',
    spacing === 'normal' && 'space-y-5',
    spacing === 'relaxed' && 'space-y-8',
  )
}
