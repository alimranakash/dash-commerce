"use client";

import { AlertTriangle, Bug, Eye, FileText, Search, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminMobileField } from "../../../components/admin/admin-ui";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";

export type AdminSystemLogListItem = {
  createdAt: string;
  id: string;
  level: "CRITICAL" | "ERROR" | "INFO" | "WARNING";
  message: string;
  metadata: string;
  organizationName: string;
  source: "API" | "AUTH" | "BILLING" | "ORDER" | "PAYMENT" | "PRODUCT" | "STORE" | "SUBSCRIPTION" | "SUPPORT" | "SYSTEM";
  storeDomain: string;
  storeName: string;
  userEmail: string;
  userName: string;
};

type AdminLogManagementProps = {
  activeLevel: string;
  activeSource: string;
  dateRange: string;
  logs: AdminSystemLogListItem[];
  search: string;
};

const levelOptions = [
  { label: "All levels", value: "all" },
  { label: "Info", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
  { label: "Critical", value: "critical" }
];

const sourceOptions = [
  { label: "All sources", value: "all" },
  { label: "Auth", value: "auth" },
  { label: "Store", value: "store" },
  { label: "Billing", value: "billing" },
  { label: "Payment", value: "payment" },
  { label: "Subscription", value: "subscription" },
  { label: "Support", value: "support" },
  { label: "Order", value: "order" },
  { label: "Product", value: "product" },
  { label: "System", value: "system" },
  { label: "API", value: "api" }
];

export function AdminLogManagement({ activeLevel, activeSource, dateRange, logs, search }: AdminLogManagementProps) {
  const [selectedLog, setSelectedLog] = useState<AdminSystemLogListItem | null>(null);
  const hasLogs = logs.length > 0;
  const filterLabel = useMemo(() => {
    const level = levelOptions.find((option) => option.value === activeLevel)?.label ?? "All levels";
    const source = sourceOptions.find((option) => option.value === activeSource)?.label ?? "All sources";
    return `${level} / ${source}`;
  }, [activeLevel, activeSource]);

  return (
    <>
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">System Logs</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Showing {filterLabel.toLowerCase()} logs.</p>
          </div>

          <DashboardQueryForm actionPath="/admin/logs" className="grid gap-3 sm:grid-cols-2 2xl:w-[900px] 2xl:grid-cols-[minmax(220px,1fr)_140px_160px_minmax(170px,1fr)_44px]">
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={search}
              name="search"
              placeholder="Search message or source"
              type="search"
            />
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeLevel} name="level">
              {levelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeSource} name="source">
              {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={dateRange}
              name="dateRange"
              placeholder="eg. 01 Jan 2026 - 31 Jan 2026"
              type="text"
            />
            <button aria-label="Search logs" className="grid h-11 cursor-pointer place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9] sm:col-span-2 2xl:col-span-1" type="submit">
              <Search className="h-4 w-4" />
            </button>
          </DashboardQueryForm>
        </div>

        {hasLogs ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[#efeff5] bg-white lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7fa] text-[#565762]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Level</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Message</th>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Store</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff5]">
                    {logs.map((log) => (
                      <tr className="transition hover:bg-[#fbfaff]" key={log.id}>
                        <td className="px-4 py-4"><LogLevelBadge level={log.level} /></td>
                        <td className="px-4 py-4"><SourceBadge source={log.source} /></td>
                        <td className="px-4 py-4">
                          <div className="max-w-md font-semibold text-[#20212c]">{log.message}</div>
                          <div className="mt-1 text-[11px] text-[#74758a]">{log.id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#30313d]">{log.userName}</div>
                          <div className="mt-1 text-[11px] text-[#74758a]">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#30313d]">{log.storeName}</div>
                          <div className="mt-1 text-[11px] text-[#74758a]">{log.storeDomain}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{log.createdAt}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setSelectedLog(log)} title="View log" type="button">
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 lg:hidden">
              {logs.map((log) => (
                <article className="rounded-xl border border-[#efeff5] bg-white p-4" key={log.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <LogLevelBadge level={log.level} />
                    <SourceBadge source={log.source} />
                    <button className="ml-auto grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setSelectedLog(log)} title="View log" type="button">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#20212c]">{log.message}</div>
                  <div className="mt-1 break-all text-[11px] text-[#74758a]">{log.id}</div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0eff5] pt-3">
                    <AdminMobileField label="User" value={log.userName} />
                    <AdminMobileField label="Store" value={log.storeName} />
                    <AdminMobileField label="Email" value={log.userEmail} />
                    <AdminMobileField label="Domain" value={log.storeDomain} />
                    <AdminMobileField label="Date" value={log.createdAt} />
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : (
          <AdminLogsEmpty />
        )}
      </section>

      {selectedLog ? <LogDetailsDrawer log={selectedLog} onClose={() => setSelectedLog(null)} /> : null}
    </>
  );
}

function LogDetailsDrawer({ log, onClose }: { log: AdminSystemLogListItem; onClose: () => void }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-end bg-[#20212a]/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#efeff5] pb-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">System Log</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{log.source} Event</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">{log.createdAt}</p>
          </div>
          <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <DetailSection title="Log Information">
            <div className="mb-3 flex flex-wrap gap-2">
              <LogLevelBadge level={log.level} />
              <SourceBadge source={log.source} />
            </div>
            <DetailRow label="Message" value={log.message} />
            <DetailRow label="Created Date" value={log.createdAt} />
          </DetailSection>
          <DetailSection title="Metadata JSON">
            <pre className="max-h-80 overflow-auto rounded-xl border border-[#efeff5] bg-white p-4 text-xs leading-6 text-[#30313d]">{log.metadata}</pre>
          </DetailSection>
          <div className="grid gap-4 lg:grid-cols-3">
            <DetailSection title="User">
              <DetailRow label="Name" value={log.userName} />
              <DetailRow label="Email" value={log.userEmail} />
            </DetailSection>
            <DetailSection title="Organization">
              <DetailRow label="Name" value={log.organizationName} />
            </DetailSection>
            <DetailSection title="Store">
              <DetailRow label="Store" value={log.storeName} />
              <DetailRow label="Domain" value={log.storeDomain} />
            </DetailSection>
          </div>
        </div>
      </aside>
    </div>
  );
}

function LogLevelBadge({ level }: { level: AdminSystemLogListItem["level"] }) {
  const styles = {
    CRITICAL: "bg-red-50 text-red-700 ring-red-100",
    ERROR: "bg-amber-50 text-amber-700 ring-amber-100",
    INFO: "bg-blue-50 text-blue-700 ring-blue-100",
    WARNING: "bg-violet-50 text-violet-700 ring-violet-100"
  }[level];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>{titleCase(level)}</span>;
}

function SourceBadge({ source }: { source: AdminSystemLogListItem["source"] }) {
  return (
    <span className="inline-flex rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[11px] font-semibold text-[#6d3cf5] ring-1 ring-violet-100">
      {source === "API" ? "API" : titleCase(source)}
    </span>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4">
      <h3 className="m-0 text-sm font-semibold text-[#20212c]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#efeff5] py-2 last:border-b-0">
      <span className="text-xs font-medium text-[#74758a]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#30313d]">{value}</span>
    </div>
  );
}

function AdminLogsEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No logs found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">System, API, webhook, and job logs will appear here when events are recorded.</p>
    </div>
  );
}

export function logLevelIcon(level: AdminSystemLogListItem["level"]) {
  if (level === "CRITICAL") return ShieldAlert;
  if (level === "ERROR") return Bug;
  return AlertTriangle;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
