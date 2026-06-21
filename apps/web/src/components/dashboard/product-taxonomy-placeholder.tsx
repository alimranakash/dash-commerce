import { DashboardCard } from "./dashboard-card";
import { DashboardShell } from "./dashboard-shell";

type ProductTaxonomyPlaceholderProps = { storeSlug: string; title: string };

export function ProductTaxonomyPlaceholder({ storeSlug, title }: ProductTaxonomyPlaceholderProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page">
        <div className="resource-header"><div><p className="eyebrow">Products</p><h1>{title}</h1><p className="auth-copy">Organize product {title.toLowerCase()} from this workspace.</p></div></div>
        <DashboardCard title={title}><div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-[#dedceb] bg-[#fafaff] text-center"><div><p className="text-sm font-semibold">No {title.toLowerCase()} yet</p><p className="mt-2 text-xs text-[#858691]">This catalog tool is ready for its future backend module.</p></div></div></DashboardCard>
      </section>
    </DashboardShell>
  );
}
