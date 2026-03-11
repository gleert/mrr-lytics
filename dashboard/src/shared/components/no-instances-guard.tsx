import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Icon } from './ui/icon'
import { useFilters } from '@/app/providers'
import { InstanceFormModal } from '@/features/settings/components/instance-form-modal'
import { useCreateInstance } from '@/features/settings/hooks/use-instances'
import { useToast } from './ui/toast'

interface NoInstancesGuardProps {
  children: React.ReactNode
}

/**
 * Wraps analytics pages. If the user has no WHMCS instances configured,
 * shows a full-page CTA to set up the first instance instead of the page content.
 * Clicking the button opens the InstanceFormModal directly (no navigation).
 */
export function NoInstancesGuard({ children }: NoInstancesGuardProps) {
  const { allInstances, isLoadingTenants } = useFilters()
  const { t } = useTranslation()
  const { success, error: showError, warning } = useToast()
  const [modalOpen, setModalOpen] = React.useState(false)
  const createInstance = useCreateInstance()

  const showsEmpty = !isLoadingTenants && allInstances.length === 0
  const toastShownRef = React.useRef(false)

  React.useEffect(() => {
    if (showsEmpty && !toastShownRef.current) {
      toastShownRef.current = true
      warning(t('empty.noInstancesToast'))
    }
  }, [showsEmpty, warning, t])

  // Still loading - don't flash the empty state
  if (isLoadingTenants) {
    return <>{children}</>
  }

  // Has instances - render the page normally
  if (allInstances.length > 0) {
    return <>{children}</>
  }

  const handleSubmit = (data: Parameters<typeof createInstance.mutate>[0]) => {
    createInstance.mutate(data, {
      onSuccess: () => {
        setModalOpen(false)
        success(t('instances.instanceCreated'))
      },
      onError: () => {
        showError(t('instances.instanceSaveError'))
      },
    })
  }

  // No instances - show setup CTA
  return (
    <>
      <div className="flex flex-1 items-center justify-center py-16">
        <Card className="max-w-lg w-full border-dashed">
          <CardContent className="flex flex-col items-center py-12 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/10 mb-6">
              <Icon name="dns" size="2xl" className="text-primary-500" />
            </div>

            <h2 className="text-xl font-semibold text-foreground">
              {t('empty.noInstancesTitle')}
            </h2>
            <p className="mt-2 text-sm text-muted max-w-sm">
              {t('empty.noInstancesDescription')}
            </p>

            <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
              <Button
                className="w-full gap-2"
                onClick={() => setModalOpen(true)}
              >
                <Icon name="add" size="sm" />
                {t('empty.addFirstInstance')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('empty.noInstancesHint')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <InstanceFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        isLoading={createInstance.isPending}
      />
    </>
  )
}
