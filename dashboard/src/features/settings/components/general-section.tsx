import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Check, Loader2, Save } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Section } from '@/shared/components/ui/section'
import { useTheme, useFilters, useToast, type Currency, CURRENCY_CONFIG } from '@/app/providers'
import { api } from '@/shared/lib/api'

const SUPPORTED_CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP']

export function GeneralSection() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { getCurrentTenant, getCurrentCurrency } = useFilters()
  const toast = useToast()
  const queryClient = useQueryClient()

  const currentTenant = getCurrentTenant()
  const currentCurrency = getCurrentCurrency()
  const isAdmin = currentTenant?.role === 'admin'

  const updateCurrencyMutation = useMutation({
    mutationFn: async (currency: Currency) => {
      if (!currentTenant) throw new Error('No tenant selected')
      return api.patch<{ success: boolean }>(
        `/api/tenants/${currentTenant.tenant_id}/settings`,
        { currency }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
      toast.success(t('settings.currencyUpdated'))
    },
    onError: () => {
      toast.error(t('settings.currencyUpdateError'))
    },
  })

const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    if (newTheme !== theme) {
      setTheme(newTheme)
      toast.success(t('settings.themeUpdated'))
    }
  }

  const handleCurrencyChange = (currency: Currency) => {
    if (currency !== currentCurrency) {
      updateCurrencyMutation.mutate(currency)
    }
  }

  // Organization name fields
  const { data: settingsData } = useQuery({
    queryKey: ['tenant', 'settings', currentTenant?.tenant_id],
    queryFn: async () => {
      if (!currentTenant) return null
      const res = await api.get<{ success: boolean; data: { tenant: { name: string; company_name: string | null } } }>(
        `/api/tenants/${currentTenant.tenant_id}/settings`
      )
      return res.data.tenant
    },
    enabled: !!currentTenant && isAdmin,
  })

  const [orgName, setOrgName] = React.useState('')
  const [companyName, setCompanyName] = React.useState('')

  React.useEffect(() => {
    if (settingsData) {
      setOrgName(settingsData.name ?? '')
      setCompanyName(settingsData.company_name ?? '')
    }
  }, [settingsData])

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant) throw new Error('No tenant selected')
      return api.patch<{ success: boolean }>(
        `/api/tenants/${currentTenant.tenant_id}/settings`,
        { name: orgName, company_name: companyName }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'tenants'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', 'settings'] })
      toast.success(t('settings.orgUpdated', 'Organization updated successfully'))
    },
    onError: () => {
      toast.error(t('settings.orgUpdateError', 'Failed to update organization'))
    },
  })

  return (
    <div className="space-y-8">
      {/* Organization - Only for admins */}
      {isAdmin && currentTenant && (
        <Section title={t('settings.organization', 'Organization')} description={t('settings.organizationDesc', 'Manage your organization name and company details')}>
          <Card>
            <CardContent className="py-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {t('settings.orgName', 'Organization name')}
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder={t('settings.orgNamePlaceholder', 'My Organization')}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <p className="text-xs text-muted">{t('settings.orgNameHint', 'Used as your workspace name')}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {t('settings.companyName', 'Company name')}
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder={t('settings.companyNamePlaceholder', 'Acme Corp')}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <p className="text-xs text-muted">{t('settings.companyNameHint', 'Legal company name for billing and reports')}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => updateOrgMutation.mutate()}
                  disabled={updateOrgMutation.isPending}
                >
                  {updateOrgMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {t('settings.saveChanges', 'Save changes')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Appearance */}
      <Section title={t('settings.appearance')} description={t('settings.appearanceDesc')}>
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{t('settings.theme')}</p>
                <p className="text-sm text-muted">{t('settings.selectTheme')}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange('light')}
                  className="flex-1 sm:flex-none"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  {t('settings.light')}
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange('dark')}
                  className="flex-1 sm:flex-none"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  {t('settings.dark')}
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange('system')}
                  className="flex-1 sm:flex-none"
                >
                  {t('settings.system')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Currency - Only visible to tenant admins */}
      {isAdmin && currentTenant && (
        <Section title={t('settings.currency')} description={t('settings.currencyDesc')}>
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{t('settings.selectCurrency')}</p>
                  <p className="text-sm text-muted">
                    {t(`settings.currencies.${currentCurrency}`)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {SUPPORTED_CURRENCIES.map((currency) => {
                    const isSelected = currentCurrency === currency
                    const isLoading =
                      updateCurrencyMutation.isPending &&
                      updateCurrencyMutation.variables === currency
                    return (
                      <Button
                        key={currency}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleCurrencyChange(currency)}
                        disabled={updateCurrencyMutation.isPending}
                        className="flex-1 sm:flex-none"
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isSelected ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : null}
                        {CURRENCY_CONFIG[currency].symbol} {currency}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>
      )}
    </div>
  )
}
