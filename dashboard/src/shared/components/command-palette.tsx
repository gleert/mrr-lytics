import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from './ui/icon'
import { useTheme, useAuth, useFilters } from '@/app/providers'
import { cn } from '@/shared/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandItemKind = 'page' | 'action' | 'setting'

interface CommandItem {
  id: string
  kind: CommandItemKind
  icon: string
  labelKey: string
  keywords?: string[]
  to?: string
  onSelect?: () => void
  adminOnly?: boolean
  /** Filled at runtime from t() */
  _label?: string
}

// ---------------------------------------------------------------------------
// Static registry  (icons = Material Symbols names)
// ---------------------------------------------------------------------------

const buildRegistry = (extra: {
  toggleTheme: () => void
  signOut: () => void
}): CommandItem[] => [
  // ── Pages ──
  { id: 'page-dashboard',    kind: 'page', icon: 'dashboard',    labelKey: 'nav.dashboard',    to: '/',              keywords: ['home', 'inicio', 'panel', 'overview'] },
  { id: 'page-revenue',      kind: 'page', icon: 'paid',         labelKey: 'nav.revenue',      to: '/revenue',       keywords: ['mrr', 'arr', 'ingresos', 'money', 'income'] },
  { id: 'page-forecasting',  kind: 'page', icon: 'trending_up',  labelKey: 'nav.forecasting',  to: '/forecasting',   keywords: ['forecast', 'prediction', 'pronóstico', 'growth', 'projection'] },
  { id: 'page-clients',      kind: 'page', icon: 'group',        labelKey: 'nav.clients',      to: '/clients',       keywords: ['customers', 'clientes', 'users', 'churn'] },
  { id: 'page-products',     kind: 'page', icon: 'inventory_2',  labelKey: 'nav.products',     to: '/products',      keywords: ['services', 'servicios', 'productos', 'categories'] },
  { id: 'page-domains',      kind: 'page', icon: 'language',     labelKey: 'nav.domains',      to: '/domains',       keywords: ['dns', 'tld', 'dominios', 'expiring'] },
  { id: 'page-connectors',   kind: 'page', icon: 'cable',        labelKey: 'nav.connectors',   to: '/connectors',    keywords: ['webhooks', 'slack', 'email', 'integrations', 'conectores'], adminOnly: true },
  { id: 'page-reports',      kind: 'page', icon: 'description',  labelKey: 'nav.reports',      to: '/reports',       keywords: ['export', 'csv', 'excel', 'informes', 'download'] },
  { id: 'page-settings',     kind: 'page', icon: 'settings',     labelKey: 'nav.settings',     to: '/settings',      keywords: ['config', 'preferences', 'configuración', 'whmcs', 'instances'], adminOnly: true },
  { id: 'page-billing',      kind: 'page', icon: 'credit_card',  labelKey: 'nav.billing',      to: '/settings/billing', keywords: ['plan', 'subscription', 'facturación', 'upgrade'], adminOnly: true },
  { id: 'page-profile',      kind: 'page', icon: 'person',       labelKey: 'nav.profile',      to: '/profile',       keywords: ['account', 'perfil', 'user', 'password'] },

  // ── Subsections ──
  { id: 'sub-transactions',      kind: 'page', icon: 'receipt_long',     labelKey: 'commandPalette.sub.transactions',     to: '/revenue',       keywords: ['facturas', 'invoices', 'transacciones', 'paid', 'unpaid'] },
  { id: 'sub-pending-invoices',  kind: 'page', icon: 'pending',          labelKey: 'commandPalette.sub.pendingInvoices',  to: '/revenue',       keywords: ['pendientes', 'unpaid', 'impagadas', 'cobro'] },
  { id: 'sub-mrr-movement',     kind: 'page', icon: 'swap_vert',        labelKey: 'commandPalette.sub.mrrMovement',      to: '/',              keywords: ['movimiento', 'new mrr', 'expansion', 'contraction', 'churn mrr'] },
  { id: 'sub-churn',            kind: 'page', icon: 'person_remove',    labelKey: 'commandPalette.sub.churn',             to: '/clients',       keywords: ['churn', 'lost', 'perdidos', 'cancellations', 'bajas'] },
  { id: 'sub-top-clients',      kind: 'page', icon: 'star',             labelKey: 'commandPalette.sub.topClients',        to: '/clients',       keywords: ['mejores', 'top', 'revenue', 'ingresos'] },
  { id: 'sub-expiring-domains',  kind: 'page', icon: 'schedule',        labelKey: 'commandPalette.sub.expiringDomains',  to: '/domains',       keywords: ['expiring', 'renewal', 'vencimiento', 'renovación', 'caducan'] },
  { id: 'sub-categories',       kind: 'page', icon: 'category',         labelKey: 'commandPalette.sub.categories',        to: '/products',      keywords: ['categorías', 'groups', 'grupos', 'clasificar'] },
  { id: 'sub-scenarios',        kind: 'page', icon: 'analytics',        labelKey: 'commandPalette.sub.scenarios',         to: '/forecasting',   keywords: ['optimista', 'pessimistic', 'baseline', 'scenarios', 'escenarios'] },
  { id: 'sub-report-mrr',       kind: 'page', icon: 'table_chart',      labelKey: 'commandPalette.sub.reportMrr',        to: '/reports',       keywords: ['informe mrr', 'report', 'export mrr'] },
  { id: 'sub-report-revenue',   kind: 'page', icon: 'table_chart',      labelKey: 'commandPalette.sub.reportRevenue',    to: '/reports',       keywords: ['informe ingresos', 'report revenue', 'export revenue'] },
  { id: 'sub-changelog',        kind: 'page', icon: 'new_releases',     labelKey: 'commandPalette.sub.changelog',         to: '/settings',      keywords: ['novedades', 'changelog', 'version', 'whats new', 'actualizaciones'] },
  { id: 'sub-team',             kind: 'page', icon: 'group_add',        labelKey: 'commandPalette.sub.team',              to: '/settings',      keywords: ['equipo', 'team', 'invite', 'invitar', 'members', 'miembros'], adminOnly: true },
  { id: 'sub-api-keys',         kind: 'page', icon: 'key',              labelKey: 'commandPalette.sub.apiKeys',           to: '/settings',      keywords: ['api key', 'token', 'clave', 'integración'], adminOnly: true },
  { id: 'sub-sync',             kind: 'page', icon: 'sync',             labelKey: 'commandPalette.sub.sync',              to: '/sync',          keywords: ['sincronizar', 'sync', 'whmcs', 'actualizar datos'], adminOnly: true },
  { id: 'sub-appearance',       kind: 'setting', icon: 'palette',       labelKey: 'commandPalette.sub.appearance',        to: '/settings',      keywords: ['apariencia', 'appearance', 'theme', 'tema', 'idioma', 'language', 'moneda', 'currency'] },

  // ── Actions ──
  { id: 'action-logout',     kind: 'action', icon: 'logout',     labelKey: 'commandPalette.logout',        onSelect: extra.signOut,      keywords: ['cerrar sesión', 'sign out', 'salir'] },

  // ── Settings ──
  { id: 'setting-theme',     kind: 'setting', icon: 'dark_mode',  labelKey: 'commandPalette.toggleTheme',  onSelect: extra.toggleTheme,  keywords: ['dark', 'light', 'modo oscuro', 'appearance', 'tema'] },
]

