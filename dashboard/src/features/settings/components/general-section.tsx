import { useTranslation } from 'react-i18next'
import { Moon, Sun, Check, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Section } from '@/shared/components/ui/section'
import { useTheme, useFilters, useToast, type Currency, CURRENCY_CONFIG } from '@/app/providers'
import { changeLanguage, getCurrentLanguage } from '@/shared/lib/i18n'
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/shared/lib/locales'
import { api } from '@/shared/lib/api'

const SUPPORTED_CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP']

export function GeneralSection() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { getCurrentTenant, getCurrentCurrency } = useFilters()
  const toast = useToast()
  const currentLanguage = getCurrentLanguage()
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

  const handleLanguageChange = (lang: SupportedLanguage) => {
    if (lang !== currentLanguage) {
      changeLanguage(lang)
      toast.success(t('settings.languageUpdated'))
    }
  }

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

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <Section title={t('settings.appearance')} description={t('settings.appearanceDesc')}>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('settings.theme')}</p>
                <p className="text-sm text-muted">{t('settings.selectTheme')}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange('light')}
                >
                  <Sun className="mr-2 h-4 w-4" />
                  {t('settings.light')}
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange('dark')}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  {t('settings.dark')}
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange('system')}
                >
                  {t('settings.system')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Language */}
      <Section title={t('settings.language')} description={t('settings.languageDesc')}>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('settings.displayLanguage')}</p>
                <p className="text-sm text-muted">
                  {t('languages.' + currentLanguage)}
                </p>
              </div>
              <div className="flex gap-2">
                {supportedLanguages.map((lang) => (
                  <Button
                    key={lang}
                    variant={i18n.language === lang ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLanguageChange(lang)}
                  >
                    {i18n.language === lang && <Check className="mr-2 h-4 w-4" />}
                    {languageNames[lang]}
                  </Button>
                ))}
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
              <div className="flex items-center justify-between">
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
