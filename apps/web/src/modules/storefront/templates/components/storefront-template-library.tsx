"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyStorefrontTemplateAction } from "../template.actions";

export type TemplateLibraryItem = {
  businessType: string;
  description: string;
  id: string;
  name: string;
  previewImage: string;
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
              <div className="relative grid h-32 place-items-center overflow-hidden bg-[#F5F3FF]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(124,58,237,0.22),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.16),transparent_30%)]" />
                <span className="relative rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-[#6D28D9]">
                  {template.previewImage || "Preview image"}
                </span>
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

function TemplatePreviewModal({
  onClose,
  storefrontPreviewUrl,
  template
}: {
  onClose: () => void;
  storefrontPreviewUrl: string;
  template: TemplateLibraryItem;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-[#20212a]/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <p className="eyebrow">Template Preview</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{template.name}</h2>
        <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] text-center">
          <div>
            <p className="text-sm font-semibold text-[#6D28D9]">{template.id}</p>
            <p className="mt-2 text-sm text-slate-600">Full interactive template preview will be available soon.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="h-11 cursor-pointer rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700" onClick={onClose} type="button">
            Close
          </button>
          <Link className="inline-flex h-11 items-center rounded-xl bg-[#7C3AED] px-5 text-sm font-semibold text-white" href={storefrontPreviewUrl} rel="noreferrer" target="_blank">
            Open Storefront
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
      className="fixed inset-0 z-[110] grid place-items-center bg-[#20212a]/45 p-4"
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
