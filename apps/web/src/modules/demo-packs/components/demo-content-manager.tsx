"use client";

import { AlertTriangle, Boxes, FileText, Layers3, Package, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DemoContentOverview } from "../manager.service";

type DemoContentManagerProps = {
  overview: DemoContentOverview;
  reinstallAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  resetAction: (formData: FormData) => Promise<void>;
};

type DemoAction = {
  action: (formData: FormData) => Promise<void>;
  buttonClassName: string;
  description: string;
  icon: ReactNode;
  label: string;
  title: string;
};

export function DemoContentManager({
  overview,
  reinstallAction,
  removeAction,
  resetAction
}: DemoContentManagerProps) {
  const [selectedAction, setSelectedAction] = useState<DemoAction | null>(null);
  const actions: DemoAction[] = [
    {
      action: reinstallAction,
      buttonClassName: "bg-[#7548f5] text-white hover:bg-[#6436e8]",
      description: "Remove the current demo rows, then import the same demo pack again.",
      icon: <RefreshCcw className="h-4 w-4" />,
      label: "Reinstall Demo Pack",
      title: "Reinstall Demo Pack"
    },
    {
      action: resetAction,
      buttonClassName: "bg-[#111827] text-white hover:bg-[#0f172a]",
      description: "Restore tracked demo products and categories to the original pack state.",
      icon: <RotateCcw className="h-4 w-4" />,
      label: "Reset Demo Content",
      title: "Reset Demo Content"
    },
    {
      action: removeAction,
      buttonClassName: "bg-[#ef4444] text-white hover:bg-[#dc2626]",
      description: "Delete tracked demo content only. Your own products and business data stay safe.",
      icon: <Trash2 className="h-4 w-4" />,
      label: "Remove Demo Content",
      title: "Remove Demo Content"
    }
  ];

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#e6e3f4] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#7548f5]">Current demo pack</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#171821]">{overview.demoPackName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737582]">{overview.demoPackDescription}</p>
            </div>
            <span className="rounded-full bg-[#f3f0ff] px-3 py-1 text-xs font-semibold text-[#6d3cf5]">
              v{overview.demoPackVersion}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoTile label="Business Type" value={overview.businessType} />
            <InfoTile label="Website Template" value={overview.activeTemplate} />
            <InfoTile label="Demo Pack ID" value={overview.demoPackId} />
            <InfoTile label="Installed Date" value={formatDate(overview.installedAt)} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#e6e3f4] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#171821]">Demo Content Totals</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric icon={<Package className="h-5 w-5" />} label="Demo Products" value={overview.totals.products} />
            <Metric icon={<Boxes className="h-5 w-5" />} label="Demo Categories" value={overview.totals.categories} />
            <Metric icon={<Layers3 className="h-5 w-5" />} label="Demo Collections" value={overview.totals.collections} />
            <Metric icon={<FileText className="h-5 w-5" />} label="Demo Pages" value={overview.totals.pages} />
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-[#e6e3f4] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#171821]">Demo Content Actions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737582]">
              These actions only target content imported by the demo pack. Orders, customers, billing, uploaded media, and user-created products are not removed.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {actions.map((item) => (
            <button
              className="cursor-pointer rounded-xl border border-[#e6e3f4] bg-[#fbfaff] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#cfc7ff]"
              key={item.label}
              onClick={() => setSelectedAction(item)}
              type="button"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#7548f5] shadow-sm">
                {item.icon}
              </span>
              <span className="mt-4 block text-sm font-semibold text-[#171821]">{item.label}</span>
              <span className="mt-2 block text-xs leading-5 text-[#737582]">{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedAction ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#111827]/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff4e5] text-[#b45309]">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#171821]">{selectedAction.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#626472]">
                  This action only affects demo content. Your own products and business data will not be deleted.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="h-10 cursor-pointer rounded-lg border border-[#dcd9e8] bg-white px-4 text-sm font-semibold text-[#555762] hover:bg-[#f8f7fc]"
                onClick={() => setSelectedAction(null)}
                type="button"
              >
                Cancel
              </button>
              <form action={selectedAction.action}>
                <button
                  className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${selectedAction.buttonClassName}`}
                  type="submit"
                >
                  {selectedAction.icon}
                  Confirm
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#ece9f8] bg-[#fbfaff] p-4">
      <p className="m-0 text-xs font-medium text-[#858691]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#292a35]">{value}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#ece9f8] bg-[#fbfaff] p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#7548f5]">{icon}</span>
        <div>
          <p className="m-0 text-xs font-medium text-[#858691]">{label}</p>
          <p className="m-0 mt-1 text-xl font-semibold text-[#171821]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not installed";

  const [date] = value.split("T");
  return date ?? "Not installed";
}
