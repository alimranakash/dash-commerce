import { AlertTriangle, Bug, FileText, ShieldAlert } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import {
  getAdminLogMetrics,
  getAdminSystemLogs,
  type AdminLogLevelFilter,
  type AdminLogSourceFilter
} from "../../../modules/admin/admin-logs.service";
import { AdminLogManagement, type AdminSystemLogListItem } from "../../../modules/admin/components/admin-log-management";

type AdminLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const activeLevel = parseLevelFilter(singleValue(params.level));
  const activeSource = parseSourceFilter(singleValue(params.source));
  const dateRange = singleValue(params.dateRange).trim();
  const [metrics, logs] = await Promise.all([
    getAdminLogMetrics(),
    getAdminSystemLogs({
      dateRange,
      level: activeLevel,
      search,
      source: activeSource
    })
  ]);

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Inspect platform audit logs, admin actions, and system events." title="Logs" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={<FileText className="h-4 w-4" />} label="Total Logs" value={metrics.totalLogs.toString()} />
        <AdminMetricCard icon={<Bug className="h-4 w-4" />} label="Errors" value={metrics.errors.toString()} tone="amber" />
        <AdminMetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Warnings" value={metrics.warnings.toString()} tone="blue" />
        <AdminMetricCard icon={<ShieldAlert className="h-4 w-4" />} label="Critical Issues" value={metrics.criticalIssues.toString()} tone="purple" />
      </div>
      <AdminLogManagement
        activeLevel={activeLevel}
        activeSource={activeSource}
        dateRange={dateRange}
        logs={logs.map(toLogListItem)}
        search={search}
      />
    </section>
  );
}

type AdminSystemLogRecord = Awaited<ReturnType<typeof getAdminSystemLogs>>[number];

function toLogListItem(log: AdminSystemLogRecord): AdminSystemLogListItem {
  return {
    createdAt: formatDateTime(log.createdAt),
    id: log.id,
    level: log.level,
    message: log.message,
    metadata: formatMetadata(log.metadata),
    organizationName: log.organization?.name ?? "No organization",
    source: log.source,
    storeDomain: log.store?.domains[0]?.domain ?? (log.store ? `${log.store.slug}.dash.com` : "No store"),
    storeName: log.store?.name ?? "No store",
    userEmail: log.user?.email ?? "No user",
    userName: log.user?.name ?? log.user?.email ?? "No user"
  };
}

function parseLevelFilter(value: string): AdminLogLevelFilter {
  const filters: AdminLogLevelFilter[] = ["all", "critical", "error", "info", "warning"];
  return filters.includes(value as AdminLogLevelFilter) ? value as AdminLogLevelFilter : "all";
}

function parseSourceFilter(value: string): AdminLogSourceFilter {
  const filters: AdminLogSourceFilter[] = ["all", "api", "auth", "billing", "order", "payment", "product", "store", "subscription", "support", "system"];
  return filters.includes(value as AdminLogSourceFilter) ? value as AdminLogSourceFilter : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatMetadata(metadata: unknown) {
  if (metadata === null || metadata === undefined) {
    return "{}";
  }

  return JSON.stringify(metadata, null, 2);
}
