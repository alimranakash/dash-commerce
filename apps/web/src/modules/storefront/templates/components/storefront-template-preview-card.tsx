import { storeSubdomain } from "../../../../lib/host-routing";
import Link from "next/link";
import { getStorefrontTemplateById } from "../registry";

type StorefrontTemplatePreviewCardProps = {
  activeTemplate?: string | null;
  businessType?: string | null;
  // Resolved by the caller with the same helper the storefront uses, so this
  // card always names the template the public store actually renders.
  resolvedTemplateId: string;
  storeSlug: string;
};

export function StorefrontTemplatePreviewCard({
  activeTemplate,
  businessType,
  resolvedTemplateId,
  storeSlug
}: StorefrontTemplatePreviewCardProps) {
  const template = getStorefrontTemplateById(resolvedTemplateId);
  const previewUrl = `https://${storeSubdomain(storeSlug)}`;

  return (
    <section className="panel-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Storefront Template</p>
          <h2>Template preview & debug</h2>
          <p className="auth-copy">
            Verify the selected business type, active template, and public storefront route.
          </p>
        </div>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#7C3AED] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6D28D9]"
          href={previewUrl}
          rel="noreferrer"
          target="_blank"
        >
          View Storefront
        </Link>
      </div>

      {!activeTemplate ? (
        <p className="mt-4 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 text-sm font-medium text-[#6D28D9]">
          No template has been applied yet, so the storefront falls back to: {resolvedTemplateId}
        </p>
      ) : null}

      <dl className="mt-5 grid gap-3 md:grid-cols-2">
        <TemplateField label="Business Type" value={businessType || "Not selected"} />
        <TemplateField label="Active Template" value={resolvedTemplateId} />
        <TemplateField label="Template Name" value={template.name} />
        <TemplateField label="Storefront Preview URL" value={previewUrl} />
      </dl>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template Description</p>
        <p className="mt-1 text-sm text-slate-700">{template.description}</p>
      </div>
    </section>
  );
}

function TemplateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
