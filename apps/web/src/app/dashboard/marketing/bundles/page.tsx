import { Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { listBundles } from "../../../../modules/merchandising/bundle.service";
import { describeBundle } from "../../../../modules/merchandising/bundle.schema";
import { requireStore } from "../../../../modules/stores/queries";

export default async function BundlesPage() {
  const store = await requireStore();
  const bundles = await listBundles(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Marketing</p>
            <h1>Bundles</h1>
            <p className="auth-copy">
              Deals priced off what is in the cart together, rather than off the cart total. No code
              to type: a bundle applies the moment the cart qualifies.
            </p>
          </div>
          <FeatureGate feature="bundles" storeId={store.id}>
            <Link
              className="inline-flex items-center gap-1 rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
              href="/dashboard/marketing/bundles/new"
            >
              <Plus aria-hidden="true" className="h-4 w-4" /> Create Bundle
            </Link>
          </FeatureGate>
        </div>

        {bundles.length === 0 ? (
          <p className="m-0 rounded-xl border border-[#ecebf3] bg-white px-5 py-8 text-center text-sm text-[#77748a]">
            No bundles yet. A bundle is how you say &ldquo;buy 2, get 1 free&rdquo; or &ldquo;these
            two together, 10% off&rdquo; — things a coupon code cannot express.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#ecebf3] bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#f7f7fa] text-xs text-[#5f616d]">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Deal</th>
                  <th className="p-3">Products</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => (
                  <tr className="border-t border-[#efeff5] transition hover:bg-[#faf9ff]" key={bundle.id}>
                    <td className="p-3">
                      <Link className="font-semibold text-[#6d3cf5]" href={`/dashboard/marketing/bundles/${bundle.id}`}>
                        {bundle.name}
                      </Link>
                    </td>
                    <td className="p-3 text-[#555762]">
                      {bundle.description ||
                        describeBundle({
                          buyQuantity: bundle.buyQuantity,
                          discountType: bundle.discountType,
                          discountValue: bundle.discountValue,
                          getQuantity: bundle.getQuantity,
                          itemCount: bundle.items.length,
                          type: bundle.type
                        })}
                    </td>
                    <td className="p-3 text-[#686a76]">
                      {bundle.items.map((item) => item.title).join(", ")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${bundle.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-[#f1f1f5] text-[#555662]"}`}
                      >
                        {bundle.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
