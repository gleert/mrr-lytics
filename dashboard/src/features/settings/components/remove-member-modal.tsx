import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import type { TeamMember } from '@/features/team'

interface RemoveMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  member: TeamMember | null
  isLoading?: boolean
}

export function RemoveMemberModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  member,
  isLoading 
}: RemoveMemberModalProps) {
  const { t } = useTranslation()

  if (!isOpen || !member) return null

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
            {t('team.removeTitle')}
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
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
              <Icon name="person_remove" size="xl" className="text-danger" />
            </div>
            <div>
              <p className="text-foreground font-medium">
                {member.full_name || member.email.split('@')[0]}
              </p>
              <p className="text-sm text-muted">{member.email}</p>
            </div>
          </div>

          <p className="text-muted text-sm mb-4">
            {t('team.removeConfirm')}
          </p>

          <p className="text-sm text-warning flex items-center gap-2">
            <Icon name="warning" size="sm" />
            {t('team.removeWarning')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={onConfirm}
            disabled={isLoading}
            className="border-danger/30 text-danger hover:text-danger hover:bg-danger/10 hover:border-danger/50"
          >
            {isLoading ? (
              <>
                <Icon name="sync" size="md" className="animate-spin mr-2" />
                {t('team.removing')}
              </>
            ) : (
              <>
                <Icon name="person_remove" size="md" className="mr-2" />
                {t('team.removeMember')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
