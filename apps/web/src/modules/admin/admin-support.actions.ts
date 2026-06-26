"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePlatformAdmin } from "./admin.auth";
import {
  assignSupportTicket,
  replyToSupportTicket,
  updateSupportTicketPriority,
  updateSupportTicketStatus
} from "./admin-support.service";

export type SupportActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
};

export async function replyToSupportTicketAction(ticketId: string, _state: SupportActionState, formData: FormData): Promise<SupportActionState> {
  const admin = await requirePlatformAdmin();

  try {
    await replyToSupportTicket(ticketId, admin.id, {
      message: String(formData.get("message") ?? "")
    });
  } catch (error) {
    return supportErrorState(error);
  }

  revalidatePath("/admin/support");
  return {
    message: "Reply sent.",
    status: "success"
  };
}

export async function updateSupportTicketStatusAction(ticketId: string, formData: FormData) {
  await requirePlatformAdmin();
  await updateSupportTicketStatus(ticketId, {
    status: String(formData.get("status") ?? "OPEN") as "CLOSED" | "OPEN" | "PENDING" | "RESOLVED"
  });
  revalidatePath("/admin/support");
}

export async function updateSupportTicketPriorityAction(ticketId: string, formData: FormData) {
  await requirePlatformAdmin();
  await updateSupportTicketPriority(ticketId, {
    priority: String(formData.get("priority") ?? "MEDIUM") as "HIGH" | "LOW" | "MEDIUM" | "URGENT"
  });
  revalidatePath("/admin/support");
}

export async function assignSupportTicketAction(ticketId: string, formData: FormData) {
  await requirePlatformAdmin();
  await assignSupportTicket(ticketId, {
    assignedTo: String(formData.get("assignedTo") ?? "") || undefined
  });
  revalidatePath("/admin/support");
}

export async function closeSupportTicketAction(ticketId: string) {
  await requirePlatformAdmin();
  await updateSupportTicketStatus(ticketId, {
    status: "CLOSED"
  });
  revalidatePath("/admin/support");
}

function supportErrorState(error: unknown): SupportActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])),
      message: "Please fix the highlighted support fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Support operation failed.",
    status: "error"
  };
}
