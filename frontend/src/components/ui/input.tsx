import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-[var(--radius-tr-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 font-body text-[15px] text-[var(--color-text-primary)] shadow-[var(--shadow-tr-xs)] transition-[color,box-shadow,border-color] outline-none placeholder:text-[var(--color-text-tertiary)] focus-visible:border-[var(--color-primary-500)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary-100)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--color-bg-sunken)] disabled:text-[var(--color-text-tertiary)]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
