import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/shared/components/ui/spinner'
import { supabase } from '@/shared/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the code from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)
        
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const errorParam = queryParams.get('error') || hashParams.get('error')
        const errorDescription = queryParams.get('error_description') || hashParams.get('error_description')

        if (errorParam) {
          throw new Error(errorDescription || errorParam)
        }

        if (accessToken && refreshToken) {
          // Set the session
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            throw sessionError
          }
        }

        // Exchange code for session if using PKCE flow
        const code = queryParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
        }

        // Redirect to dashboard
        navigate('/', { replace: true })
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="rounded-lg bg-error/10 p-4 text-center">
          <p className="text-sm text-error">{error}</p>
          <p className="mt-2 text-xs text-muted">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-sm text-muted">Completing sign in...</p>
    </div>
  )
}
