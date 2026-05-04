import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PasswordFieldProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  id: string
}

export function PasswordField({ id, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={props.autoComplete ?? 'current-password'}
        className="pr-12"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className={cn(
          'absolute top-0 right-1.5 bottom-0 z-10 my-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          'text-[var(--color-text-secondary)] transition-colors',
          'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-surface)]',
        )}
      >
        <span className="pointer-events-none flex size-4 items-center justify-center [&_svg]:block [&_svg]:size-4">
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </span>
      </button>
    </div>
  )
}
