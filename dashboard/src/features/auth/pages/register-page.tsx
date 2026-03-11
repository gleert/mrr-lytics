import * as React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { useAuth } from '@/app/providers'
import { FormField } from '../components/form-field'
import { registerSchema, type RegisterFormData } from '../schemas/auth-schemas'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signUp, isAuthenticated, isLoading } = useAuth()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      await signUp({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      })
      // With immediate access, user will be redirected automatically
      // via auth state change
    } catch (err) {
      console.error('Sign up error:', err)
      const message = err instanceof Error ? err.message : t('errors.generic')
      if (message.includes('User already registered')) {
        setError(t('errors.emailInUse'))
      } else {
        setError(message)
      }
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t('auth.createAccount')}</h2>
        <p className="mt-1 text-sm text-muted">{t('auth.getStarted')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('auth.fullName')}
          type="text"
          placeholder="John Doe"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <FormField
          label={t('auth.email')}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          label={t('auth.password')}
          type="password"
          placeholder="Min. 6 characters"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <FormField
          label={t('auth.confirmPassword')}
          type="password"
          placeholder="Confirm your password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" />
              {t('auth.creatingAccount')}
            </>
          ) : (
            t('auth.createAccount')
          )}
        </Button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link
          to="/login"
          className="text-primary-500 hover:text-primary-400 font-medium transition-colors"
        >
          {t('auth.login')}
        </Link>
      </p>
    </div>
  )
}
