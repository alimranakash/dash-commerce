import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import {
  reinstallDemoPackAction,
  removeDemoContentAction,
  resetDemoContentAction
} from "../../../../modules/demo-packs/manager.actions";
import { DemoContentManager } from "../../../../modules/demo-packs/components/demo-content-manager";
import { getDemoContentOverview } from "../../../../modules/demo-packs/manager.service";
import { requireStore } from "../../../../modules/stores/queries";

type DemoContentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const messages: Record<string, string> = {
  reinstalled: "Demo pack reinstalled successfully.",
  removed: "Demo content removed successfully.",
  reset: "Demo content reset successfully."
};

export default async function DemoContentPage({ searchParams }: DemoContentPageProps) {
  const store = await requireStore();
  const [overview, params] = await Promise.all([
    getDemoContentOverview(store.id),
    searchParams
  ]);
  const messageKey = typeof params.demoContent === "string" ? params.demoContent : "";
  const message = messages[messageKey] ?? null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Demo Content</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#737582]">
            Manage the demo pack installed for this store without touching user-created products, orders, customers, billing, or store settings.
          </p>
        </div>
        {message ? (
          <p className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-medium text-[#15803d]">{message}</p>
        ) : null}
        <DemoContentManager
          overview={overview}
          reinstallAction={reinstallDemoPackAction}
          removeAction={removeDemoContentAction}
          resetAction={resetDemoContentAction}
        />
      </section>
    </DashboardShell>
  );
}