// ---------------------------------------------------------------------------
// Simple fuzzy matcher
// ---------------------------------------------------------------------------

function matchScore(query: string, text: string): number {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 60
  const words = q.split(/\s+/)
  if (words.length > 1 && words.every(w => t.includes(w))) return 40
  return 0
}

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return items
  return items
    .map(item => {
      const label = item._label || ''
      const kw = (item.keywords || []).join(' ')
      const score = matchScore(query, `${label} ${kw}`)
      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item)
}

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<CommandItemKind, string> = {
  page: 'commandPalette.sectionPages',
  action: 'commandPalette.sectionActions',
  setting: 'commandPalette.sectionSettings',
}

const SECTION_ORDER: CommandItemKind[] = ['page', 'action', 'setting']

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const CommandPaletteContext = React.createContext<{
  open: () => void
  close: () => void
  toggle: () => void
}>({ open: () => {}, close: () => {}, toggle: () => {} })

export function useCommandPalette() {
  return React.useContext(CommandPaletteContext)
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)

  const ctx = React.useMemo(() => ({
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(p => !p),
  }), [])

  // Global Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(p => !p)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <CommandPaletteContext.Provider value={ctx}>
      {children}
      {isOpen && <CommandPalettePanel onClose={() => setIsOpen(false)} />}
    </CommandPaletteContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Panel (rendered only when open)
