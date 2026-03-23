import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './ui/icon'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30">
        <Icon name="error" size="2xl" className="text-red-600 dark:text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        {t('errorBoundary.title', 'Something went wrong')}
      </h2>
      <p className="text-muted text-center max-w-md">
        {t('errorBoundary.description', 'An unexpected error occurred. Please try again.')}
      </p>
      {error && (
        <details className="text-sm text-muted max-w-md">
          <summary className="cursor-pointer hover:text-foreground">
            {t('errorBoundary.details', 'Error details')}
          </summary>
          <pre className="mt-2 p-3 bg-surface rounded-lg overflow-auto text-xs">
            {error.message}
          </pre>
        </details>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>
          {t('common.retry')}
        </Button>
        <Button onClick={() => window.location.reload()}>
          {t('errorBoundary.reload', 'Reload page')}
        </Button>
      </div>
    </div>
  )
}
