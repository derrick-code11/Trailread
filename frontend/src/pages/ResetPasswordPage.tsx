import { Loader2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PasswordField } from '@/components/auth/PasswordField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AuthApiError, resetPassword } from '@/lib/authApi'

const MIN_PASSWORD = 8

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('This reset link is missing a token. Request a new link below.')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { message } = await resetPassword({ token, password })
      setSuccessMessage(message)
    } catch (err) {
      const msg =
        err instanceof AuthApiError ? err.message : 'Something went wrong. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!token && !successMessage) {
    return (
      <div className="flex flex-col gap-8">
        <header className="space-y-2">
          <h1 className="font-display text-[clamp(1.625rem,4vw,2rem)] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Invalid link
          </h1>
          <p className="font-body text-[15px] text-[var(--color-text-secondary)]">
            This password reset link is missing a token. Request a new reset email.
          </p>
        </header>
        <Link
          to="/forgot-password"
          className="font-body text-[15px] font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
        >
          Request a new link
        </Link>
        <Link
          to="/"
          className="font-body text-[15px] text-[var(--color-text-secondary)] underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  if (successMessage) {
    return (
      <div className="flex flex-col gap-8">
        <header className="space-y-2">
          <h1 className="font-display text-[clamp(1.625rem,4vw,2rem)] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Password updated
          </h1>
          <p className="font-body text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            {successMessage}
          </p>
        </header>
        <Button
          asChild
          className="h-12 w-full gap-2 rounded-[var(--radius-tr-md)] text-[15px] font-semibold"
        >
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <h1 className="font-display text-[clamp(1.625rem,4vw,2rem)] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Choose a new password
        </h1>
        <p className="font-body text-[15px] text-[var(--color-text-secondary)]">
          Enter a new password for your account.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-password">New password</Label>
            <PasswordField
              id="reset-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <p className="font-body text-[12px] text-[var(--color-text-tertiary)]">
              At least {MIN_PASSWORD} characters.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-confirm">Confirm new password</Label>
            <PasswordField
              id="reset-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </div>

        {error ? (
          <p className="font-body text-[13px] text-[var(--color-error)]" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full gap-2 rounded-[var(--radius-tr-md)] text-[15px] font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </form>

      <Link
        to="/forgot-password"
        className="text-center font-body text-[13px] text-[var(--color-text-secondary)] underline-offset-2 hover:underline"
      >
        Request a new link
      </Link>
    </div>
  )
}
