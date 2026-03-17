import * as React from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { clearQueryCache } from './query-provider'
import { addKnownAccount } from '@/shared/lib/account-store'

export type UserRole = 'admin' | 'viewer'

export interface AuthUser extends User {
  role?: UserRole
  tenantId?: string
}

interface AuthState {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface SignUpOptions {
  fullName: string
  email: string
  password: string
}

interface SignInWithGoogleOptions {
  loginHint?: string
  prompt?: string
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: (options?: SignInWithGoogleOptions) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUp: (options: SignUpOptions) => Promise<void>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  refreshSession: () => Promise<void>
  switchAccount: (email: string) => Promise<void>
  addAccount: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Track the current user ID to detect user switches
  const currentUserIdRef = React.useRef<string | null>(null)

  // Initialize auth state
  React.useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user as AuthUser | null,
        isAuthenticated: !!session,
        isLoading: false,
      }))
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null
      const previousUserId = currentUserIdRef.current

      // Clear cache when user changes (different user logged in) or on sign out
      if (
        event === 'SIGNED_OUT' ||
        (newUserId && previousUserId && newUserId !== previousUserId)
      ) {
        clearQueryCache()
      }

      // Save to known accounts on sign-in
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const u = session.user
        addKnownAccount({
          id: u.id,
          email: u.email ?? '',
          fullName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
          avatarUrl: u.user_metadata?.avatar_url ?? null,
          provider: u.app_metadata?.provider ?? 'email',
        })
      }

      currentUserIdRef.current = newUserId
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user as AuthUser | null,
        isAuthenticated: !!session,
        isLoading: false,
      }))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = React.useCallback(async (options?: SignInWithGoogleOptions) => {
    const queryParams: Record<string, string> = {
      access_type: 'offline',
      prompt: options?.prompt || 'consent',
    }
    if (options?.loginHint) {
      queryParams.login_hint = options.loginHint
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams,
      },
    })

    if (error) {
      console.error('Google sign in error:', error)
      throw error
    }
  }, [])

  const signInWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Email sign in error:', error)
        throw error
      }
    },
    []
  )

  const signUp = React.useCallback(
    async ({ fullName, email, password }: SignUpOptions) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
          },
          // For local dev, email confirmation is disabled by default
          // In production, set emailRedirectTo for confirmation
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error('Sign up error:', error)
        throw error
      }
    },
    []
  )

  const signOut = React.useCallback(async () => {
    // Clear cached data first to prevent leaking between users
    clearQueryCache()
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }, [])

  const resetPasswordForEmail = React.useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      console.error('Reset password error:', error)
      throw error
    }
  }, [])

  const updatePassword = React.useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Update password error:', error)
      throw error
    }
  }, [])

  const switchAccount = React.useCallback(async (email: string) => {
    clearQueryCache()
    await supabase.auth.signOut()
    // Redirect to login with hint so Google pre-selects the account
    window.location.href = `/login?hint=${encodeURIComponent(email)}`
  }, [])

  const addAccount = React.useCallback(async () => {
    clearQueryCache()
    await supabase.auth.signOut()
    // Redirect to login forcing account selection
    window.location.href = '/login?prompt=select_account'
  }, [])

  const refreshSession = React.useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      console.error('Refresh session error:', error)
      throw error
    }
    if (data.session) {
      setState((prev) => ({
        ...prev,
        session: data.session,
        user: data.session?.user as AuthUser | null,
        isAuthenticated: !!data.session,
      }))
    }
  }, [])

  const value = React.useMemo(
    () => ({
      ...state,
      signInWithGoogle,
      signInWithEmail,
      signUp,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refreshSession,
      switchAccount,
      addAccount,
    }),
    [
      state,
      signInWithGoogle,
      signInWithEmail,
      signUp,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refreshSession,
      switchAccount,
      addAccount,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
