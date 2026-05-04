import * as React from 'react'

import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'font-body text-[13px] font-medium text-[var(--color-text-secondary)]',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
