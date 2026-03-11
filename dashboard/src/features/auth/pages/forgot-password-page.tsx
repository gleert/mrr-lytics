import * as React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { useAuth } from '@/app/providers'
import { FormField } from '../components/form-field'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../schemas/auth-schemas'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { resetPasswordForEmail } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      await resetPasswordForEmail(data.email)
      setIsSuccess(true)
    } catch (err) {
      console.error('Reset password error:', err)
      const message = err instanceof Error ? err.message : t('errors.generic')
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <Mail className="h-6 w-6 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('auth.checkEmail')}</h2>
          <p className="mt-2 text-sm text-muted">
            {t('auth.resetLinkSent', { email: getValues('email') })}
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('auth.backToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t('auth.forgotPasswordTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('auth.forgotPasswordSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('auth.email')}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" />
              {t('auth.sending')}
            </>
          ) : (
            t('auth.sendResetLink')
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
