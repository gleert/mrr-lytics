import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { NoInstancesGuard } from '@/shared/components/no-instances-guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/ui/icon'
import { cn } from '@/shared/lib/utils'
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters'
import { useFilters } from '@/app/providers'
import { 
  useCategories, 
  useCreateCategory,
  type CreateCategoryData,
  type UpdateCategoryData,
} from '@/features/categories'
import { CategoryFormModal } from '@/features/categories/components/category-form-modal'
import { 
  useProducts, 
  useCreateCategoryMapping, 
  useDeleteCategoryMapping,
  type Product,
  type ProductGroup,
} from '../hooks/use-products'
import { ProductRow } from '../components/product-row'
import { ProductStats } from '../components/product-stats'
import { useProductsChurn, type ProductChurnData } from '../hooks/use-products-churn'

type ViewMode = 'groups' | 'products'

export function ProductsPage() {
  const { t } = useTranslation()
  const { userRole } = useFilters()
  const isAdmin = userRole === 'admin'
  const [viewMode, setViewMode] = React.useState<ViewMode>('groups')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showHidden, setShowHidden] = React.useState(true)
  const [churnPeriod, setChurnPeriod] = React.useState<30 | 60 | 90>(30)
  const [updatingItems, setUpdatingItems] = React.useState<Set<string>>(new Set())

  const { data: productsData, isLoading: productsLoading } = useProducts(showHidden)
  const { data: churnData, isLoading: churnLoading } = useProductsChurn(churnPeriod)
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const createMapping = useCreateCategoryMapping()
  const deleteMapping = useDeleteCategoryMapping()
  const createCategory = useCreateCategory()

  // Category form modal state
  const [isCategoryFormOpen, setIsCategoryFormOpen] = React.useState(false)

  const isLoading = productsLoading || categoriesLoading

  const handleCreateCategory = async (data: CreateCategoryData | UpdateCategoryData) => {
    try {
      await createCategory.mutateAsync(data as CreateCategoryData)
      setIsCategoryFormOpen(false)
    } catch (err) {
      console.error('Failed to create category:', err)
    }
  }

  // Filter items based on search
  const filteredProducts = React.useMemo(() => {
    if (!productsData?.products) return []
    const query = searchQuery.toLowerCase()
    return productsData.products.filter(p => 
      p.name?.toLowerCase().includes(query) ||
      p.instance_name?.toLowerCase().includes(query)
    )
  }, [productsData?.products, searchQuery])

  const filteredGroups = React.useMemo(() => {
    if (!productsData?.product_groups) return []
    const query = searchQuery.toLowerCase()
    return productsData.product_groups.filter(g => 
      g.name?.toLowerCase().includes(query) ||
      g.instance_name?.toLowerCase().includes(query)
    )
  }, [productsData?.product_groups, searchQuery])

  // Per-product churn lookup: "instanceId:whmcsId" → churn stats
  const churnMap = React.useMemo(() => {
    const map = new Map<string, ProductChurnData>()
    churnData?.products.forEach(p => {
      map.set(`${p.instance_id}:${p.whmcs_id}`, p)
    })
    return map
  }, [churnData])

  // Per-group churn lookup: aggregate product churn by gid
  const churnByGroupMap = React.useMemo(() => {
    const grouped = new Map<string, { active: number; churned: number; mrr: number }>()
    productsData?.products.forEach(p => {
      if (!p.gid) return
      const groupKey = `${p.instance_id}:${p.gid}`
      const churn = churnMap.get(`${p.instance_id}:${p.whmcs_id}`)
      if (!churn) return
      const existing = grouped.get(groupKey) || { active: 0, churned: 0, mrr: 0 }
      grouped.set(groupKey, {
        active: existing.active + churn.active_services,
        churned: existing.churned + churn.churned_services,
        mrr: existing.mrr + churn.churned_mrr,
      })
    })
    const result = new Map<string, ProductChurnData>()
    grouped.forEach((v, key) => {
      const colonIdx = key.indexOf(':')
      const instance_id = key.slice(0, colonIdx)
      const whmcs_id = Number(key.slice(colonIdx + 1))
      const total = v.active + v.churned
      result.set(key, {
        whmcs_id,
        instance_id,
        active_services: v.active,
        churned_services: v.churned,
        churned_mrr: Math.round(v.mrr * 100) / 100,
        churn_rate: total > 0 ? Math.round((v.churned / total) * 10000) / 100 : 0,
      })
    })
    return result
  }, [productsData?.products, churnMap])

  const currentItems = viewMode === 'products' ? filteredProducts : filteredGroups
  const totalCount = viewMode === 'products' 
    ? productsData?.products?.length || 0 
    : productsData?.product_groups?.length || 0

  const handleCategoryChange = async (
    item: Product | ProductGroup, 
    type: 'product' | 'product_group',
    categoryId: string | null
  ) => {
    const itemKey = `${type}:${item.instance_id}:${item.whmcs_id}`
    setUpdatingItems(prev => new Set(prev).add(itemKey))

    try {
      if (categoryId === null && item.category) {
        // Remove mapping
        await deleteMapping.mutateAsync({
          categoryId: item.category.id,
          instanceId: item.instance_id,
          mappingType: type,
          whmcsId: item.whmcs_id,
        })
      } else if (categoryId) {
        // If product already has a different category, remove it first
        if (item.category && item.category.id !== categoryId) {
          await deleteMapping.mutateAsync({
            categoryId: item.category.id,
            instanceId: item.instance_id,
            mappingType: type,
            whmcsId: item.whmcs_id,
          })
        }
        // Create new mapping
        await createMapping.mutateAsync({
          categoryId,
          data: {
            instance_id: item.instance_id,
            mapping_type: type,
            whmcs_id: item.whmcs_id,
          },
        })
      }
    } catch (err) {
      console.error('Failed to update category mapping:', err)
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }

  // Handler to remove product's own category and fall back to group's category
  const handleUseGroupCategory = async (item: Product) => {
    if (!item.category) return // Product doesn't have its own category
    
    const itemKey = `product:${item.instance_id}:${item.whmcs_id}`
    setUpdatingItems(prev => new Set(prev).add(itemKey))

    try {
      // Remove the product's own category mapping
      await deleteMapping.mutateAsync({
        categoryId: item.category.id,
        instanceId: item.instance_id,
        mappingType: 'product',
        whmcsId: item.whmcs_id,
      })
    } catch (err) {
      console.error('Failed to use group category:', err)
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }

  return (
    <NoInstancesGuard>
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('products.title')}</h1>
          <p className="text-muted">{t('products.subtitle')}</p>
        </div>
        <DashboardFilters showPeriod={false} />
      </div>

      {/* Controls */}
      <div data-tour="product-controls" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* View mode toggle - Groups first (primary categorization from WHMCS) */}
        <div className="flex gap-1 p-1 bg-surface rounded-lg border border-border">
          <button
            onClick={() => setViewMode('groups')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'groups'
                ? 'bg-primary-500 text-white'
                : 'text-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <Icon name="folder" size="sm" />
            {t('products.groupsTab')}
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
              {productsData?.product_groups?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setViewMode('products')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'products'
                ? 'bg-primary-500 text-white'
                : 'text-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <Icon name="inventory_2" size="sm" />
            {t('products.productsTab')}
            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
              {productsData?.products?.length || 0}
            </span>
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('products.searchPlaceholder')}
              className="h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-sm w-full sm:w-64"
            />
          </div>

          {/* Show hidden toggle */}
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={cn(
              'flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors',
              showHidden
                ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                : 'border-border text-muted hover:text-foreground hover:bg-surface-hover'
            )}
          >
            <Icon name={showHidden ? 'visibility' : 'visibility_off'} size="sm" />
            {t('products.showHidden')}
          </button>

          {/* Churn period selector */}
          <div className="flex gap-1 p-0.5 bg-surface rounded-lg border border-border text-xs">
            {([30, 60, 90] as const).map(d => (
              <button
                key={d}
                onClick={() => setChurnPeriod(d)}
                className={cn(
                  'px-2 py-1 rounded-md font-medium transition-colors',
                  churnPeriod === d
                    ? 'bg-primary-500 text-white'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card data-tour="product-table">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon name={viewMode === 'products' ? 'inventory_2' : 'folder'} size="md" />
            {viewMode === 'products' ? t('products.productsTable') : t('products.groupsTable')}
            {searchQuery && (
              <span className="text-sm font-normal text-muted">
                ({currentItems.length} / {totalCount})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="sync" size="xl" className="animate-spin text-muted" />
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon name={viewMode === 'products' ? 'inventory_2' : 'folder'} size="2xl" className="text-muted/30 mb-3" />
              <p className="text-muted">
                {searchQuery 
                  ? t('products.noSearchResults') 
                  : viewMode === 'products' 
                    ? t('products.noProducts') 
                    : t('products.noGroups')
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-28">
                      {t('products.instance')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      {t('products.name')}
                    </th>
                    {viewMode === 'products' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-24">
                          {t('products.type')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-24">
                          {t('products.payType')}
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-20">
                      {t('products.activeServices')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-24">
                      {t('products.churnRate', { days: churnPeriod })}
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-48">
                        {t('products.category')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((item) => {
                    const itemKey = `${viewMode === 'products' ? 'product' : 'product_group'}:${item.instance_id}:${item.whmcs_id}`
                    const isProductView = viewMode === 'products'
                    return (
                      <ProductRow
                        key={item.id}
                        item={item}
                        type={isProductView ? 'product' : 'product_group'}
                        categories={categories || []}
                        onCategoryChange={(categoryId) =>
                          handleCategoryChange(
                            item,
                            isProductView ? 'product' : 'product_group',
                            categoryId
                          )
                        }
                        onUseGroupCategory={isProductView ? () => handleUseGroupCategory(item as Product) : undefined}
                        onCreateCategory={() => setIsCategoryFormOpen(true)}
                        isUpdating={updatingItems.has(itemKey)}
                        showTypeColumns={isProductView}
                        showCategoryColumn={isAdmin}
                        churnData={
                          isProductView
                            ? churnMap.get(`${item.instance_id}:${item.whmcs_id}`) ?? null
                            : churnByGroupMap.get(`${item.instance_id}:${item.whmcs_id}`) ?? null
                        }
                        churnLoading={churnLoading}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Statistics */}
      <div data-tour="product-stats">
      <ProductStats
        products={productsData?.products || []}
        productGroups={productsData?.product_groups || []}
        isLoading={isLoading}
      />
      </div>

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={isCategoryFormOpen}
        onClose={() => setIsCategoryFormOpen(false)}
        onSubmit={handleCreateCategory}
        category={null}
        isLoading={createCategory.isPending}
      />
    </div>
    </NoInstancesGuard>
  )
}
