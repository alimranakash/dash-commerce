import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getActiveStorefrontTheme } from "../../../modules/storefront/themes/registry";
import { getPrimaryStorefrontDomain, getStorefrontBySlug } from "../../../modules/storefront/resolver";

type StorefrontLayoutProps = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: StorefrontLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return {
      title: "Storefront not found | Dash Commerce OS"
    };
  }

  const primaryDomain = getPrimaryStorefrontDomain(store);
  const title = `${store.name} | Dash Commerce OS`;
  const description = store.themeSetting?.heroSubtitle ?? `Shop ${store.name} online.`;
  const canonical = primaryDomain ? `https://${primaryDomain.domain}` : `/s/${store.slug}`;

  return {
    alternates: {
      canonical
    },
    description,
    openGraph: {
      description,
      siteName: store.name,
      title,
      type: "website",
      url: canonical
    },
    title
  };
}

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  const { slug } = await params;
  const store = await getStorefrontBySlug(slug);
  const theme = store ? getActiveStorefrontTheme(store) : null;

  return (
    <div data-storefront-layout="true" data-storefront-theme={theme?.id ?? "default"}>
      {children}
    </div>
  );
}
