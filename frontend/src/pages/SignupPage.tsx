import { Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { PasswordField } from '@/components/auth/PasswordField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { AuthApiError, signup } from '@/lib/authApi'

const MIN_PASSWORD = 8

function safeReturnUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/app'
  return raw
}

export function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

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
      await signup({ email: email.trim(), password })
      await refresh()
      navigate(safeReturnUrl(params.get('returnUrl')))
    } catch (err) {
      const msg =
        err instanceof AuthApiError
          ? err.message
          : 'Something went wrong. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <h1 className="font-display text-[clamp(1.625rem,4vw,2rem)] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Create an account
        </h1>
        <p className="font-body text-[15px] text-[var(--color-text-secondary)]">
          Start your guided reading journey.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="signup-password">Password</Label>
            <PasswordField
              id="signup-password"
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
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <PasswordField
              id="signup-confirm"
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
              Creating account…
            </>
          ) : (
            'Sign up'
          )}
        </Button>
      </form>

      <p className="text-center font-body text-[15px] text-[var(--color-text-secondary)]">
        Already have an account?{' '}
        <Link
          to={
            params.get('returnUrl')
              ? `/login?returnUrl=${encodeURIComponent(params.get('returnUrl')!)}`
              : '/login'
          }
          className="font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}
