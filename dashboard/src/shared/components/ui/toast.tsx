import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { Icon } from './icon'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

const TOAST_DURATION = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = React.useCallback((message: string) => addToast(message, 'success'), [addToast])
  const error = React.useCallback((message: string) => addToast(message, 'error'), [addToast])
  const info = React.useCallback((message: string) => addToast(message, 'info'), [addToast])
  const warning = React.useCallback((message: string) => addToast(message, 'warning'), [addToast])

  const value = React.useMemo(
    () => ({ toasts, addToast, removeToast, success, error, info, warning }),
    [toasts, addToast, removeToast, success, error, info, warning]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Toast Container - renders all toasts
function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: Toast[]
  onRemove: (id: string) => void 
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// Individual Toast Item
function ToastItem({ 
  toast, 
  onRemove 
}: { 
  toast: Toast
  onRemove: (id: string) => void 
}) {
  const config: Record<ToastType, { icon: string; className: string }> = {
    success: {
      icon: 'check_circle',
      className: 'bg-success/10 border-success/30 text-success',
    },
    error: {
      icon: 'error',
      className: 'bg-destructive/10 border-destructive/30 text-destructive',
    },
    warning: {
      icon: 'warning',
      className: 'bg-warning/10 border-warning/30 text-warning',
    },
    info: {
      icon: 'info',
      className: 'bg-primary/10 border-primary/30 text-primary',
    },
  }

  const { icon, className } = config[toast.type]

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm',
        'animate-slide-in-right min-w-[280px] max-w-[400px]',
        'bg-surface/95',
        className
      )}
    >
      <Icon name={icon} size="lg" />
      <p className="flex-1 text-sm font-medium text-foreground">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-muted hover:text-foreground transition-colors"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  )
}
