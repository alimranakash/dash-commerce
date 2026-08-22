import { storefrontBasePath } from "../../../base-path";
import type { StorefrontStore } from "../../../storefront.types";
import { StorefrontBadge, StorefrontButton, StorefrontContainer, StorefrontEmptyState, StorefrontSection } from "../../../primitives";
import { DefaultStorefrontLayout } from "../layouts/default-storefront-layout";

export async function StorefrontPlaceholderPage({
  description,
  store,
  title
}: {
  description: string;
  store: StorefrontStore;
  title: string;
}) {
  const basePath = await storefrontBasePath(store.slug);
  return (
    <DefaultStorefrontLayout store={store}>
      <StorefrontContainer>
        <StorefrontSection title={title}>
          <StorefrontBadge>Default Theme</StorefrontBadge>
          <StorefrontEmptyState
            action={<StorefrontButton href={basePath || "/"}>Back to storefront</StorefrontButton>}
            description={description}
            title={title}
          />
        </StorefrontSection>
      </StorefrontContainer>
    </DefaultStorefrontLayout>
  );
}
