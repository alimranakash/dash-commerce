import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { StorefrontThemeSettingsPage } from "../../../../modules/storefront/dashboard/storefront-theme-settings-page";
import { requireStore } from "../../../../modules/stores/queries";

type StorefrontThemesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StorefrontThemesPage({ searchParams }: StorefrontThemesPageProps) {
  const store = await requireStore();
  const params = await searchParams;

  return (
    <DashboardShell storeSlug={store.slug}>
      <StorefrontThemeSettingsPage searchParams={params} store={store} />
    </DashboardShell>
  );
}
