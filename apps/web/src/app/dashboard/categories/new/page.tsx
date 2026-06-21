import { getCategoriesForStore } from "../../../../modules/categories/category.service";
import { CategoryManagement } from "../../../../modules/categories/components/category-management";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateCategoryPage() {
  const store = await requireStore();
  const categories = await getCategoriesForStore(store.id);

  return <CategoryManagement categories={categories} storeSlug={store.slug} />;
}
