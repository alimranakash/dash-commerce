import { prisma, type Prisma } from "@dash/db";
import type {
  AssignSupportTicketInput,
  ReplyToSupportTicketInput,
  UpdateSupportTicketPriorityInput,
  UpdateSupportTicketStatusInput
} from "./admin-support.schema";

export type AdminSupportStatusFilter = "all" | "closed" | "open" | "pending" | "resolved";
export type AdminSupportPriorityFilter = "all" | "high" | "low" | "medium" | "urgent";
export type AdminSupportCategoryFilter = "account" | "all" | "billing" | "courier" | "other" | "payments" | "storefront" | "technical";

export async function getAdminSupportMetrics() {
  const [openTickets, pendingTickets, resolvedTickets, urgentTickets] = await Promise.all([
    prisma.supportTicket.count({
      where: {
        status: "OPEN"
      }
    }),
    prisma.supportTicket.count({
      where: {
        status: "PENDING"
      }
    }),
    prisma.supportTicket.count({
      where: {
        status: "RESOLVED"
      }
    }),
    prisma.supportTicket.count({
      where: {
        priority: "URGENT",
        status: {
          notIn: ["CLOSED", "RESOLVED"]
        }
      }
    })
  ]);

  return {
    openTickets,
    pendingTickets,
    resolvedTickets,
    urgentTickets
  };
}

export async function getAdminSupportAdmins() {
  return prisma.user.findMany({
    orderBy: [
      {
        name: "asc"
      },
      {
        email: "asc"
      }
    ],
    select: {
      email: true,
      id: true,
      image: true,
      name: true
    },
    where: {
      role: "ADMIN"
    }
  });
}

export async function getAdminSupportTickets(filters: {
  category?: AdminSupportCategoryFilter;
  priority?: AdminSupportPriorityFilter;
  search?: string;
  status?: AdminSupportStatusFilter;
}) {
  const search = filters.search?.trim();
  const where: Prisma.SupportTicketWhereInput = {};
  const status = statusFilter(filters.status);
  const priority = priorityFilter(filters.priority);
  const category = categoryFilter(filters.category);

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      {
        subject: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        user: {
          email: {
            contains: search,
            mode: "insensitive"
          }
        }
      },
      {
        store: {
          name: {
            contains: search,
            mode: "insensitive"
          }
        }
      }
    ];
  }

  return prisma.supportTicket.findMany({
    include: {
      assignee: {
        select: {
          email: true,
          id: true,
          image: true,
          name: true
        }
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      replies: {
        include: {
          user: {
            select: {
              email: true,
              id: true,
              image: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      store: {
        include: {
          domains: {
            orderBy: [
              {
                isPrimary: "desc"
              },
              {
                createdAt: "asc"
              }
            ],
            take: 1
          }
        }
      },
      user: {
        select: {
          email: true,
          id: true,
          image: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    where
  });
}

export async function createAdminSupportTicketReply(ticketId: string, adminUserId: string, input: ReplyToSupportTicketInput) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: {
        id: ticketId
      },
      select: {
        status: true
      }
    });

    if (!ticket) {
      throw new Error("Support ticket could not be found.");
    }

    const reply = await tx.supportTicketReply.create({
      data: {
        isAdminReply: true,
        message: input.message,
        ticketId,
        userId: adminUserId
      }
    });

    if (!["CLOSED", "RESOLVED"].includes(ticket.status)) {
      await tx.supportTicket.update({
        data: {
          status: "PENDING"
        },
        where: {
          id: ticketId
        }
      });
    }

    return reply;
  });
}

export async function updateAdminSupportTicketStatus(ticketId: string, input: UpdateSupportTicketStatusInput) {
  return prisma.supportTicket.update({
    data: {
      closedAt: ["CLOSED", "RESOLVED"].includes(input.status) ? new Date() : null,
      status: input.status
    },
    where: {
      id: ticketId
    }
  });
}

export async function updateAdminSupportTicketPriority(ticketId: string, input: UpdateSupportTicketPriorityInput) {
  return prisma.supportTicket.update({
    data: {
      priority: input.priority
    },
    where: {
      id: ticketId
    }
  });
}

export async function assignAdminSupportTicket(ticketId: string, input: AssignSupportTicketInput) {
  return prisma.supportTicket.update({
    data: {
      assignedTo: input.assignedTo || null
    },
    where: {
      id: ticketId
    }
  });
}

function statusFilter(status: AdminSupportStatusFilter | undefined) {
  if (!status || status === "all") {
    return undefined;
  }

  return status.toUpperCase() as "CLOSED" | "OPEN" | "PENDING" | "RESOLVED";
}

function priorityFilter(priority: AdminSupportPriorityFilter | undefined) {
  if (!priority || priority === "all") {
    return undefined;
  }

  return priority.toUpperCase() as "HIGH" | "LOW" | "MEDIUM" | "URGENT";
}

function categoryFilter(category: AdminSupportCategoryFilter | undefined) {
  if (!category || category === "all") {
    return undefined;
  }

  return category.toUpperCase() as "ACCOUNT" | "BILLING" | "COURIER" | "OTHER" | "PAYMENTS" | "STOREFRONT" | "TECHNICAL";
}
