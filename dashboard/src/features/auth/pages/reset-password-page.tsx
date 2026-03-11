import * as React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { useAuth } from '@/app/providers'
import { FormField } from '../components/form-field'
import { resetPasswordSchema, type ResetPasswordFormData } from '../schemas/auth-schemas'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updatePassword, isAuthenticated } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  // Check if user came from reset link (should have a session from Supabase)
  React.useEffect(() => {
    // Give Supabase a moment to process the reset link and establish session
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        // No session means invalid/expired link
        setError(t('errors.invalidResetLink'))
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [isAuthenticated, t])

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      await updatePassword(data.password)
      setIsSuccess(true)
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 2000)
    } catch (err) {
      console.error('Update password error:', err)
      const message = err instanceof Error ? err.message : t('errors.generic')
      setError(message)
      setIsSubmitting(false)
    }
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('auth.passwordUpdated')}</h2>
          <p className="mt-2 text-sm text-muted">
            {t('auth.redirectingToDashboard')}
          </p>
        </div>
        <Spinner size="sm" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t('auth.resetPasswordTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('auth.resetPasswordSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('auth.newPassword')}
          type="password"
          placeholder="Min. 6 characters"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <FormField
          label={t('auth.confirmPassword')}
          type="password"
          placeholder="Confirm your new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !isAuthenticated}
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" />
              {t('auth.updating')}
            </>
          ) : (
            t('auth.updatePassword')
          )}
        </Button>
      </form>

      {/* Back to login */}
      <div className="text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('auth.backToLogin')}
        </Link>
      </div>
    </div>
  )
}
