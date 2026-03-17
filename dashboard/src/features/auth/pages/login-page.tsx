import * as React from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { useAuth } from '@/app/providers'
import { FormField } from '../components/form-field'
import { AuthDivider } from '../components/auth-divider'
import { loginSchema, type LoginFormData } from '../schemas/auth-schemas'

// Google logo SVG
const GoogleLogo = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

const isDev = import.meta.env.DEV

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithGoogle, signInWithEmail, isAuthenticated, isLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [isSigningIn, setIsSigningIn] = React.useState(false)
  const [isGoogleSigningIn, setIsGoogleSigningIn] = React.useState(false)
  const [isDevSigningIn, setIsDevSigningIn] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Read account-switch query params
  const loginHint = searchParams.get('hint') || undefined
  const promptParam = searchParams.get('prompt') || undefined

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = (location.state as { from?: string })?.from || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, location])

  const onSubmit = async (data: LoginFormData) => {
    setIsSigningIn(true)
    setError(null)

    try {
      await signInWithEmail(data.email, data.password)
      // Redirect happens automatically via auth state change
    } catch (err) {
      console.error('Sign in error:', err)
      const message = err instanceof Error ? err.message : t('errors.generic')
      if (message.includes('Invalid login credentials')) {
        setError(t('errors.invalidCredentials'))
      } else {
        setError(message)
      }
      setIsSigningIn(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true)
    setError(null)

    try {
      await signInWithGoogle({
        loginHint,
        prompt: promptParam,
      })
      // Redirect happens automatically via OAuth callback
    } catch (err) {
      console.error('Sign in error:', err)
      setError(t('errors.generic'))
      setIsGoogleSigningIn(false)
    }
  }

  // Auto-trigger Google sign-in when coming from account switch
  const autoTriggered = React.useRef(false)
  React.useEffect(() => {
    if ((loginHint || promptParam) && !autoTriggered.current && !isLoading && !isAuthenticated) {
      autoTriggered.current = true
      handleGoogleSignIn()
    }
  }, [loginHint, promptParam, isLoading, isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quick dev login with test credentials
  const handleDevLogin = async () => {
    setIsDevSigningIn(true)
    setError(null)

    try {
      await signInWithEmail('admin@example.com', 'password123')
    } catch (err) {
      console.error('Dev sign in error:', err)
      setError(t('errors.invalidCredentials'))
      setIsDevSigningIn(false)
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
        <h2 className="text-xl font-semibold">{t('auth.signInTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('auth.signInSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('auth.email')}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-2">
          <FormField
            label={t('auth.password')}
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-xs text-primary-500 hover:text-primary-400 transition-colors"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSigningIn}>
          {isSigningIn ? (
            <>
              <Spinner size="sm" />
              {t('auth.signingIn')}
            </>
          ) : (
            t('auth.login')
          )}
        </Button>
      </form>

      <AuthDivider text={t('auth.orContinueWith')} />

      {/* Google OAuth */}
      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={handleGoogleSignIn}
        disabled={isGoogleSigningIn}
      >
        {isGoogleSigningIn ? (
          <>
            <Spinner size="sm" />
            {t('auth.signingIn')}
          </>
        ) : (
          <>
            <GoogleLogo />
            {t('auth.signInWithGoogle')}
          </>
        )}
      </Button>

      {/* Sign up link */}
      <p className="text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          className="text-primary-500 hover:text-primary-400 font-medium transition-colors"
        >
          {t('auth.signUp')}
        </Link>
      </p>

      {/* Dev Login - Only in development */}
      {isDev && (
        <div className="pt-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full border-dashed border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
            onClick={handleDevLogin}
            disabled={isDevSigningIn}
          >
            {isDevSigningIn ? (
              <>
                <Spinner size="sm" />
                Signing in...
              </>
            ) : (
              <>
                <span className="mr-2">⚡</span>
                Dev Login (admin@example.com)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
