"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyStorefrontTemplateAction } from "../template.actions";

export type TemplateLibraryItem = {
  businessType: string;
  colors: {
    background: string;
    primary: string;
    secondary: string;
    surface: string;
    text: string;
  };
  description: string;
  id: string;
  name: string;
  sections: string[];
};

type StorefrontTemplateLibraryProps = {
  activeTemplateId: string;
  storefrontPreviewUrl: string;
  templates: TemplateLibraryItem[];
};

export function StorefrontTemplateLibrary({
  activeTemplateId,
  storefrontPreviewUrl,
  templates
}: StorefrontTemplateLibraryProps) {
  const router = useRouter();
  const [confirmTemplate, setConfirmTemplate] = useState<TemplateLibraryItem | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateLibraryItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyTemplate() {
    if (!confirmTemplate) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyStorefrontTemplateAction(confirmTemplate.id);

      if (!result.ok) {
        // The error banner sits behind the confirm dialog, so the dialog has to
        // close for the failure to be readable.
        setConfirmTemplate(null);
        setError(result.error);
        return;
      }

      setMessage(`${confirmTemplate.name} is now active.`);
      setConfirmTemplate(null);
      router.refresh();
    });
  }

  return (
    <section className="panel-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Template Library</p>
          <h2>Website templates</h2>
          <p className="auth-copy">
            Preview available storefront templates and apply one to this store.
          </p>
        </div>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DDD6FE] bg-white px-5 text-sm font-semibold text-[#6D28D9] transition hover:bg-[#F5F3FF]"
          href={storefrontPreviewUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open Storefront
        </Link>
      </div>

      {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {templates.map((template) => {
          const isActive = template.id === activeTemplateId;

          return (
            <article
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isActive ? "border-[#7C3AED] ring-2 ring-[#DDD6FE]" : "border-slate-200"
              }`}
              key={template.id}
            >
              <div className="relative h-32 overflow-hidden">
                <TemplateThumbnail template={template} />
                {isActive ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[#7C3AED] px-3 py-1 text-xs font-semibold text-white">
                    Current active
                  </span>
                ) : null}
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <h3 className="text-base font-bold text-slate-950">{template.name}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#7C3AED]">
                    {template.businessType}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{template.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setPreviewTemplate(template)}
                    type="button"
                  >
                    Preview
                  </button>
                  <Button
                    className={`h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold ${
                      isActive
                        ? "border border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]"
                        : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                    }`}
                    disabled={isPending || isActive}
                    onClick={() => setConfirmTemplate(template)}
                    type="button"
                  >
                    {isActive ? "Applied" : "Apply Template"}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {previewTemplate ? (
        <TemplatePreviewModal
          onClose={() => setPreviewTemplate(null)}
          storefrontPreviewUrl={storefrontPreviewUrl}
          template={previewTemplate}
        />
      ) : null}

      {confirmTemplate ? (
        <ApplyTemplateModal
          disabled={isPending}
          onClose={() => setConfirmTemplate(null)}
          onConfirm={applyTemplate}
          template={confirmTemplate}
        />
      ) : null}
    </section>
  );
}

// The card thumbnail is drawn from the template's own default palette and the
// section list it actually renders, so each card looks like the template it
// applies rather than a shared placeholder graphic.
function TemplateThumbnail({ template }: { template: TemplateLibraryItem }) {
  const { colors } = template;

  return (
    <div className="h-full w-full p-2" style={{ background: colors.background }}>
      <div className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-lg" style={{ background: colors.surface }}>
        <div className="flex items-center justify-between px-2 py-1" style={{ background: colors.primary }}>
          <span className="h-1.5 w-8 rounded-full" style={{ background: colors.surface }} />
          <span className="flex gap-1">
            <span className="h-1.5 w-4 rounded-full opacity-70" style={{ background: colors.surface }} />
            <span className="h-1.5 w-4 rounded-full opacity-70" style={{ background: colors.surface }} />
            <span className="h-1.5 w-4 rounded-full opacity-70" style={{ background: colors.surface }} />
          </span>
        </div>
        <div className="mx-2 flex flex-1 flex-col justify-center gap-1 rounded px-2" style={{ background: colors.secondary }}>
          <span className="h-1.5 w-1/2 rounded-full" style={{ background: colors.text, opacity: 0.75 }} />
          <span className="h-1 w-2/3 rounded-full" style={{ background: colors.text, opacity: 0.4 }} />
          <span className="mt-1 h-2.5 w-12 rounded-full" style={{ background: colors.primary }} />
        </div>
        <div className="mx-2 mb-2 grid grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((index) => (
            <span
              className="h-6 rounded"
              key={index}
              style={{ background: colors.secondary, border: `1px solid ${colors.primary}33` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  onClose,
  storefrontPreviewUrl,
  template
}: {
  onClose: () => void;
  storefrontPreviewUrl: string;
  template: TemplateLibraryItem;
}) {
  // `previewTemplate` renders the seller's real storefront with this template
  // applied, without saving it, so "Preview" shows the same output "Apply" would.
  const previewUrl = `${storefrontPreviewUrl}?previewTemplate=${encodeURIComponent(template.id)}`;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-100 grid place-items-center bg-[#20212a]/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <section className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Template Preview</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{template.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.sections.slice(0, 4).map((section) => (
              <span
                className="rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-1 text-xs font-semibold text-[#6D28D9]"
                key={section}
              >
                {section}
              </span>
            ))}
          </div>
        </div>
        <iframe
          className="mt-5 min-h-0 flex-1 w-full rounded-2xl border border-slate-200 bg-white"
          src={previewUrl}
          title={`${template.name} storefront preview`}
        />
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="h-11 cursor-pointer rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700" onClick={onClose} type="button">
            Close
          </button>
          <Link className="inline-flex h-11 items-center rounded-xl bg-[#7C3AED] px-5 text-sm font-semibold text-white" href={previewUrl} rel="noreferrer" target="_blank">
            Open in new tab
          </Link>
        </div>
      </section>
    </div>
  );
}

function ApplyTemplateModal({
  disabled,
  onClose,
  onConfirm,
  template
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  template: TemplateLibraryItem;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-110 grid place-items-center bg-[#20212a]/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !disabled && onClose()}
      role="dialog"
    >
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-950">Apply Template</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Apply <strong>{template.name}</strong> to this storefront? Your business type will stay unchanged.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="h-11 cursor-pointer rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700" disabled={disabled} onClick={onClose} type="button">
            Cancel
          </button>
          <Button className="h-11 cursor-pointer rounded-xl bg-[#7C3AED] px-5 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-60" disabled={disabled} onClick={onConfirm} type="button">
            {disabled ? "Applying..." : "Apply Template"}
          </Button>
        </div>
      </section>
    </div>
  );
}
