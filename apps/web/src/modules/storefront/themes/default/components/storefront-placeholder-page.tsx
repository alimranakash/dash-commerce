import type { StorefrontStore } from "../../../storefront.types";
import { StorefrontBadge, StorefrontButton, StorefrontContainer, StorefrontEmptyState, StorefrontSection } from "../../../primitives";
import { DefaultStorefrontLayout } from "../layouts/default-storefront-layout";

export function StorefrontPlaceholderPage({
  description,
  store,
  title
}: {
  description: string;
  store: StorefrontStore;
  title: string;
}) {
  return (
    <DefaultStorefrontLayout store={store}>
      <StorefrontContainer>
        <StorefrontSection title={title}>
          <StorefrontBadge>Default Theme</StorefrontBadge>
          <StorefrontEmptyState
            action={<StorefrontButton href={`/s/${store.slug}`}>Back to storefront</StorefrontButton>}
            description={description}
            title={title}
          />
        </StorefrontSection>
      </StorefrontContainer>
    </DefaultStorefrontLayout>
  );
}