// ---------------------------------------------------------------------------

function CommandPalettePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { setTheme, resolvedTheme } = useTheme()
  const { signOut } = useAuth()
  const { userRole } = useFilters()

  const [query, setQuery] = React.useState('')
  const [activeIdx, setActiveIdx] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Registry
  const allItems = React.useMemo(() => {
    const items = buildRegistry({
      toggleTheme: () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
        onClose()
      },
      signOut: async () => {
        onClose()
        try { await signOut() } catch {}
      },
    })
    const isAdmin = userRole === 'admin'
    return items
      .filter(item => !item.adminOnly || isAdmin)
      .map(item => ({ ...item, _label: t(item.labelKey) }))
  }, [t, resolvedTheme, setTheme, signOut, onClose, userRole])

  const filtered = React.useMemo(() => filterItems(allItems, query), [allItems, query])

  const sections = React.useMemo(() => {
    const grouped: { kind: CommandItemKind; label: string; items: CommandItem[] }[] = []
    for (const kind of SECTION_ORDER) {
      const items = filtered.filter(i => i.kind === kind)
      if (items.length > 0) grouped.push({ kind, label: t(SECTION_LABELS[kind]), items })
    }
    return grouped
  }, [filtered, t])

  const flatItems = React.useMemo(() => sections.flatMap(s => s.items), [sections])

  // Focus input on mount
  React.useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // Reset active index when query changes
  React.useEffect(() => { setActiveIdx(0) }, [query])

  // Close on route change
  const pathRef = React.useRef(location.pathname)
  React.useEffect(() => {
    if (location.pathname !== pathRef.current) onClose()
  }, [location.pathname, onClose])

  // Body scroll lock
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Scroll active into view
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const execute = React.useCallback((item: CommandItem) => {
    onClose()
    if (item.to) navigate(item.to)
    else if (item.onSelect) item.onSelect()
  }, [navigate, onClose])

  const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const len = flatItems.length || 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIdx(idx => (idx + 1) % len)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIdx(idx => (idx - 1 + len) % len)
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[activeIdx]) execute(flatItems[activeIdx])
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [flatItems, activeIdx, execute, onClose])

  // Flat counter for keyboard nav data-idx
  let flatCounter = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] sm:pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-xl mx-4',
          'bg-surface-elevated border border-border rounded-2xl shadow-2xl',
          'flex flex-col max-h-[min(480px,60vh)]',
          'overflow-hidden'
        )}
        role="dialog"
        aria-label={t('commandPalette.title')}
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Icon name="search" size="lg" className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className={cn(
              'flex-1 bg-transparent text-base font-light text-foreground',
              'placeholder:text-muted-foreground',
              'outline-none border-none'
            )}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted select-none">
            ESC
          </kbd>
        </div>

        {/* ── Results ── */}
        <div ref={listRef} className="overflow-y-auto overscroll-contain py-2 px-2 flex-1">
          {flatItems.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted">
              <Icon name="search_off" size="2xl" className="mb-2 opacity-40" />
              <p className="text-sm">{t('commandPalette.noResults')}</p>
            </div>
          ) : (
            sections.map(section => (
              <div key={section.kind} className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted select-none">
                  {section.label}
                </p>
                {section.items.map(item => {
                  flatCounter++
                  const idx = flatCounter
                  const isActive = idx === activeIdx
                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => execute(item)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-colors',
                        isActive
                          ? 'bg-primary-500/10 text-foreground'
                          : 'text-foreground/80 hover:bg-surface-hover'
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size="md"
                        className={cn('shrink-0', isActive ? 'text-primary-500' : 'text-muted')}
                      />
                      <span className="flex-1 text-left truncate">{item._label}</span>
                      {isActive && (
                        <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-surface px-1 py-0.5 text-[10px] text-muted select-none">
                          <Icon name="keyboard_return" size="sm" />
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[11px] text-muted select-none shrink-0">
          <span className="flex items-center gap-1">
            <Icon name="keyboard_arrow_up" size="sm" />
            <Icon name="keyboard_arrow_down" size="sm" />
            {t('commandPalette.hintNavigate')}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="keyboard_return" size="sm" />
            {t('commandPalette.hintSelect')}
          </span>
          <span className="flex items-center gap-1">
            ESC {t('commandPalette.hintClose')}
          </span>
        </div>
      </div>
    </div>
  )
}
