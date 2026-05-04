import { Outlet } from 'react-router-dom'

export function AuthSplitShell() {
  return (
    <div className="trailread-auth relative min-h-dvh bg-[var(--color-bg-base)] font-body text-[var(--color-text-primary)]">
      <div className="grid min-h-dvh grid-rows-[minmax(160px,26vh)_1fr] md:grid-cols-2 md:grid-rows-1">
        <div className="relative min-h-0 md:min-h-dvh">
          <img
            src="/auth-hero.jpg"
            alt=""
            className="absolute inset-0 size-full object-cover"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[var(--color-text-primary)]/20"
            aria-hidden
          />
        </div>

        <div className="relative flex min-h-0 flex-col justify-center border-[var(--color-border-muted)] px-5 py-16 md:border-l md:px-8 md:py-16 lg:px-12">
          <div className="mx-auto w-full max-w-[440px] pb-safe">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
