import { LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { logout } from '@/lib/authApi'

export function AdminLayout() {
  const { user, refresh } = useAuth()

  async function onLogout() {
    try {
      await logout()
    } catch {
      /* still clear client */
    }
    await refresh()
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg-base)] font-body text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink
            to="/app"
            className="shrink-0 font-display text-xl font-bold tracking-tight text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            Trailread
          </NavLink>

          <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
            {user?.email ? (
              <span className="max-w-[40vw] truncate text-xs font-medium text-[var(--color-text-secondary)] sm:max-w-none sm:text-sm">
                {user.email}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void onLogout()}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
            >
              <LogOut className="size-3.5" aria-hidden />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
