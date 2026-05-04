import { Loader2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthApiError, forgotPassword } from '@/lib/authApi'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { message } = await forgotPassword({ email: email.trim() })
      setSuccessMessage(message)
    } catch (err) {
      const msg =
        err instanceof AuthApiError ? err.message : 'Something went wrong. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (successMessage) {
    return (
      <div className="flex flex-col gap-8">
        <header className="space-y-2">
          <h1 className="font-display text-[clamp(1.625rem,4vw,2rem)] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Check your email
          </h1>
          <p className="font-body text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            {successMessage}
          </p>
        </header>
        <Link
          to="/"
          className="font-body text-[15px] font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <h1 className="font-display text-[clamp(1.625rem,4vw,2rem)] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Reset password
        </h1>
        <p className="font-body text-[15px] text-[var(--color-text-secondary)]">
          Enter your email and we&apos;ll send instructions if an account exists.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
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
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>

      <Link
        to="/"
        className="text-center font-body text-[15px] font-medium text-[var(--color-primary-700)] underline-offset-2 hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  )
}
