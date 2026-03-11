import * as React from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'

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

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUp: (options: SignUpOptions) => Promise<void>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  refreshSession: () => Promise<void>
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

  // Initialize auth state
  React.useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const signInWithGoogle = React.useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
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
