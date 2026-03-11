import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { Button } from '@/shared/components/ui/button'
import { Section } from '@/shared/components/ui/section'
import { useToast } from '@/app/providers'
import { useFilters } from '@/app/providers'
import { connectorLogos, WebhookLogo, SlackLogo, GmailLogo } from '../components/connector-logos'
import { WebhookFormModal } from '../components/webhook-form-modal'
import { WebhookCard } from '../components/webhook-card'
import { DeleteWebhookModal } from '../components/delete-webhook-modal'
import { WebhookEventsModal } from '../components/webhook-events-modal'
import { EmailFormModal } from '../components/email-form-modal'
import { EmailCard } from '../components/email-card'
import { SlackFormModal } from '../components/slack-form-modal'
import { SlackCard } from '../components/slack-card'
import {
  useConnectors,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
  useTestConnector,
  useEmailConnectors,
  useCreateEmailConnector,
  useUpdateEmailConnector,
  useDeleteEmailConnector,
  useTestEmailConnector,
  useSlackConnectors,
  useCreateSlackConnector,
  useUpdateSlackConnector,
  useDeleteSlackConnector,
  useTestSlackConnector,
  type Connector,
  type EmailConnector,
  type SlackConnector,
  type CreateConnectorData,
  type UpdateConnectorData,
  type CreateEmailConnectorData,
  type UpdateEmailConnectorData,
  type CreateSlackConnectorData,
  type UpdateSlackConnectorData,
} from '../hooks/use-connectors'

interface FutureConnector {
  id: string
  name: string
  description: string
  category: 'communication' | 'erp' | 'automation' | 'crm'
}

const futureConnectors: FutureConnector[] = [
  // Communication — Email and Slack moved to live sections
  {
    id: 'discord',
    name: 'Discord',
    description: 'connectors.discordDescription',
    category: 'communication',
  },
  // ERP
  {
    id: 'sap',
    name: 'SAP',
    description: 'connectors.sapDescription',
    category: 'erp',
  },
  {
    id: 'odoo',
    name: 'Odoo',
    description: 'connectors.odooDescription',
    category: 'erp',
  },
  {
    id: 'holded',
    name: 'Holded',
    description: 'connectors.holdedDescription',
    category: 'erp',
  },
  // Automation
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'connectors.zapierDescription',
    category: 'automation',
  },
  // CRM
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'connectors.hubspotDescription',
    category: 'crm',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'connectors.salesforceDescription',
    category: 'crm',
  },
]

