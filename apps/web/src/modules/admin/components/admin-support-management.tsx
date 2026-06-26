"use client";

import { Button } from "@dash/ui";
import { Eye, MessageCircle, Search, Send, UserCheck, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import {
  assignSupportTicketAction,
  closeSupportTicketAction,
  replyToSupportTicketAction,
  updateSupportTicketPriorityAction,
  updateSupportTicketStatusAction,
  type SupportActionState
} from "../admin-support.actions";

export type AdminSupportTicketListItem = {
  assigneeEmail: string;
  assigneeId: string;
  assigneeName: string;
  category: "ACCOUNT" | "BILLING" | "COURIER" | "OTHER" | "PAYMENTS" | "STOREFRONT" | "TECHNICAL";
  closedAt: string;
  createdAt: string;
  id: string;
  message: string;
  organizationName: string;
  priority: "HIGH" | "LOW" | "MEDIUM" | "URGENT";
  replies: Array<{
    createdAt: string;
    id: string;
    isAdminReply: boolean;
    message: string;
    userEmail: string;
    userName: string;
    userRole: string;
  }>;
  status: "CLOSED" | "OPEN" | "PENDING" | "RESOLVED";
  storeDomain: string;
  storeName: string;
  subject: string;
  updatedAt: string;
  userEmail: string;
  userImage?: string | null;
  userName: string;
};

export type AdminSupportAdminOption = {
  email: string;
  id: string;
  image?: string | null;
  name: string;
};

type AdminSupportManagementProps = {
  activeCategory: string;
  activePriority: string;
  activeStatus: string;
  admins: AdminSupportAdminOption[];
  search: string;
  tickets: AdminSupportTicketListItem[];
};

type CloseTarget = {
  id: string;
  subject: string;
};

const initialActionState: SupportActionState = {
  status: "idle"
};

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" }
];

