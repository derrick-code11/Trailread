import {
  BookOpen,
  Home,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/authApi";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", icon: Home, label: "Home", end: true },
  { to: "/app/books", icon: BookOpen, label: "Library", end: false },
  { to: "/app/progress", icon: LineChart, label: "Progress", end: false },
  { to: "/app/settings", icon: Settings, label: "Settings", end: false },
] as const;

function linkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors",
    isActive
      ? "bg-[var(--color-primary-100)] text-[var(--color-primary-900)]"
      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]",
  );
}

export function AppLayout() {
  const location = useLocation();
  const { user, refresh } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isReaderRoute = /^\/app\/books\/[^/]+\/chapters\/\d+/.test(location.pathname);

  async function onLogout() {
    try {
      await logout();
    } catch {
      /* still clear client */
    }
    await refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center px-5">
        <NavLink
          to="/app"
          className="font-display text-xl font-bold tracking-tight text-[var(--color-text-primary)]"
        >
          Trailread
        </NavLink>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 px-3 pt-2">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={linkClass}
            onClick={() => setMobileOpen(false)}
          >
            <Icon className="size-[18px] shrink-0 opacity-70" aria-hidden />
            {label}
          </NavLink>
        ))}

        {user?.role === "ADMIN" ? (
          <>
            <div className="my-4 border-t border-[var(--color-border-subtle)]" />
            <NavLink
              to="/admin/books"
              className={linkClass}
              onClick={() => setMobileOpen(false)}
            >
              <Shield className="size-[18px] shrink-0 opacity-70" aria-hidden />
              Admin
            </NavLink>
          </>
        ) : null}
      </nav>

      {/* Account footer */}
      <div className="border-t border-[var(--color-border-subtle)] px-3 py-4">
        <div className="mb-3 px-3">
          <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
            {user?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200"
        >
          <LogOut className="size-[18px] shrink-0" aria-hidden />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-[var(--color-bg-base)] font-body text-[var(--color-text-primary)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] lg:block">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--color-text-primary)]/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shadow-xl">
            <div className="absolute right-3 top-4">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      ) : null}

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-60">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-display text-lg font-bold tracking-tight">
            Trailread
          </span>
        </header>

        <main
          className={cn(
            "mx-auto w-full flex-1 py-8",
            isReaderRoute
              ? "max-w-[1600px] px-3 sm:px-5 lg:px-6 xl:px-8"
              : "max-w-4xl px-5 sm:px-8",
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
