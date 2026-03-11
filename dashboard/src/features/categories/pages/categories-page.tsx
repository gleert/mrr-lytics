import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/ui/icon'
import { Card, CardContent } from '@/shared/components/ui/card'
import { 
  useCategories, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory,
  type Category,
  type CreateCategoryData,
  type UpdateCategoryData,
} from '../hooks/use-categories'
import { CategoryCard } from '../components/category-card'
import { CategoryFormModal } from '../components/category-form-modal'
import { DeleteCategoryModal } from '../components/delete-category-modal'

export function CategoriesPage() {
  const { t } = useTranslation()
  const { data: categories, isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  // Modal state
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = React.useState<Category | null>(null)

  const handleAddCategory = () => {
    setEditingCategory(null)
    setIsFormOpen(true)
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setIsFormOpen(true)
  }

  const handleDeleteCategory = (category: Category) => {
    setDeletingCategory(category)
    setIsDeleteOpen(true)
  }

  const handleFormSubmit = async (data: CreateCategoryData | UpdateCategoryData) => {
    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({ 
          categoryId: editingCategory.id, 
          data: data as UpdateCategoryData 
        })
      } else {
        await createCategory.mutateAsync(data as CreateCategoryData)
      }
      setIsFormOpen(false)
      setEditingCategory(null)
    } catch (err) {
      console.error('Failed to save category:', err)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return
    try {
      await deleteCategory.mutateAsync(deletingCategory.id)
      setIsDeleteOpen(false)
      setDeletingCategory(null)
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }

  const activeCategories = categories?.filter(c => c.is_active) || []
  const inactiveCategories = categories?.filter(c => !c.is_active) || []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('categories.title')}</h1>
          <p className="text-muted">{t('categories.subtitle')}</p>
        </div>
        <Button onClick={handleAddCategory}>
          <Icon name="add" size="md" className="mr-2" />
          {t('categories.addCategory')}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Icon name="sync" size="xl" className="animate-spin text-muted" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!categories || categories.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
              <Icon name="category" size="2xl" className="text-primary-500" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              {t('categories.noCategories')}
            </h3>
            <p className="text-muted text-center max-w-sm mb-4">
              {t('categories.noCategoriesDesc')}
            </p>
            <Button onClick={handleAddCategory}>
              <Icon name="add" size="md" className="mr-2" />
              {t('categories.addFirst')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active categories */}
      {!isLoading && activeCategories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            {t('categories.activeCategories')} ({activeCategories.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive categories */}
      {!isLoading && inactiveCategories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            {t('categories.inactiveCategories')} ({inactiveCategories.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 opacity-60">
            {inactiveCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      <CategoryFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingCategory(null)
        }}
        onSubmit={handleFormSubmit}
        category={editingCategory}
        isLoading={createCategory.isPending || updateCategory.isPending}
      />

      {/* Delete Modal */}
      <DeleteCategoryModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false)
          setDeletingCategory(null)
        }}
        onConfirm={handleDeleteConfirm}
        category={deletingCategory}
        isLoading={deleteCategory.isPending}
      />
    </div>
  )
}