const priorityOptions = [
  { label: "All priorities", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" }
];

const categoryOptions = [
  { label: "All categories", value: "all" },
  { label: "Billing", value: "billing" },
  { label: "Technical", value: "technical" },
  { label: "Storefront", value: "storefront" },
  { label: "Payments", value: "payments" },
  { label: "Courier", value: "courier" },
  { label: "Account", value: "account" },
  { label: "Other", value: "other" }
];

export function AdminSupportManagement({
  activeCategory,
  activePriority,
  activeStatus,
  admins,
  search,
  tickets
}: AdminSupportManagementProps) {
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicketListItem | null>(null);
  const [closeTarget, setCloseTarget] = useState<CloseTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const hasTickets = tickets.length > 0;
  const filterLabel = useMemo(() => {
    const status = statusOptions.find((option) => option.value === activeStatus)?.label ?? "All statuses";
    const priority = priorityOptions.find((option) => option.value === activePriority)?.label ?? "All priorities";
    const category = categoryOptions.find((option) => option.value === activeCategory)?.label ?? "All categories";
    return `${status} / ${priority} / ${category}`;
  }, [activeCategory, activePriority, activeStatus]);

  function closeTicket(ticketId: string, onDone?: () => void) {
    startTransition(async () => {
      await closeSupportTicketAction(ticketId);
      onDone?.();
    });
  }

  return (
    <>
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Support Tickets</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Showing {filterLabel.toLowerCase()}.</p>
          </div>

          <DashboardQueryForm actionPath="/admin/support" className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_150px_150px_160px_44px] 2xl:w-[900px]">
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={search}
              name="search"
              placeholder="Search subject, user, store"
              type="search"
            />
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeStatus} name="status">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activePriority} name="priority">
              {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeCategory} name="category">
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button aria-label="Search support tickets" className="grid h-11 cursor-pointer place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9]" type="submit">
              <Search className="h-4 w-4" />
            </button>
          </DashboardQueryForm>
        </div>

        {hasTickets ? (
          <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7fa] text-[#565762]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ticket</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Store</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeff5]">
                  {tickets.map((ticket) => (
                    <tr className="transition hover:bg-[#fbfaff]" key={ticket.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#20212c]">{ticket.subject}</div>
                        <div className="mt-1 line-clamp-1 max-w-xs text-[11px] text-[#74758a]">{ticket.message}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#30313d]">{ticket.userName}</div>
                        <div className="mt-1 text-[11px] text-[#74758a]">{ticket.userEmail}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#30313d]">{ticket.storeName}</div>
                        <div className="mt-1 text-[11px] text-[#74758a]">{ticket.storeDomain}</div>
                      </td>
                      <td className="px-4 py-4"><CategoryBadge category={ticket.category} /></td>
                      <td className="px-4 py-4"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-4 py-4"><TicketStatusBadge status={ticket.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{ticket.createdAt}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setSelectedTicket(ticket)} title="View ticket" type="button">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" onClick={() => setSelectedTicket(ticket)} title="Reply" type="button">
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={ticket.status === "CLOSED"} onClick={() => setCloseTarget({ id: ticket.id, subject: ticket.subject })} title="Close ticket" type="button">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <AdminSupportEmpty />
        )}
      </section>

      {selectedTicket ? <TicketDetailsDrawer admins={admins} onClose={() => setSelectedTicket(null)} ticket={selectedTicket} /> : null}
      {closeTarget ? (
        <CloseTicketModal
          disabled={pending}
          onClose={() => setCloseTarget(null)}
          onConfirm={() => closeTicket(closeTarget.id, () => setCloseTarget(null))}
          ticket={closeTarget}
        />
      ) : null}
    </>
  );
}

function TicketDetailsDrawer({ admins, onClose, ticket }: { admins: AdminSupportAdminOption[]; onClose: () => void; ticket: AdminSupportTicketListItem }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-end bg-[#20212a]/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#efeff5] pb-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Support Ticket</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{ticket.subject}</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">{ticket.userEmail}</p>
          </div>
          <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <DetailSection title="Ticket Message">
            <p className="m-0 whitespace-pre-line text-sm leading-6 text-[#30313d]">{ticket.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
            </div>
          </DetailSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailSection title="User Info">
              <DetailRow label="Name" value={ticket.userName} />
              <DetailRow label="Email" value={ticket.userEmail} />
              <DetailRow label="Organization" value={ticket.organizationName} />
            </DetailSection>
            <DetailSection title="Store Info">
              <DetailRow label="Store" value={ticket.storeName} />
              <DetailRow label="Domain" value={ticket.storeDomain} />
              <DetailRow label="Updated" value={ticket.updatedAt} />
            </DetailSection>
          </div>

          <DetailSection title="Admin Controls">
            <div className="grid gap-3 md:grid-cols-3">
              <form action={updateSupportTicketStatusAction.bind(null, ticket.id)} className="grid gap-2">
                <span className="text-xs font-semibold text-[#74758a]">Status</span>
                <div className="flex gap-2">
                  <select className="h-10 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3 text-xs outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={ticket.status} name="status">
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                  <button className="h-10 cursor-pointer rounded-lg bg-[#7c3aed] px-3 text-xs font-semibold text-white hover:bg-[#6d28d9]" type="submit">Save</button>
                </div>
              </form>
              <form action={updateSupportTicketPriorityAction.bind(null, ticket.id)} className="grid gap-2">
                <span className="text-xs font-semibold text-[#74758a]">Priority</span>
                <div className="flex gap-2">
                  <select className="h-10 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3 text-xs outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={ticket.priority} name="priority">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  <button className="h-10 cursor-pointer rounded-lg bg-[#7c3aed] px-3 text-xs font-semibold text-white hover:bg-[#6d28d9]" type="submit">Save</button>
                </div>
              </form>
              <form action={assignSupportTicketAction.bind(null, ticket.id)} className="grid gap-2">
                <span className="text-xs font-semibold text-[#74758a]">Assignee</span>
                <div className="flex gap-2">
                  <select className="h-10 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3 text-xs outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={ticket.assigneeId} name="assignedTo">
                    <option value="">Unassigned</option>
                    {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}
                  </select>
                  <button className="h-10 cursor-pointer rounded-lg bg-[#7c3aed] px-3 text-xs font-semibold text-white hover:bg-[#6d28d9]" type="submit">Assign</button>
                </div>
              </form>
            </div>
          </DetailSection>

          <DetailSection title="Replies Thread">
            <div className="grid gap-3">
              {ticket.replies.length ? (
                ticket.replies.map((reply) => (
                  <div className={`rounded-xl border p-4 ${reply.isAdminReply ? "border-[#ddd6fe] bg-[#f8f7ff]" : "border-[#efeff5] bg-white"}`} key={reply.id}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-semibold text-[#20212c]">{reply.userName}</div>
                      <span className="text-[11px] text-[#74758a]">{reply.createdAt}</span>
                    </div>
                    <p className="m-0 mt-2 whitespace-pre-line text-sm leading-6 text-[#565762]">{reply.message}</p>
                  </div>
                ))
              ) : (
                <p className="m-0 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-5 text-center text-sm text-[#74758a]">No replies yet.</p>
              )}
            </div>
          </DetailSection>

          <ReplyForm ticketId={ticket.id} />
        </div>
      </aside>
    </div>
  );
}

function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, isPending] = useActionState(replyToSupportTicketAction.bind(null, ticketId), initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      const form = document.getElementById(`reply-form-${ticketId}`) as HTMLFormElement | null;
      form?.reset();
    }
  }, [state.status, ticketId]);

  return (
    <form action={formAction} className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4" id={`reply-form-${ticketId}`}>
      <h3 className="m-0 text-sm font-semibold text-[#20212c]">Reply to ticket</h3>
      <textarea
        className="mt-3 min-h-28 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 py-3 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
        name="message"
        placeholder="Write a helpful admin reply..."
      />
      {state.fieldErrors?.message ? <p className="m-0 mt-2 text-xs font-medium text-red-600">{state.fieldErrors.message}</p> : null}
      {state.message ? <p className={`m-0 mt-2 text-xs font-medium ${state.status === "success" ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p> : null}
      <div className="mt-3 flex justify-end">
        <Button className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
          <Send className="h-4 w-4" />
          {isPending ? "Sending..." : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}

function CloseTicketModal({ disabled, onClose, onConfirm, ticket }: { disabled: boolean; onClose: () => void; onConfirm: () => void; ticket: CloseTarget }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] grid place-items-center bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <X className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">Close Ticket</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          Are you sure you want to close “{ticket.subject}”? You can reopen it later by changing the status.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={disabled} onClick={onClose} type="button">Cancel</button>
          <Button className="h-11 cursor-pointer rounded-lg bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60" disabled={disabled} onClick={onConfirm} type="button">
            {disabled ? "Closing..." : "Close Ticket"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TicketStatusBadge({ status }: { status: AdminSupportTicketListItem["status"] }) {
  const styles = {
    CLOSED: "bg-slate-50 text-slate-600 ring-slate-100",
    OPEN: "bg-blue-50 text-blue-700 ring-blue-100",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-100",
    RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-100"
  }[status];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>{titleCase(status)}</span>;
}

function PriorityBadge({ priority }: { priority: AdminSupportTicketListItem["priority"] }) {
  const styles = {
    HIGH: "bg-orange-50 text-orange-700 ring-orange-100",
    LOW: "bg-slate-50 text-slate-600 ring-slate-100",
    MEDIUM: "bg-violet-50 text-violet-700 ring-violet-100",
    URGENT: "bg-red-50 text-red-700 ring-red-100"
  }[priority];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>{titleCase(priority)}</span>;
}

function CategoryBadge({ category }: { category: AdminSupportTicketListItem["category"] }) {
  return (
    <span className="inline-flex rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[11px] font-semibold text-[#6d3cf5] ring-1 ring-violet-100">
      {titleCase(category)}
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

function AdminSupportEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <UserCheck className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No support tickets found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">Merchant support requests will appear here when tickets are created.</p>
    </div>
  );
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
