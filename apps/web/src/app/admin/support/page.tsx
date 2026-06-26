import { AlertCircle, CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import {
  getAdminSupportAdmins,
  getAdminSupportMetrics,
  getAdminSupportTickets,
  type AdminSupportCategoryFilter,
  type AdminSupportPriorityFilter,
  type AdminSupportStatusFilter
} from "../../../modules/admin/admin-support.service";
import {
  AdminSupportManagement,
  type AdminSupportAdminOption,
  type AdminSupportTicketListItem
} from "../../../modules/admin/components/admin-support-management";

type AdminSupportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSupportPage({ searchParams }: AdminSupportPageProps) {
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const activeStatus = parseStatusFilter(singleValue(params.status));
  const activePriority = parsePriorityFilter(singleValue(params.priority));
  const activeCategory = parseCategoryFilter(singleValue(params.category));
  const [metrics, admins, tickets] = await Promise.all([
    getAdminSupportMetrics(),
    getAdminSupportAdmins(),
    getAdminSupportTickets({
      category: activeCategory,
      priority: activePriority,
      search,
      status: activeStatus
    })
  ]);

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Handle merchant support requests and escalation workflows." title="Support" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={<MessageCircle className="h-4 w-4" />} label="Open Tickets" value={metrics.openTickets.toString()} tone="blue" />
        <AdminMetricCard icon={<Clock3 className="h-4 w-4" />} label="Pending Tickets" value={metrics.pendingTickets.toString()} tone="amber" />
        <AdminMetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved Tickets" value={metrics.resolvedTickets.toString()} tone="green" />
        <AdminMetricCard icon={<AlertCircle className="h-4 w-4" />} label="Urgent Tickets" value={metrics.urgentTickets.toString()} tone="purple" />
      </div>
      <AdminSupportManagement
        activeCategory={activeCategory}
        activePriority={activePriority}
        activeStatus={activeStatus}
        admins={admins.map(toAdminOption)}
        search={search}
        tickets={tickets.map(toTicketListItem)}
      />
    </section>
  );
}

type AdminSupportTicketRecord = Awaited<ReturnType<typeof getAdminSupportTickets>>[number];

function toTicketListItem(ticket: AdminSupportTicketRecord): AdminSupportTicketListItem {
  return {
    assigneeEmail: ticket.assignee?.email ?? "Unassigned",
    assigneeId: ticket.assignedTo ?? "",
    assigneeName: ticket.assignee?.name ?? ticket.assignee?.email ?? "Unassigned",
    category: ticket.category,
    closedAt: formatDate(ticket.closedAt),
    createdAt: formatDate(ticket.createdAt),
    id: ticket.id,
    message: ticket.message,
    organizationName: ticket.organization?.name ?? "No organization",
    priority: ticket.priority,
    replies: ticket.replies.map((reply) => ({
      createdAt: formatDateTime(reply.createdAt),
      id: reply.id,
      isAdminReply: reply.isAdminReply,
      message: reply.message,
      userEmail: reply.user.email,
      userName: reply.user.name ?? reply.user.email,
      userRole: reply.user.role
    })),
    status: ticket.status,
    storeDomain: ticket.store?.domains[0]?.domain ?? (ticket.store ? `${ticket.store.slug}.dash.com` : "No store"),
    storeName: ticket.store?.name ?? "No store",
    subject: ticket.subject,
    updatedAt: formatDateTime(ticket.updatedAt),
    userEmail: ticket.user.email,
    userImage: ticket.user.image,
    userName: ticket.user.name ?? ticket.user.email
  };
}

function toAdminOption(admin: Awaited<ReturnType<typeof getAdminSupportAdmins>>[number]): AdminSupportAdminOption {
  return {
    email: admin.email,
    id: admin.id,
    image: admin.image,
    name: admin.name ?? admin.email
  };
}

function parseStatusFilter(value: string): AdminSupportStatusFilter {
  const filters: AdminSupportStatusFilter[] = ["all", "closed", "open", "pending", "resolved"];
  return filters.includes(value as AdminSupportStatusFilter) ? value as AdminSupportStatusFilter : "all";
}

function parsePriorityFilter(value: string): AdminSupportPriorityFilter {
  const filters: AdminSupportPriorityFilter[] = ["all", "high", "low", "medium", "urgent"];
  return filters.includes(value as AdminSupportPriorityFilter) ? value as AdminSupportPriorityFilter : "all";
}

function parseCategoryFilter(value: string): AdminSupportCategoryFilter {
  const filters: AdminSupportCategoryFilter[] = ["account", "all", "billing", "courier", "other", "payments", "storefront", "technical"];
  return filters.includes(value as AdminSupportCategoryFilter) ? value as AdminSupportCategoryFilter : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(date);
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
