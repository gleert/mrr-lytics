import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { useTheme, useAuth } from '@/app/providers'
import { cn, formatRelativeTime } from '@/shared/lib/utils'
import { useSyncStatus, useTriggerSync } from '@/features/sync/hooks/use-sync'
import { useCommandPalette } from '@/shared/components/command-palette'
import { getKnownAccounts, removeKnownAccount } from '@/shared/lib/account-store'

interface HeaderProps {
  isMobile?: boolean
  onMenuClick?: () => void
}

export function Header({ isMobile = false, onMenuClick }: HeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTheme, resolvedTheme } = useTheme()
  const { user, signOut, switchAccount, addAccount } = useAuth()
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const { open: openCommandPalette } = useCommandPalette()
  
  // Sync status and trigger
  const { data: syncStatus } = useSyncStatus()
  const { mutate: triggerSync, isPending: isSyncing } = useTriggerSync()

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Always return 2 letters
  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      // Single name: take first 2 letters
      return name.slice(0, 2).toUpperCase()
    }
    if (email) {
      // Take first 2 letters of email
      return email.slice(0, 2).toUpperCase()
    }
    return 'US'
  }

  return (
    <header className="glass flex h-16 items-center gap-4 px-4 lg:px-6 border-b border-border bg-surface/80 dark:bg-surface/60 relative z-50">
      {/* Left side */}
      <div className="flex flex-1 min-w-0 items-center gap-3">
        {/* Hamburger menu (mobile) */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="rounded-xl text-muted hover:text-foreground"
          >
            <Icon name="menu" size="lg" />
          </Button>
        )}

        {/* Command palette trigger */}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={openCommandPalette}
            className="rounded-xl text-muted hover:text-foreground"
          >
            <Icon name="search" size="lg" />
          </Button>
        ) : (
          <button
            onClick={openCommandPalette}
            className={cn(
              'flex items-center gap-3 h-10 min-w-0 flex-1 max-w-xl rounded-xl bg-surface-hover pl-3 pr-3',
              'text-muted-foreground',
              'border border-transparent',
              'hover:border-border hover:bg-surface-elevated',
              'transition-all duration-200 cursor-pointer'
            )}
          >
            <Icon name="search" size="md" className="text-muted shrink-0" />
            <span className="flex-1 min-w-0 truncate text-left text-sm font-light">{t('commandPalette.placeholder')}</span>
            <kbd className="shrink-0 inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted select-none">
              {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+K
            </kbd>
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Sync status and button */}
        {!isMobile && syncStatus && (
          <div className="flex items-center gap-2 mr-1">
            {/* Last sync indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  syncStatus.is_syncing 
                    ? 'bg-warning animate-pulse' 
                    : !syncStatus.last_sync_at
                      ? 'bg-muted'
                      : syncStatus.history[0]?.status === 'completed'
                        ? 'bg-success'
                        : syncStatus.history[0]?.status === 'failed'
                          ? 'bg-error'
                          : 'bg-muted'
                )}
              />
              <span className="hidden lg:inline">
                {syncStatus.is_syncing 
                  ? t('sync.syncing')
                  : syncStatus.last_sync_at 
                    ? formatRelativeTime(syncStatus.last_sync_at)
                    : t('sync.never')
                }
              </span>
            </div>
          </div>
        )}

        {/* Sync button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => triggerSync()}
          disabled={isSyncing || syncStatus?.is_syncing}
          className="rounded-xl text-muted hover:text-foreground"
          title={t('sync.triggerSync')}
        >
          <Icon 
            name="sync" 
            size="lg" 
            className={cn(
              (isSyncing || syncStatus?.is_syncing) && 'animate-spin'
            )} 
          />
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl text-muted hover:text-foreground">
          <Icon name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'} size="lg" />
        </Button>

        {/* Divider (desktop only) */}
        {!isMobile && <div className="h-8 w-px bg-border mx-2" />}

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            className={cn(
              'flex items-center gap-3 rounded-xl hover:bg-surface-hover',
              isMobile ? 'px-2' : 'px-3'
            )}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Avatar className="h-10 w-10 ring-2 ring-primary-500/30">
              <AvatarImage
                src={user?.user_metadata?.avatar_url}
                alt={user?.user_metadata?.full_name || user?.email}
              />
              <AvatarFallback>
                {getInitials(
                  user?.user_metadata?.full_name,
                  user?.email ?? undefined
                )}
              </AvatarFallback>
            </Avatar>
            
            {/* User info (desktop only) */}
            {!isMobile && (
              <>
                <div className="text-left">
                  <p className="text-sm font-normal leading-tight">
                    {user?.user_metadata?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-muted truncate max-w-[140px] font-light">
                    {user?.email}
                  </p>
                </div>
                <Icon 
                  name="expand_more" 
                  size="md"
                  className={cn(
                    'text-muted transition-transform duration-200',
                    dropdownOpen && 'rotate-180'
                  )} 
                />
              </>
            )}
          </Button>

          {/* Dropdown menu */}
          {dropdownOpen && (() => {
            const otherAccounts = getKnownAccounts().filter(a => a.id !== user?.id)
            return (
              <div className="glass absolute right-0 top-full z-[9999] mt-2 w-72 rounded-xl p-1.5 shadow-xl animate-fade-in">
                {/* Current account */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border mb-1">
                  <Avatar className="h-9 w-9 shrink-0 ring-2 ring-primary-500/30">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt="" />
                    <AvatarFallback className="text-xs">
                      {getInitials(user?.user_metadata?.full_name, user?.email ?? undefined)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-normal truncate">
                      {user?.user_metadata?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted truncate font-light">{user?.email}</p>
                  </div>
                  <Icon name="check_circle" size="md" className="text-primary-500 shrink-0" />
                </div>

                {/* Other known accounts */}
                {otherAccounts.length > 0 && (
                  <>
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted select-none">
                      {t('auth.otherAccounts')}
                    </p>
                    {otherAccounts.map(account => (
                      <div key={account.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-hover transition-colors">
                        <button
                          className="flex items-center gap-3 flex-1 min-w-0"
                          onClick={() => {
                            setDropdownOpen(false)
                            switchAccount(account.email)
                          }}
                        >
                          <Avatar className="h-8 w-8 shrink-0 opacity-70">
                            <AvatarImage src={account.avatarUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-xs">
                              {getInitials(account.fullName ?? undefined, account.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-sm font-light truncate">{account.fullName || account.email}</p>
                            {account.fullName && (
                              <p className="text-[11px] text-muted truncate">{account.email}</p>
                            )}
                          </div>
                        </button>
                        <button
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all p-0.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeKnownAccount(account.id)
                            // Force re-render by toggling dropdown
                            setDropdownOpen(false)
                            requestAnimationFrame(() => setDropdownOpen(true))
                          }}
                          title={t('auth.removeAccount')}
                        >
                          <Icon name="close" size="sm" />
                        </button>
                      </div>
                    ))}
                    <div className="h-px bg-border my-1" />
                  </>
                )}

                {/* Add another account */}
                <button
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-light',
                    'hover:bg-surface-hover transition-colors'
                  )}
                  onClick={() => {
                    setDropdownOpen(false)
                    addAccount()
                  }}
                >
                  <Icon name="person_add" size="md" className="text-muted" />
                  {t('auth.addAnotherAccount')}
                </button>

                <div className="h-px bg-border my-1" />

                {/* Profile */}
                <button
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-light',
                    'hover:bg-surface-hover transition-colors'
                  )}
                  onClick={() => {
                    navigate('/profile')
                    setDropdownOpen(false)
                  }}
                >
                  <Icon name="person" size="md" className="text-muted" />
                  {t('nav.profile')}
                </button>

                <div className="h-px bg-border my-1" />

                {/* Logout */}
                <button
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-light text-error',
                    'hover:bg-error/10 transition-colors'
                  )}
                  onClick={handleSignOut}
                >
                  <Icon name="logout" size="md" />
                  {t('auth.logout')}
                </button>
              </div>
            )
          })()}
        </div>
      </div>
    </header>
  )
}
