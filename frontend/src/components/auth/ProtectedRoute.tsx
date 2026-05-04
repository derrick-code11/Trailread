import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute() {
  const { user, loading, error, refresh } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-bg-base)] font-body text-[var(--color-text-secondary)]">
        <Loader2 className="size-6 animate-spin opacity-60" aria-hidden />
        <span className="sr-only">Loading session</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-bg-base)] px-6 font-body text-center">
        <p className="text-[var(--color-text-primary)]">{error}</p>
        <button
          type="button"
          className="rounded-lg bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-primary-700)]"
          onClick={() => void refresh()}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!user) {
    const returnUrl = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
  }

  return <Outlet />
}