export function ConnectorsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { getCurrentTenant } = useFilters()
  const tenant = getCurrentTenant()
  const tenantId = tenant?.tenant_id

  // ─── Webhooks ───────────────────────────────────────────────────────────────
  const { data, isLoading: isLoadingConnectors } = useConnectors()
  const createConnector = useCreateConnector()
  const updateConnector = useUpdateConnector()
  const deleteConnector = useDeleteConnector()
  const testConnector = useTestConnector()

  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [isEventsOpen, setIsEventsOpen] = React.useState(false)
  const [selectedConnector, setSelectedConnector] = React.useState<Connector | null>(null)
  const [newSecret, setNewSecret] = React.useState<string | null>(null)
  const [testingId, setTestingId] = React.useState<string | null>(null)

  const webhooks = data?.connectors?.filter(c => c.type === 'webhook') || []
  const limit = data?.limit
  const canAddWebhook = limit?.can_create ?? true

  // ─── Slack Connectors ───────────────────────────────────────────────────────
  const { data: slackConnectors = [], isLoading: isLoadingSlack } = useSlackConnectors()
  const createSlack = useCreateSlackConnector()
  const updateSlack = useUpdateSlackConnector()
  const deleteSlack = useDeleteSlackConnector()
  const testSlack = useTestSlackConnector()

  const [isSlackFormOpen, setIsSlackFormOpen] = React.useState(false)
  const [isSlackDeleteOpen, setIsSlackDeleteOpen] = React.useState(false)
  const [selectedSlack, setSelectedSlack] = React.useState<SlackConnector | null>(null)
  const [testingSlackId, setTestingSlackId] = React.useState<string | null>(null)

  // ─── Email Connectors ───────────────────────────────────────────────────────
  const { data: emailConnectors = [], isLoading: isLoadingEmails } = useEmailConnectors()
  const createEmail = useCreateEmailConnector()
  const updateEmail = useUpdateEmailConnector()
  const deleteEmail = useDeleteEmailConnector()
  const testEmail = useTestEmailConnector()

  const [isEmailFormOpen, setIsEmailFormOpen] = React.useState(false)
  const [isEmailDeleteOpen, setIsEmailDeleteOpen] = React.useState(false)
  const [selectedEmail, setSelectedEmail] = React.useState<EmailConnector | null>(null)
  const [testingEmailId, setTestingEmailId] = React.useState<string | null>(null)

  // ─── Webhook handlers ───────────────────────────────────────────────────────

  const handleAddWebhook = () => {
    setSelectedConnector(null)
    setNewSecret(null)
    setIsFormOpen(true)
  }

  const handleEditWebhook = (connector: Connector) => {
    setSelectedConnector(connector)
    setNewSecret(null)
    setIsFormOpen(true)
  }

  const handleDeleteWebhook = (connector: Connector) => {
    setSelectedConnector(connector)
    setIsDeleteOpen(true)
  }

  const handleViewEvents = (connector: Connector) => {
    setSelectedConnector(connector)
    setIsEventsOpen(true)
  }

  const handleTestWebhook = async (connector: Connector) => {
    setTestingId(connector.id)
    try {
      const result = await testConnector.mutateAsync(connector.id)
      if (result.status === 'sent') {
        toast.success(t('connectors.testSent'))
      } else {
        toast.warning(result.message || t('connectors.testQueued'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.testFailed'))
    } finally {
      setTestingId(null)
    }
  }

  const handleWebhookFormSubmit = async (formData: CreateConnectorData | UpdateConnectorData) => {
    try {
      if (selectedConnector) {
        await updateConnector.mutateAsync({
          connectorId: selectedConnector.id,
          data: formData as UpdateConnectorData,
        })
        toast.success(t('connectors.webhookUpdated'))
        setIsFormOpen(false)
      } else {
        const created = await createConnector.mutateAsync(formData as CreateConnectorData)
        toast.success(t('connectors.webhookCreated'))
        if (created.config.secret) {
          setNewSecret(created.config.secret)
        } else {
          setIsFormOpen(false)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.webhookSaveError'))
    }
  }

  const handleWebhookDeleteConfirm = async () => {
    if (!selectedConnector) return
    try {
      await deleteConnector.mutateAsync(selectedConnector.id)
      toast.success(t('connectors.webhookDeleted'))
      setIsDeleteOpen(false)
      setSelectedConnector(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.webhookDeleteError'))
    }
  }

  // ─── Email handlers ─────────────────────────────────────────────────────────

  const handleAddEmail = () => {
    setSelectedEmail(null)
    setIsEmailFormOpen(true)
  }

  const handleEditEmail = (connector: EmailConnector) => {
    setSelectedEmail(connector)
    setIsEmailFormOpen(true)
  }

  const handleDeleteEmailClick = (connector: EmailConnector) => {
    setSelectedEmail(connector)
    setIsEmailDeleteOpen(true)
  }

  const handleTestEmail = async (connector: EmailConnector) => {
    if (!tenantId) return
    setTestingEmailId(connector.id)
    try {
      await testEmail.mutateAsync({ tenantId, connectorId: connector.id })
      toast.success(t('connectors.testEmailSent'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.testEmailFailed'))
    } finally {
      setTestingEmailId(null)
    }
  }

  const handleEmailFormSubmit = async (
    formData: CreateEmailConnectorData | UpdateEmailConnectorData
  ) => {
    try {
      if (selectedEmail) {
        await updateEmail.mutateAsync({
          connectorId: selectedEmail.id,
          data: formData as UpdateEmailConnectorData,
        })
        toast.success(t('connectors.emailUpdated'))
        setIsEmailFormOpen(false)
      } else {
        await createEmail.mutateAsync(formData as CreateEmailConnectorData)
        toast.success(t('connectors.emailCreated'))
        setIsEmailFormOpen(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.emailSaveError'))
    }
  }

  const handleEmailDeleteConfirm = async () => {
    if (!selectedEmail) return
    try {
      await deleteEmail.mutateAsync(selectedEmail.id)
      toast.success(t('connectors.emailDeleted'))
      setIsEmailDeleteOpen(false)
      setSelectedEmail(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.emailDeleteError'))
    }
  }

  // ─── Slack handlers ─────────────────────────────────────────────────────────

  const handleAddSlack = () => {
    setSelectedSlack(null)
    setIsSlackFormOpen(true)
  }

  const handleEditSlack = (connector: SlackConnector) => {
    setSelectedSlack(connector)
    setIsSlackFormOpen(true)
  }

  const handleDeleteSlackClick = (connector: SlackConnector) => {
    setSelectedSlack(connector)
    setIsSlackDeleteOpen(true)
  }

  const handleTestSlack = async (connector: SlackConnector) => {
    if (!tenantId) return
    setTestingSlackId(connector.id)
    try {
      await testSlack.mutateAsync({ tenantId, connectorId: connector.id })
      toast.success(t('connectors.testSlackSent'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.testSlackFailed'))
    } finally {
      setTestingSlackId(null)
    }
  }

  const handleSlackFormSubmit = async (
    formData: CreateSlackConnectorData | UpdateSlackConnectorData
  ) => {
    try {
      if (selectedSlack) {
        await updateSlack.mutateAsync({
          connectorId: selectedSlack.id,
          data: formData as UpdateSlackConnectorData,
        })
        toast.success(t('connectors.slackUpdated'))
        setIsSlackFormOpen(false)
      } else {
        await createSlack.mutateAsync(formData as CreateSlackConnectorData)
        toast.success(t('connectors.slackCreated'))
        setIsSlackFormOpen(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.slackSaveError'))
    }
  }

  const handleSlackDeleteConfirm = async () => {
    if (!selectedSlack) return
    try {
      await deleteSlack.mutateAsync(selectedSlack.id)
      toast.success(t('connectors.slackDeleted'))
      setIsSlackDeleteOpen(false)
      setSelectedSlack(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('connectors.slackDeleteError'))
    }
  }

  // ─── Future connector card ───────────────────────────────────────────────────

  const renderFutureConnectorCard = (connector: FutureConnector) => {
    const LogoComponent = connectorLogos[connector.id]

    return (
      <Card key={connector.id} glow={false} className="relative overflow-hidden connector-dimmed">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-hover">
                {LogoComponent ? (
                  <LogoComponent className="h-7 w-7" />
                ) : (
                  <Icon name="extension" size="xl" className="text-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{connector.name}</h3>
                <p className="mt-1 text-sm text-muted">{t(connector.description)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted">
              {t('connectors.comingSoon')}
            </span>
            <Button variant="ghost" size="sm" disabled>
              {t('connectors.comingSoon')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const erpConnectors = futureConnectors.filter(c => c.category === 'erp')
  const automationConnectors = futureConnectors.filter(c => c.category === 'automation')
  const crmConnectors = futureConnectors.filter(c => c.category === 'crm')
  const discordConnectors = futureConnectors.filter(c => c.category === 'communication')

  const isLoadingComms = isLoadingConnectors || isLoadingSlack || isLoadingEmails

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('connectors.title')}</h1>
        <p className="mt-2 text-muted">{t('connectors.subtitle')}</p>
      </div>

      {/* Communication — live connectors + coming soon, all in one grid */}
      <Section
        title={t('connectors.communication')}
        description={t('connectors.communicationDescription')}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoadingComms ? (
            <Card className="opacity-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-surface-hover animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-surface-hover animate-pulse" />
                    <div className="h-3 w-48 rounded bg-surface-hover animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Webhooks */}
              {webhooks.map(webhook => (
                <WebhookCard
                  key={webhook.id}
                  connector={webhook}
                  onEdit={() => handleEditWebhook(webhook)}
                  onTest={() => handleTestWebhook(webhook)}
                  onDelete={() => handleDeleteWebhook(webhook)}
                  onViewEvents={() => handleViewEvents(webhook)}
                  isTestLoading={testingId === webhook.id}
                />
              ))}

              {/* Slack */}
              {slackConnectors.map(connector => (
                <SlackCard
                  key={connector.id}
                  connector={connector}
                  onEdit={() => handleEditSlack(connector)}
                  onTest={() => handleTestSlack(connector)}
                  onDelete={() => handleDeleteSlackClick(connector)}
                  isTestLoading={testingSlackId === connector.id}
                />
              ))}

              {/* Email */}
              {emailConnectors.map(connector => (
                <EmailCard
                  key={connector.id}
                  connector={connector}
                  onEdit={() => handleEditEmail(connector)}
                  onTest={() => handleTestEmail(connector)}
                  onDelete={() => handleDeleteEmailClick(connector)}
                  isTestLoading={testingEmailId === connector.id}
                />
              ))}

              {/* Add Webhook */}
              {canAddWebhook && (
                <Card className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-hover">
                          <WebhookLogo className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Webhook</h3>
                          <p className="mt-1 text-sm text-muted">{t('connectors.addWebhookHint')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted">
                        {t('connectors.notConnected')}
                      </span>
                      <Button variant="ghost" size="sm" onClick={handleAddWebhook}>
                        {t('connectors.connect')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Add Slack */}
              <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-hover">
                        <SlackLogo className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Slack</h3>
                        <p className="mt-1 text-sm text-muted">{t('connectors.addSlackHint')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted">
                      {t('connectors.notConnected')}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleAddSlack}>
                      {t('connectors.connect')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Add Email */}
              <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface-hover">
                        <GmailLogo className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Email</h3>
                        <p className="mt-1 text-sm text-muted">{t('connectors.addEmailHint')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted">
                      {t('connectors.notConnected')}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleAddEmail}>
                      {t('connectors.connect')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Coming soon: Discord */}
              {discordConnectors.map(renderFutureConnectorCard)}
            </>
          )}
        </div>
        {!canAddWebhook && (
          <p className="mt-2 text-sm text-warning">{t('connectors.limitReached')}</p>
        )}
      </Section>

      {/* ERP */}
      <Section
        title={t('connectors.erp')}
        description={t('connectors.erpDescription')}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {erpConnectors.map(renderFutureConnectorCard)}
        </div>
      </Section>

      {/* Automation */}
      <Section
        title={t('connectors.automation')}
        description={t('connectors.automationDescription')}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {automationConnectors.map(renderFutureConnectorCard)}
        </div>
      </Section>

      {/* CRM */}
      <Section
        title={t('connectors.crm')}
        description={t('connectors.crmDescription')}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {crmConnectors.map(renderFutureConnectorCard)}
        </div>
      </Section>

      {/* ─── Webhook Modals ─────────────────────────────────────────────────── */}
      <WebhookFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setNewSecret(null)
        }}
        onSubmit={handleWebhookFormSubmit}
        connector={selectedConnector}
        isLoading={createConnector.isPending || updateConnector.isPending}
        newSecret={newSecret}
      />

      <DeleteWebhookModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false)
          setSelectedConnector(null)
        }}
        onConfirm={handleWebhookDeleteConfirm}
        connector={selectedConnector}
        isLoading={deleteConnector.isPending}
      />

      <WebhookEventsModal
        isOpen={isEventsOpen}
        onClose={() => {
          setIsEventsOpen(false)
          setSelectedConnector(null)
        }}
        connector={selectedConnector}
      />

      {/* ─── Slack Modals ───────────────────────────────────────────────────── */}
      <SlackFormModal
        isOpen={isSlackFormOpen}
        onClose={() => {
          setIsSlackFormOpen(false)
          setSelectedSlack(null)
        }}
        onSubmit={handleSlackFormSubmit}
        connector={selectedSlack}
        isLoading={createSlack.isPending || updateSlack.isPending}
      />

      {isSlackDeleteOpen && selectedSlack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsSlackDeleteOpen(false)
              setSelectedSlack(null)
            }}
          />
          <div className="relative w-full max-w-md bg-surface-elevated border border-border rounded-xl shadow-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger/10">
                <Icon name="delete" className="text-danger" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{t('connectors.deleteSlack')}</h3>
                <p className="mt-1 text-sm text-muted">
                  {t('connectors.deleteSlackConfirm', { name: selectedSlack.name })}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t('connectors.deleteSlackWarning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsSlackDeleteOpen(false)
                  setSelectedSlack(null)
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleSlackDeleteConfirm}
                disabled={deleteSlack.isPending}
              >
                {deleteSlack.isPending ? (
                  <>
                    <Icon name="sync" size="sm" className="animate-spin mr-2" />
                    {t('common.deleting')}
                  </>
                ) : t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Email Modals ───────────────────────────────────────────────────── */}
      <EmailFormModal
        isOpen={isEmailFormOpen}
        onClose={() => {
          setIsEmailFormOpen(false)
          setSelectedEmail(null)
        }}
        onSubmit={handleEmailFormSubmit}
        connector={selectedEmail}
        isLoading={createEmail.isPending || updateEmail.isPending}
      />

      {/* Email delete confirmation */}
      {isEmailDeleteOpen && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsEmailDeleteOpen(false)
              setSelectedEmail(null)
            }}
          />
          <div className="relative w-full max-w-md bg-surface-elevated border border-border rounded-xl shadow-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-danger/10">
                <Icon name="delete" className="text-danger" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {t('connectors.deleteEmail')}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {t('connectors.deleteEmailConfirm', { name: selectedEmail.name })}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t('connectors.deleteEmailWarning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEmailDeleteOpen(false)
                  setSelectedEmail(null)
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleEmailDeleteConfirm}
                disabled={deleteEmail.isPending}
              >
                {deleteEmail.isPending ? (
                  <>
                    <Icon name="sync" size="sm" className="animate-spin mr-2" />
                    {t('common.deleting')}
                  </>
                ) : t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
