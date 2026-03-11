import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { Icon } from '@/shared/components/ui/icon'
import { GeneralSection } from '../components/general-section'
import { InstancesSection } from '../components/instances-section'
import { CategoriesSection } from '../components/categories-section'
import { TeamSection } from '../components/team-section'
import { BillingSection } from '../components/billing-section'

type SettingsTab = 'general' | 'workspace' | 'team' | 'billing'

const STORAGE_KEY = 'mrrlytics-settings-tab'

const TABS: { id: SettingsTab; icon: string; labelKey: string }[] = [
  { id: 'general',   icon: 'tune',        labelKey: 'settings.tabGeneral'   },
  { id: 'workspace', icon: 'dns',         labelKey: 'settings.tabWorkspace' },
  { id: 'team',      icon: 'group',       labelKey: 'settings.tabTeam'      },
  { id: 'billing',   icon: 'credit_card', labelKey: 'settings.tabBilling'   },
]

export function SettingsPage() {
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = React.useState<SettingsTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && TABS.some((tab) => tab.id === stored)) {
      return stored as SettingsTab
    }
    return 'general'
  })

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    localStorage.setItem(STORAGE_KEY, tab)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('settings.title')}</h1>
        <p className="text-muted">{t('settings.subtitle')}</p>
      </div>

      {/* Tab bar - same style as Products page */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg border border-border w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'text-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <Icon name={tab.icon} size="sm" />
            {t(tab.labelKey)}
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
    </div>
  )
}
