import {
  assignAdminSupportTicket,
  createAdminSupportTicketReply,
  getAdminSupportAdmins,
  getAdminSupportMetrics,
  getAdminSupportTickets,
  updateAdminSupportTicketPriority,
  updateAdminSupportTicketStatus,
  type AdminSupportCategoryFilter,
  type AdminSupportPriorityFilter,
  type AdminSupportStatusFilter
} from "./admin-support.repository";
import {
  assignSupportTicketSchema,
  replyToSupportTicketSchema,
  updateSupportTicketPrioritySchema,
  updateSupportTicketStatusSchema,
  type AssignSupportTicketInput,
  type ReplyToSupportTicketInput,
  type UpdateSupportTicketPriorityInput,
  type UpdateSupportTicketStatusInput
} from "./admin-support.schema";

export { getAdminSupportAdmins, getAdminSupportMetrics, getAdminSupportTickets };
export type { AdminSupportCategoryFilter, AdminSupportPriorityFilter, AdminSupportStatusFilter };

export async function replyToSupportTicket(ticketId: string, adminUserId: string, input: ReplyToSupportTicketInput) {
  const data = replyToSupportTicketSchema.parse(input);
  return createAdminSupportTicketReply(ticketId, adminUserId, data);
}

export async function updateSupportTicketStatus(ticketId: string, input: UpdateSupportTicketStatusInput) {
  const data = updateSupportTicketStatusSchema.parse(input);
  return updateAdminSupportTicketStatus(ticketId, data);
}

export async function updateSupportTicketPriority(ticketId: string, input: UpdateSupportTicketPriorityInput) {
  const data = updateSupportTicketPrioritySchema.parse(input);
  return updateAdminSupportTicketPriority(ticketId, data);
}

export async function assignSupportTicket(ticketId: string, input: AssignSupportTicketInput) {
  const data = assignSupportTicketSchema.parse(input);
  return assignAdminSupportTicket(ticketId, data);
}
