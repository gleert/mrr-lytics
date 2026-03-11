import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'

interface PlaceholderPageProps {
  titleKey: string
  descriptionKey?: string
}

export function PlaceholderPage({ titleKey, descriptionKey }: PlaceholderPageProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t(titleKey)}</h1>
        {descriptionKey && <p className="text-muted">{t(descriptionKey)}</p>}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-primary-500/10 p-4 mb-4">
            <Icon name="construction" size="2xl" className="text-primary-500" />
          </div>
          <h2 className="text-xl font-medium mb-2">Coming Soon</h2>
          <p className="text-muted text-center max-w-md">
            This section is under development. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
