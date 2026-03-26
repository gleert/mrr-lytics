import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Section } from '@/shared/components/ui/section'
import { useToast } from '@/app/providers'
import { InstanceCard } from './instance-card'
import { InstanceFormModal } from './instance-form-modal'
import { DeleteInstanceModal } from './delete-instance-modal'
import { ImportDataModal } from './import-data-modal'
import { 
  useInstances, 
  useCreateInstance, 
  useUpdateInstance, 
  useDeleteInstance,
  useSyncInstance,
  type WhmcsInstanceFull,
  type CreateInstanceData,
  type UpdateInstanceData,
} from '../hooks/use-instances'

export function InstancesSection() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: instances, isLoading, error } = useInstances()
  const createInstance = useCreateInstance()
  const updateInstance = useUpdateInstance()
  const deleteInstance = useDeleteInstance()
  const syncInstance = useSyncInstance()

  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [selectedInstance, setSelectedInstance] = React.useState<WhmcsInstanceFull | null>(null)

  const handleAdd = () => {
    setSelectedInstance(null)
    setIsFormOpen(true)
  }

  const handleEdit = (instance: WhmcsInstanceFull) => {
    setSelectedInstance(instance)
    setIsFormOpen(true)
  }

  const handleDelete = (instance: WhmcsInstanceFull) => {
    setSelectedInstance(instance)
    setIsDeleteOpen(true)
  }

  const handleImport = (instance: WhmcsInstanceFull) => {
    setSelectedInstance(instance)
    setIsImportOpen(true)
  }

  const handleFormSubmit = async (data: CreateInstanceData | UpdateInstanceData) => {
    try {
      if (selectedInstance) {
        await updateInstance.mutateAsync({ 
          instanceId: selectedInstance.id, 
          data: data as UpdateInstanceData 
        })
        toast.success(t('instances.instanceUpdated'))
      } else {
        await createInstance.mutateAsync(data as CreateInstanceData)
        toast.success(t('instances.instanceCreated'))
      }
      setIsFormOpen(false)
      setSelectedInstance(null)
    } catch (err) {
      console.error('Failed to save instance:', err)
      toast.error(t('instances.instanceSaveError'))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedInstance) return
    try {
      await deleteInstance.mutateAsync(selectedInstance.id)
      setIsDeleteOpen(false)
      setSelectedInstance(null)
      toast.success(t('instances.instanceDeleted'))
    } catch (err) {
      console.error('Failed to delete instance:', err)
      toast.error(t('instances.instanceDeleteError'))
    }
  }

  const handleSync = async (instance: WhmcsInstanceFull): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await syncInstance.mutateAsync(instance.id)
      if (response.success) {
        toast.success(t('instances.syncStarted'))
        return { success: true }
      } else {
        toast.error(response.error?.message || t('instances.syncError'))
        return { success: false, error: response.error?.message || 'Sync failed' }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  return (
    <>
      <Section 
        title={t('instances.title')} 
        description={t('instances.subtitle')}
      >
        <div className="flex justify-end gap-2 mb-4">
          <Link to="/sync">
            <Button variant="outline" size="sm">
              <Icon name="sync" size="md" className="mr-2" />
              {t('instances.syncManagement', 'Sync management')}
            </Button>
          </Link>
          <Button onClick={handleAdd} size="sm">
            <Icon name="add" size="md" className="mr-2" />
            {t('instances.addInstance')}
          </Button>
        </div>
        
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <Icon name="sync" size="lg" className="animate-spin text-muted" />
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-danger">
                {t('common.error')}
              </div>
            </CardContent>
          </Card>
        ) : instances && instances.length > 0 ? (
          <div className="space-y-3">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSync={handleSync}
                onImport={handleImport}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/10 flex items-center justify-center">
                  <Icon name="dns" size="xl" className="text-muted" />
                </div>
                <p className="text-muted mb-4">{t('instances.noInstances')}</p>
                <Button onClick={handleAdd} variant="outline">
                  <Icon name="add" size="md" className="mr-2" />
                  {t('instances.addFirst')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* Form Modal */}
      <InstanceFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedInstance(null)
        }}
        onSubmit={handleFormSubmit}
        instance={selectedInstance}
        isLoading={createInstance.isPending || updateInstance.isPending}
      />

      {/* Delete Modal */}
      <DeleteInstanceModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false)
          setSelectedInstance(null)
        }}
        onConfirm={handleDeleteConfirm}
        instance={selectedInstance}
        isLoading={deleteInstance.isPending}
      />

      {/* Import Modal */}
      <ImportDataModal
        instance={selectedInstance}
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false)
          setSelectedInstance(null)
        }}
      />
    </>
  )
}
