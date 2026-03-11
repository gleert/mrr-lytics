import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import type { WhmcsInstanceFull } from '../hooks/use-instances'

interface ImportDataModalProps {
  instance: WhmcsInstanceFull | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface ImportResult {
  success: boolean
  message?: string
  records_synced?: Record<string, number>
  duration_ms?: number
  error?: string
}

export function ImportDataModal({ instance, isOpen, onClose, onSuccess }: ImportDataModalProps) {
  const { t } = useTranslation()
  const [file, setFile] = React.useState<File | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [importStatus, setImportStatus] = React.useState<string>('')
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFile(null)
    setResult(null)
    setImporting(false)
    setImportStatus('')
  }

  const handleClose = () => {
    if (!importing) {
      resetState()
      onClose()
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'application/json' || droppedFile.name.endsWith('.json')) {
        setFile(droppedFile)
        setResult(null)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file || !instance) return

    // Check file size (max 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setResult({
        success: false,
        error: t('instances.fileTooLarge', 'File is too large. Maximum size is 100MB.'),
      })
      return
    }

    setImporting(true)
    setResult(null)
    setImportStatus(t('instances.readingFile', 'Reading file...'))

    try {
      const fileContent = await file.text()
      setImportStatus(t('instances.uploadingData', 'Uploading data...'))

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setResult({ success: false, error: t('auth.sessionExpired', 'Session expired. Please log in again.') })
        return
      }

      // Use AbortController for timeout (5 minutes for large files)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

      // Use relative URL - Vite proxy will forward to backend
      const response = await fetch(`/api/import?instance_id=${instance.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: fileContent,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      setImportStatus(t('instances.processingData', 'Processing data...'))

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Server error: ${response.status}`
        
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorMessage
        } catch {
          if (errorText) errorMessage = errorText
        }
        
        setResult({ success: false, error: errorMessage })
        return
      }

      const data = await response.json()
      setResult(data)

      if (data.success && onSuccess) {
        onSuccess()
      }
    } catch (err) {
      let errorMessage = t('instances.importFailed', 'Import failed')
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = t('instances.importTimeout', 'Import timed out. The file may be too large.')
        } else {
          errorMessage = err.message
        }
      }
      
      setResult({ success: false, error: errorMessage })
    } finally {
      setImporting(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (!isOpen || !instance) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-elevated border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="upload_file" size="lg" className="text-primary-500" />
            <h2 className="text-lg font-semibold text-foreground">
              {t('instances.importData', 'Import Data')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
            disabled={importing}
          >
            <Icon name="close" size="md" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-muted mb-4">
            {t('instances.importDescription', 'Upload a JSON export file from your WHMCS MRRlytics addon to import data into')} <strong className="text-foreground">{instance?.name}</strong>
          </p>
          {/* Drop zone */}
          {!result?.success && (
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                file && 'border-success bg-success/5'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <Icon name="description" size="xl" className="text-success" />
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted">{formatBytes(file.size)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                    }}
                    className="mt-2"
                  >
                    {t('common.change', 'Change file')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Icon name="cloud_upload" size="xl" className="text-muted" />
                  <p className="font-medium text-foreground">
                    {t('instances.dropFile', 'Drop your JSON file here')}
                  </p>
                  <p className="text-sm text-muted">
                    {t('instances.orClickToSelect', 'or click to select a file')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={cn(
                'rounded-lg p-4 mt-4',
                result.success ? 'bg-success/10 border border-success/30' : 'bg-danger/10 border border-danger/30'
              )}
            >
              <div className="flex items-start gap-3">
                <Icon
                  name={result.success ? 'check_circle' : 'error'}
                  size="lg"
                  className={result.success ? 'text-success' : 'text-danger'}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', result.success ? 'text-success' : 'text-danger')}>
                    {result.success
                      ? t('instances.importSuccess', 'Import completed successfully!')
                      : t('instances.importFailed', 'Import failed')}
                  </p>

                  {result.error && (
                    <p className="text-sm text-danger mt-1">{result.error}</p>
                  )}

                  {result.success && result.records_synced && (
                    <div className="mt-3">
                      <p className="text-sm text-muted mb-2">
                        {t('instances.recordsImported', 'Records imported')}:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        {Object.entries(result.records_synced).map(([table, count]) => (
                          <div key={table} className="flex justify-between bg-background/50 rounded px-2 py-1">
                            <span className="text-muted capitalize">{table.replace('_', ' ')}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                      {result.duration_ms && (
                        <p className="text-xs text-muted mt-2">
                          {t('instances.importDuration', 'Duration')}: {formatDuration(result.duration_ms)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {result?.success ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
            </Button>
            {!result?.success && (
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing ? (
                  <>
                    <Icon name="sync" size="sm" className="mr-2 animate-spin" />
                    {importStatus || t('instances.importing', 'Importing...')}
                  </>
                ) : (
                  <>
                    <Icon name="upload" size="sm" className="mr-2" />
                    {t('instances.import', 'Import')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
