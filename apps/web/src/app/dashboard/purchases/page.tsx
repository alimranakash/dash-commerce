import { PurchaseList } from "../../../modules/purchases/components/purchase-list";
import { purchaseStatusSchema, type PurchaseStatus } from "../../../modules/purchases/purchase.schema";
import { getPurchaseCountsForStore, getPurchasesForStore } from "../../../modules/purchases/purchase.service";
import { requireStore } from "../../../modules/stores/queries";

type PurchasesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = valueOf(params.search);
  const activeStatus = statusFromParam(valueOf(params.status));
  const [purchases, counts] = await Promise.all([
    getPurchasesForStore(store.organizationId, store.id, {
      search,
      status: activeStatus
    }),
    getPurchaseCountsForStore(store.organizationId, store.id)
  ]);

  return (
    <PurchaseList
      activeStatus={activeStatus}
      counts={counts}
      currency={store.currency}
      message={getPurchasesMessage(params)}
      purchases={purchases}
      search={search}
      storeSlug={store.slug}
    />
  );
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function statusFromParam(value: string): PurchaseStatus | "ALL" {
  const parsed = purchaseStatusSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "ALL";
}

function getPurchasesMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Purchase created.";
  if (searchParams.cancelled) return "Purchase cancelled.";
  return null;
}
