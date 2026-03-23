import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Section } from '@/shared/components/ui/section'
import { cn } from '@/shared/lib/utils'
import { 
  useTeam, 
  useUpdateMemberRole, 
  useRemoveMember,
  type TeamMember,
} from '@/features/team'
import { InviteMemberModal } from './invite-member-modal'
import { RemoveMemberModal } from './remove-member-modal'

export function TeamSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useTeam()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const [isInviteOpen, setIsInviteOpen] = React.useState(false)
  const [memberToRemove, setMemberToRemove] = React.useState<TeamMember | null>(null)
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null)

  const handleRoleChange = async (member: TeamMember, newRole: 'admin' | 'viewer') => {
    if (member.role === newRole) return
    
    setUpdatingMemberId(member.id)
    try {
      await updateRole.mutateAsync({ memberId: member.id, role: newRole })
    } catch (err) {
      console.error('Failed to update role:', err)
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return
    
    try {
      await removeMember.mutateAsync(memberToRemove.id)
      setMemberToRemove(null)
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  const isCurrentUserAdmin = data?.current_user_role === 'admin'
  const canInvite = data?.limits.can_invite && isCurrentUserAdmin

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Section 
      title={t('team.title')} 
      description={t('team.subtitle')}
      action={
        isCurrentUserAdmin && (
          <Button 
            onClick={() => setIsInviteOpen(true)} 
            size="sm"
            disabled={!canInvite}
          >
            <Icon name="person_add" size="md" className="mr-2" />
            {t('team.inviteMember')}
          </Button>
        )
      }
    >
      {/* Usage indicator */}
      {data?.limits && (
        <div className="flex items-center gap-2 text-sm text-muted mb-4">
          <Icon name="group" size="sm" />
          <span>
            {t('team.usage', { 
              current: data.limits.current, 
              max: data.limits.max === -1 ? '∞' : data.limits.max 
            })}
          </span>
          {!data.limits.can_invite && data.limits.max !== -1 && (
            <span className="text-warning">
              ({t('team.limitReached')})
            </span>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Icon name="sync" size="xl" className="animate-spin text-muted" />
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && (!data?.members || data.members.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center mb-3">
              <Icon name="group" size="xl" className="text-primary-500" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {t('team.noMembers')}
            </h3>
            <p className="text-muted text-center text-sm max-w-sm mb-3">
              {t('team.noMembersDesc')}
            </p>
            {isCurrentUserAdmin && (
              <Button onClick={() => setIsInviteOpen(true)} size="sm">
                <Icon name="person_add" size="md" className="mr-2" />
                {t('team.inviteFirst')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      {!isLoading && data?.members && data.members.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('team.member')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-32">
                      {t('team.role')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-32">
                      {t('team.joined')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-32">
                      {t('team.lastActive')}
                    </th>
                    {isCurrentUserAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-24">
                        {t('team.actions')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => {
                    const isCurrentUser = member.user_id === data.current_user_id
                    const isUpdating = updatingMemberId === member.id

                    return (
                      <tr 
                        key={member.id} 
                        className="border-b border-border hover:bg-surface-hover/50 transition-colors"
                      >
                        {/* Member info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-500/20 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-500">
                                {(member.full_name || member.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {member.full_name || member.email.split('@')[0]}
                                </span>
                                {isCurrentUser && (
                                  <span className="px-1.5 py-0.5 text-xs bg-primary-500/10 text-primary-500 rounded">
                                    {t('team.you')}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-muted">{member.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          {isCurrentUserAdmin && !isCurrentUser ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member, e.target.value as 'admin' | 'viewer')}
                              disabled={isUpdating}
                              className={cn(
                                'px-2 py-1 text-sm rounded border border-border bg-surface',
                                'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                                isUpdating && 'opacity-50 cursor-wait'
                              )}
                            >
                              <option value="admin">{t('team.roleAdmin')}</option>
                              <option value="viewer">{t('team.roleMember')}</option>
                            </select>
                          ) : (
                            <span className={cn(
                              'px-2 py-1 text-xs font-medium rounded',
                              member.role === 'admin' 
                                ? 'bg-primary-500/10 text-primary-500' 
                                : 'bg-muted/20 text-muted'
                            )}>
                              {member.role === 'admin' ? t('team.roleAdmin') : t('team.roleMember')}
                            </span>
                          )}
                        </td>

                        {/* Joined date */}
                        <td className="px-4 py-3 text-sm text-muted">
                          {formatDate(member.joined_at)}
                        </td>

                        {/* Last active */}
                        <td className="px-4 py-3 text-sm text-muted">
                          {formatDate(member.last_sign_in)}
                        </td>

                        {/* Actions */}
                        {isCurrentUserAdmin && (
                          <td className="px-4 py-3 text-right">
                            {!isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMemberToRemove(member)}
                                title={t('team.removeMember')}
                                className="h-9 w-9 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-all"
                              >
                                <Icon name="person_remove" size="md" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      {/* Remove Confirmation Modal */}
      <RemoveMemberModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveConfirm}
        member={memberToRemove}
        isLoading={removeMember.isPending}
      />
    </Section>
  )
}
