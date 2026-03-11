import { useTranslation } from 'react-i18next'
import { Plus, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'

export function TenantsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('tenants.title')}</h1>
          <p className="text-muted">Manage your organization tenants</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('tenants.createTenant')}
        </Button>
      </div>

      {/* Placeholder content */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600/10">
            <Building2 className="h-8 w-8 text-primary-500" />
          </div>
          <h3 className="mt-4 text-lg font-medium">Tenant Management</h3>
          <p className="mt-2 max-w-md text-center text-sm text-muted">
            This feature is coming soon. You'll be able to manage multiple tenants,
            configure WHMCS connections, and manage API keys here.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            MVP: Focus on single-tenant mode for now
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
