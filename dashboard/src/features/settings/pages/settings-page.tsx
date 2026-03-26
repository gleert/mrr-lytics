import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { Icon } from '@/shared/components/ui/icon'
import { GeneralSection } from '../components/general-section'
import { InstancesSection } from '../components/instances-section'
import { CategoriesSection } from '../components/categories-section'
import { TeamSection } from '../components/team-section'
import { BillingSection } from '../components/billing-section'
import { ChangelogSection } from '../components/changelog-section'

type SettingsTab = 'general' | 'workspace' | 'team' | 'billing' | 'changelog'

const STORAGE_KEY = 'mrrlytics-settings-tab'

const TABS: { id: SettingsTab; icon: string; labelKey: string }[] = [
  { id: 'general',   icon: 'tune',        labelKey: 'settings.tabGeneral'   },
  { id: 'workspace', icon: 'dns',         labelKey: 'settings.tabWorkspace' },
  { id: 'team',      icon: 'group',       labelKey: 'settings.tabTeam'      },
  { id: 'billing',   icon: 'credit_card', labelKey: 'settings.tabBilling'   },
  { id: 'changelog', icon: 'new_releases', labelKey: 'settings.tabChangelog' },
]

export function SettingsPage() {
  const { t } = useTranslation()

  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = React.useState<SettingsTab>(() => {
    // URL param takes priority, then localStorage
    const fromUrl = searchParams.get('tab')
    if (fromUrl && TABS.some((tab) => tab.id === fromUrl)) {
      return fromUrl as SettingsTab
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && TABS.some((tab) => tab.id === stored)) {
      return stored as SettingsTab
    }
    return 'general'
  })

  // React to URL param changes (e.g. from command palette)
  React.useEffect(() => {
    const fromUrl = searchParams.get('tab')
    if (fromUrl && TABS.some((tab) => tab.id === fromUrl) && fromUrl !== activeTab) {
      setActiveTab(fromUrl as SettingsTab)
      localStorage.setItem(STORAGE_KEY, fromUrl)
    }
  }, [searchParams])

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    localStorage.setItem(STORAGE_KEY, tab)
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted">{t('settings.subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg border border-border w-fit max-w-full">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            title={t(tab.labelKey)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'text-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <Icon name={tab.icon} size="sm" />
            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralSection />}

      {activeTab === 'workspace' && (
        <div className="space-y-8">
          <InstancesSection />
          <CategoriesSection />
        </div>
      )}

      {activeTab === 'team' && <TeamSection />}

      {activeTab === 'billing' && <BillingSection />}

      {activeTab === 'changelog' && <ChangelogSection />}
    </div>
  )
}
