export interface TourStep {
  id: string
  targetSelector: string
  titleKey: string
  descriptionKey: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  adminOnly?: boolean
  isSidebar?: boolean
}

export type TourId = 'dashboard' | 'revenue' | 'clients' | 'products' | 'forecasting' | 'sync' | 'domains'

export interface TourDef {
  steps: TourStep[]
  adminOnly?: boolean
}

/** Route path → tour ID mapping */
export const routeToTourId: Record<string, TourId> = {
  '/': 'dashboard',
  '/revenue': 'revenue',
  '/clients': 'clients',
  '/products': 'products',
  '/forecasting': 'forecasting',
  '/sync': 'sync',
  '/domains': 'domains',
}

export const tours: Record<TourId, TourDef> = {
  dashboard: {
    steps: [
      {
        id: 'sidebar',
        targetSelector: '[data-tour="sidebar-nav"]',
        titleKey: 'onboarding.tours.dashboard.sidebar.title',
        descriptionKey: 'onboarding.tours.dashboard.sidebar.description',
        placement: 'right',
        isSidebar: true,
      },
      {
        id: 'quick-links',
        targetSelector: '[data-tour="quick-links"]',
        titleKey: 'onboarding.tours.dashboard.quickLinks.title',
        descriptionKey: 'onboarding.tours.dashboard.quickLinks.description',
        placement: 'bottom',
      },
      {
        id: 'kpi-cards',
        targetSelector: '[data-tour="kpi-cards"]',
        titleKey: 'onboarding.tours.dashboard.kpiCards.title',
        descriptionKey: 'onboarding.tours.dashboard.kpiCards.description',
        placement: 'bottom',
      },
      {
        id: 'health-score',
        targetSelector: '[data-tour="health-score"]',
        titleKey: 'onboarding.tours.dashboard.healthScore.title',
        descriptionKey: 'onboarding.tours.dashboard.healthScore.description',
        placement: 'bottom',
      },
      {
        id: 'connectors',
        targetSelector: '[data-tour="nav-connectors"]',
        titleKey: 'onboarding.tours.dashboard.connectors.title',
        descriptionKey: 'onboarding.tours.dashboard.connectors.description',
        placement: 'right',
        adminOnly: true,
        isSidebar: true,
      },
      {
        id: 'settings',
        targetSelector: '[data-tour="nav-settings"]',
        titleKey: 'onboarding.tours.dashboard.settings.title',
        descriptionKey: 'onboarding.tours.dashboard.settings.description',
        placement: 'right',
        adminOnly: true,
        isSidebar: true,
      },
      {
        id: 'profile',
        targetSelector: '[data-tour="nav-profile"]',
        titleKey: 'onboarding.tours.dashboard.profile.title',
        descriptionKey: 'onboarding.tours.dashboard.profile.description',
        placement: 'right',
        isSidebar: true,
      },
    ],
  },

  revenue: {
    steps: [
      {
        id: 'kpi-revenue',
        targetSelector: '[data-tour="kpi-revenue"]',
        titleKey: 'onboarding.tours.revenue.kpis.title',
        descriptionKey: 'onboarding.tours.revenue.kpis.description',
        placement: 'bottom',
      },
      {
        id: 'revenue-trends',
        targetSelector: '[data-tour="revenue-trends"]',
        titleKey: 'onboarding.tours.revenue.trends.title',
        descriptionKey: 'onboarding.tours.revenue.trends.description',
        placement: 'bottom',
      },
      {
        id: 'top-transactions',
        targetSelector: '[data-tour="top-transactions"]',
        titleKey: 'onboarding.tours.revenue.topTransactions.title',
        descriptionKey: 'onboarding.tours.revenue.topTransactions.description',
        placement: 'bottom',
      },
      {
        id: 'revenue-mix',
        targetSelector: '[data-tour="revenue-mix"]',
        titleKey: 'onboarding.tours.revenue.mix.title',
        descriptionKey: 'onboarding.tours.revenue.mix.description',
        placement: 'top',
      },
    ],
  },

  clients: {
    steps: [
      {
        id: 'kpi-clients',
        targetSelector: '[data-tour="kpi-clients"]',
        titleKey: 'onboarding.tours.clients.kpis.title',
        descriptionKey: 'onboarding.tours.clients.kpis.description',
        placement: 'bottom',
      },
      {
        id: 'health-insights',
        targetSelector: '[data-tour="health-insights"]',
        titleKey: 'onboarding.tours.clients.healthInsights.title',
        descriptionKey: 'onboarding.tours.clients.healthInsights.description',
        placement: 'bottom',
      },
      {
        id: 'client-trends',
        targetSelector: '[data-tour="client-trends"]',
        titleKey: 'onboarding.tours.clients.trends.title',
        descriptionKey: 'onboarding.tours.clients.trends.description',
        placement: 'bottom',
      },
      {
        id: 'client-list',
        targetSelector: '[data-tour="client-list"]',
        titleKey: 'onboarding.tours.clients.list.title',
        descriptionKey: 'onboarding.tours.clients.list.description',
        placement: 'top',
      },
    ],
  },

  products: {
    steps: [
      {
        id: 'product-controls',
        targetSelector: '[data-tour="product-controls"]',
        titleKey: 'onboarding.tours.products.controls.title',
        descriptionKey: 'onboarding.tours.products.controls.description',
        placement: 'bottom',
      },
      {
        id: 'product-table',
        targetSelector: '[data-tour="product-table"]',
        titleKey: 'onboarding.tours.products.table.title',
        descriptionKey: 'onboarding.tours.products.table.description',
        placement: 'bottom',
      },
      {
        id: 'product-stats',
        targetSelector: '[data-tour="product-stats"]',
        titleKey: 'onboarding.tours.products.stats.title',
        descriptionKey: 'onboarding.tours.products.stats.description',
        placement: 'top',
      },
    ],
  },

  forecasting: {
    steps: [
      {
        id: 'mrr-projections',
        targetSelector: '[data-tour="mrr-projections"]',
        titleKey: 'onboarding.tours.forecasting.projections.title',
        descriptionKey: 'onboarding.tours.forecasting.projections.description',
        placement: 'bottom',
      },
      {
        id: 'growth-milestone',
        targetSelector: '[data-tour="growth-milestone"]',
        titleKey: 'onboarding.tours.forecasting.growth.title',
        descriptionKey: 'onboarding.tours.forecasting.growth.description',
        placement: 'bottom',
      },
      {
        id: 'scenario-comparison',
        targetSelector: '[data-tour="scenario-comparison"]',
        titleKey: 'onboarding.tours.forecasting.scenarios.title',
        descriptionKey: 'onboarding.tours.forecasting.scenarios.description',
        placement: 'top',
      },
    ],
  },

  sync: {
    adminOnly: true,
    steps: [
      {
        id: 'sync-status',
        targetSelector: '[data-tour="sync-status"]',
        titleKey: 'onboarding.tours.sync.status.title',
        descriptionKey: 'onboarding.tours.sync.status.description',
        placement: 'bottom',
      },
      {
        id: 'sync-history',
        targetSelector: '[data-tour="sync-history"]',
        titleKey: 'onboarding.tours.sync.history.title',
        descriptionKey: 'onboarding.tours.sync.history.description',
        placement: 'top',
      },
    ],
  },

  domains: {
    steps: [
      {
        id: 'domain-status',
        targetSelector: '[data-tour="domain-status"]',
        titleKey: 'onboarding.tours.domains.status.title',
        descriptionKey: 'onboarding.tours.domains.status.description',
        placement: 'bottom',
      },
      {
        id: 'domain-revenue',
        targetSelector: '[data-tour="domain-revenue"]',
        titleKey: 'onboarding.tours.domains.revenue.title',
        descriptionKey: 'onboarding.tours.domains.revenue.description',
        placement: 'bottom',
      },
    ],
  },
}
