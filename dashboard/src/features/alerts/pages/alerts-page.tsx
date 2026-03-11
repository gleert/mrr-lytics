import { useTranslation } from 'react-i18next'
import { Bell, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'

export function AlertsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('alerts.title')}</h1>
          <p className="text-muted">View and manage your notifications</p>
        </div>
        <Button variant="outline" className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {t('alerts.markAllAsRead')}
        </Button>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600/10">
            <Bell className="h-8 w-8 text-primary-500" />
          </div>
          <h3 className="mt-4 text-lg font-medium">{t('alerts.noAlerts')}</h3>
          <p className="mt-2 max-w-md text-center text-sm text-muted">
            You're all caught up! When there are important updates about your
            metrics, sync status, or account, they'll appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
