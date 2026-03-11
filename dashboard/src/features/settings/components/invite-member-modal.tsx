import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { useInviteMember } from '@/features/team'

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const { t } = useTranslation()
  const inviteMember = useInviteMember()

  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<'admin' | 'member'>('member')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setEmail('')
      setRole('member')
      setError(null)
      setSuccess(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email.trim()) {
      setError(t('team.emailRequired'))
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError(t('team.invalidEmail'))
      return
    }

    try {
      await inviteMember.mutateAsync({ email: email.trim(), role })
      setSuccess(true)
      // Auto-close after success
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('team.inviteFailed')
      setError(message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-surface-elevated border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t('team.inviteTitle')}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <Icon name="close" size="md" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success ? (
            <div className="flex flex-col items-center py-4">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <Icon name="check_circle" size="xl" className="text-success" />
              </div>
              <p className="text-center text-foreground font-medium">
                {t('team.inviteSuccess')}
              </p>
              <p className="text-center text-muted text-sm mt-1">
                {t('team.inviteSuccessDesc', { email })}
              </p>
            </div>
          ) : (
            <>
              {/* Description */}
              <p className="text-sm text-muted">
                {t('team.inviteDesc')}
              </p>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium leading-tight text-foreground">
                  {t('team.email')} *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('team.emailPlaceholder')}
                  className="w-full h-10 px-3.5 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  autoFocus
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium leading-tight text-foreground">
                  {t('team.role')}
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('member')}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors',
                      role === 'member'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                        : 'border-border bg-surface text-muted hover:text-foreground hover:bg-surface-hover'
                    )}
                  >
                    <Icon name="person" size="md" />
                    <div className="text-left">
                      <div className="font-medium text-sm">{t('team.roleMember')}</div>
                      <div className="text-xs opacity-70">{t('team.roleMemberDesc')}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors',
                      role === 'admin'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                        : 'border-border bg-surface text-muted hover:text-foreground hover:bg-surface-hover'
                    )}
                  >
                    <Icon name="shield_person" size="md" />
                    <div className="text-left">
                      <div className="font-medium text-sm">{t('team.roleAdmin')}</div>
                      <div className="text-xs opacity-70">{t('team.roleAdminDesc')}</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                  <Icon name="error" size="sm" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={inviteMember.isPending}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={inviteMember.isPending || !email.trim()}
                >
                  {inviteMember.isPending ? (
                    <>
                      <Icon name="sync" size="md" className="animate-spin mr-2" />
                      {t('team.sending')}
                    </>
                  ) : (
                    <>
                      <Icon name="send" size="md" className="mr-2" />
                      {t('team.sendInvite')}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
