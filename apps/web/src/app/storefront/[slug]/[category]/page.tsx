import { redirect } from "next/navigation";

type StorefrontCategoryPageProps = {
  params: Promise<{
    category: string;
    slug: string;
  }>;
};

export default async function StorefrontCategoryPage({ params }: StorefrontCategoryPageProps) {
  const { category, slug } = await params;

  redirect(`/s/${slug}/categories/${category}`);
}
