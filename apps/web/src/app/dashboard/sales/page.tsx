import { SaleList } from "../../../modules/sales/components/sale-list";
import { saleStatusSchema, saleTypeSchema, type SaleStatus, type SaleType } from "../../../modules/sales/sale.schema";
import { getSaleMetricsForStore, getSalesForStore } from "../../../modules/sales/sale.service";
import { requireStore } from "../../../modules/stores/queries";

type SalesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = valueOf(params.search);
  const dateFrom = valueOf(params.dateFrom);
  const dateTo = valueOf(params.dateTo);
  const status = statusFromParam(valueOf(params.status));
  const saleType = saleTypeFromParam(valueOf(params.saleType));
  const filters = {
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    saleType,
    search,
    status
  };
  const [sales, metrics] = await Promise.all([
    getSalesForStore(store.organizationId, store.id, filters),
    getSaleMetricsForStore(store.organizationId, store.id)
  ]);

  return (
    <SaleList
      currency={store.currency}
      dateFrom={dateFrom}
      dateTo={dateTo}
      filters={{
        saleType: saleType === "ALL" ? "" : saleType.toLowerCase(),
        status: status === "ALL" ? "" : status.toLowerCase()
      }}
      message={getSalesMessage(params)}
      metrics={metrics}
      sales={sales}
      search={search}
      storeSlug={store.slug}
    />
  );
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function statusFromParam(value: string): SaleStatus | "ALL" {
  const parsed = saleStatusSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "ALL";
}

function saleTypeFromParam(value: string): SaleType | "ALL" {
  const parsed = saleTypeSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "ALL";
}

function getSalesMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Sale created.";
  if (searchParams.voided) return "Sale voided.";
  return null;
}
