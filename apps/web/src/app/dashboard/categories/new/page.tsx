import { getCategoriesForStore } from "../../../../modules/categories/category.service";
import { CategoryManagement } from "../../../../modules/categories/components/category-management";
import { getMediaPickerAssets } from "../../../../modules/media/media.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateCategoryPage() {
  const store = await requireStore();
  const [categories, mediaAssets] = await Promise.all([
    getCategoriesForStore(store.id),
    getMediaPickerAssets(store.id)
  ]);

  return <CategoryManagement categories={categories} mediaAssets={mediaAssets} storeSlug={store.slug} />;
}
