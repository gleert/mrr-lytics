import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Icon } from '@/shared/components/ui/icon'
import { Section } from '@/shared/components/ui/section'
import { useAuth, useToast, useFilters } from '@/app/providers'
import { supabase } from '@/shared/lib/supabase'
import { useTour } from '@/features/onboarding'
import { changeLanguage, getCurrentLanguage } from '@/shared/lib/i18n'
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/shared/lib/locales'

interface ProfileFormData {
  fullName: string
}

interface PasswordFormData {
  newPassword: string
  confirmPassword: string
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, updatePassword } = useAuth()
  const { tenants } = useFilters()
  const { restartAllTours } = useTour()
  const toast = useToast()
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const currentLanguage = getCurrentLanguage()

  const handleLanguageChange = (lang: SupportedLanguage) => {
    if (lang !== currentLanguage) {
      changeLanguage(lang)
      toast.success(t('settings.languageUpdated'))
    }
  }

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      fullName: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
    },
  })

  const passwordForm = useForm<PasswordFormData>({
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  const handleProfileSubmit = async (data: ProfileFormData) => {
    setIsUpdatingProfile(true)

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: data.fullName,
          name: data.fullName,
        },
      })

      if (error) throw error
      toast.success(t('profile.updateSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.updateError'))
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error(t('profile.passwordMismatch'))
      return
    }

    if (data.newPassword.length < 6) {
      toast.error(t('profile.passwordTooShort'))
      return
    }

    setIsUpdatingPassword(true)

    try {
      await updatePassword(data.newPassword)
      toast.success(t('profile.passwordUpdateSuccess'))
      passwordForm.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.passwordUpdateError'))
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  // Get user info
  const email = user?.email || ''
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const provider = user?.app_metadata?.provider || 'email'
  const createdAt = user?.created_at ? new Date(user.created_at) : null

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('profile.title')}</h1>
        <p className="text-muted">{t('profile.subtitle')}</p>
      </div>

      {/* Account Info */}
      <Section title={t('profile.accountInfo')} description={t('profile.accountInfoDesc')}>
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={t('profile.avatar')}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon name="person" size="2xl" className="text-primary" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <p className="text-sm text-muted">{t('profile.email')}</p>
                  <p className="font-medium">{email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">{t('profile.authProvider')}</p>
                  <div className="flex items-center gap-2">
                    <Icon 
                      name={provider === 'google' ? 'g_mobiledata' : 'mail'} 
                      size="sm" 
                      className="text-muted" 
                    />
                    <span className="font-medium capitalize">{provider}</span>
                  </div>
                </div>
                {createdAt && (
                  <div>
                    <p className="text-sm text-muted">{t('profile.memberSince')}</p>
                    <p className="font-medium">
                      {createdAt.toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Organization / Tenant Info */}
      {tenants.length > 0 && (
        <Section title={t('profile.organization')} description={t('profile.organizationDesc')}>
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.tenant_id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon name="apartment" size="lg" className="text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{tenant.tenant_name}</p>
                        {tenant.is_default && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        <span className="flex items-center gap-1">
                          <Icon name="badge" size="sm" />
                          {t('profile.role')}: <span className="capitalize font-medium text-foreground">{tenant.role}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="dns" size="sm" />
                          {tenant.instances.length} {tenant.instances.length === 1 ? 'instance' : 'instances'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="paid" size="sm" />
                          {tenant.currency}
                        </span>
                      </div>
                      {tenant.instances.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tenant.instances.map((inst) => (
                            <span
                              key={inst.instance_id}
                              className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-2 py-1 text-xs"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  inst.status === 'active' ? 'bg-success' : 'bg-warning'
                                }`}
                              />
                              {inst.instance_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
        </Section>
      )}

      {/* Edit Profile */}
      <Section title={t('profile.editProfile')} description={t('profile.editProfileDesc')}>
        <Card>
          <CardContent className="py-6">
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="block text-sm font-medium leading-tight">
                  {t('profile.fullName')}
                </label>
                <Input
                  id="fullName"
                  {...profileForm.register('fullName', { required: true })}
                  placeholder={t('profile.fullNamePlaceholder')}
                  className="max-w-md"
                />
              </div>

              <Button type="submit" disabled={isUpdatingProfile}>
                {isUpdatingProfile ? (
                  <>
                    <Icon name="sync" size="sm" className="mr-2 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  t('common.save')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Section>

      {/* Change Password - Only show for email auth */}
      {provider === 'email' && (
        <Section title={t('profile.changePassword')} description={t('profile.changePasswordDesc')}>
          <Card>
            <CardContent className="py-6">
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="newPassword" className="block text-sm font-medium leading-tight">
                    {t('profile.newPassword')}
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...passwordForm.register('newPassword', { required: true })}
                    placeholder={t('profile.newPasswordPlaceholder')}
                    className="max-w-md"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-sm font-medium leading-tight">
                    {t('profile.confirmPassword')}
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register('confirmPassword', { required: true })}
                    placeholder={t('profile.confirmPasswordPlaceholder')}
                    className="max-w-md"
                  />
                </div>

                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? (
                    <>
                      <Icon name="sync" size="sm" className="mr-2 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('profile.updatePassword')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Language */}
      <Section title={t('settings.language')} description={t('settings.languageDesc')}>
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{t('settings.selectLanguage')}</p>
                <p className="text-sm text-muted">{languageNames[currentLanguage]}</p>
              </div>
              <div className="flex gap-2">
                {supportedLanguages.map((lang) => (
                  <Button
                    key={lang}
                    variant={currentLanguage === lang ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLanguageChange(lang)}
                    className="flex-1 sm:flex-none"
                  >
                    {languageNames[lang]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Onboarding Tour */}
      <Section title={t('onboarding.restartTour')} description={t('onboarding.restartTourDesc')}>
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon name="tour" size="lg" className="text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t('onboarding.restartTour')}</p>
                  <p className="text-sm text-muted">{t('onboarding.restartTourDesc')}</p>
                </div>
              </div>
              <Button variant="outline" onClick={restartAllTours} className="w-full sm:w-auto">
                <Icon name="replay" size="sm" className="mr-2" />
                {t('onboarding.welcome.startTour')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Danger Zone */}
      <Section title={t('profile.dangerZone')} description={t('profile.dangerZoneDesc')}>
        <div className="flex flex-col gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-destructive">{t('profile.deleteAccount')}</p>
            <p className="text-sm text-muted">{t('profile.deleteAccountDesc')}</p>
          </div>
          <Button variant="destructive" disabled className="w-full sm:w-auto">
            {t('profile.deleteAccount')}
          </Button>
        </div>
      </Section>
    </div>
  )
}
