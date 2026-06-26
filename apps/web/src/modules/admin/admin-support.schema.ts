import { z } from "zod";

export const supportTicketStatusSchema = z.enum(["CLOSED", "OPEN", "PENDING", "RESOLVED"]);
export const supportTicketPrioritySchema = z.enum(["HIGH", "LOW", "MEDIUM", "URGENT"]);

export const replyToSupportTicketSchema = z.object({
  message: z.string().trim().min(2, "Reply must be at least 2 characters.").max(3000, "Reply must be 3000 characters or less.")
});

export const updateSupportTicketStatusSchema = z.object({
  status: supportTicketStatusSchema
});

export const updateSupportTicketPrioritySchema = z.object({
  priority: supportTicketPrioritySchema
});

export const assignSupportTicketSchema = z.object({
  assignedTo: z.string().trim().optional()
});

export type AssignSupportTicketInput = z.infer<typeof assignSupportTicketSchema>;
export type ReplyToSupportTicketInput = z.infer<typeof replyToSupportTicketSchema>;
export type UpdateSupportTicketPriorityInput = z.infer<typeof updateSupportTicketPrioritySchema>;
export type UpdateSupportTicketStatusInput = z.infer<typeof updateSupportTicketStatusSchema>;
