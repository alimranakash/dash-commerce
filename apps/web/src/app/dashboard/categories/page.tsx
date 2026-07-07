import { getCategoriesForStore } from "../../../modules/categories/category.service";
import { CategoryManagement } from "../../../modules/categories/components/category-management";
import { getMediaPickerAssets } from "../../../modules/media/media.service";
import { requireStore } from "../../../modules/stores/queries";

type CategoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const store = await requireStore();
  const [categories, mediaAssets] = await Promise.all([
    getCategoriesForStore(store.id),
    getMediaPickerAssets(store.id)
  ]);
  const message = getCategoriesMessage(await searchParams);

  return (
    <CategoryManagement
      categories={categories}
      mediaAssets={mediaAssets}
      message={message}
      storeSlug={store.slug}
    />
  );
}

function getCategoriesMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Category created.";
  if (searchParams.updated) return "Category updated.";
  if (searchParams.deleted) return "Category deleted.";
  return null;
}
