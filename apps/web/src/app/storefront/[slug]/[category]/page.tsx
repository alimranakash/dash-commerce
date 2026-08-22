import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import { redirect } from "next/navigation";

type StorefrontCategoryPageProps = {
  params: Promise<{
    category: string;
    slug: string;
  }>;
};

export default async function StorefrontCategoryPage({ params }: StorefrontCategoryPageProps) {
  const { category, slug } = await params;

  const basePath = await storefrontBasePath(slug);

  redirect(`${basePath}/categories/${category}`);
}
