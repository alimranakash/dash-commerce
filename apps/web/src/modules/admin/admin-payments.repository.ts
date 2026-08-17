import { prisma, type Prisma } from "@dash/db";
import { BILLING_CYCLE_DAYS } from "./admin-subscriptions.schema";

export type AdminPaymentStatusFilter = "all" | "cancelled" | "failed" | "paid" | "pending" | "refunded";
export type AdminPaymentGatewayFilter = "all" | "manual" | "other" | "paddle" | "sslcommerz" | "stripe";

export async function getAdminPaymentMetrics() {
  const [paidSum, successfulPayments, pendingPayments, failedPayments] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        status: "PAID"
      }
    }),
    prisma.payment.count({
      where: {
        status: "PAID"
      }
    }),
    prisma.payment.count({
      where: {
        status: "PENDING"
      }
    }),
    prisma.payment.count({
      where: {
        status: "FAILED"
      }
    })
  ]);

  return {
    failedPayments,
    pendingPayments,
    successfulPayments,
    totalRevenue: paidSum._sum.amount?.toString() ?? "0"
  };
}

export async function getAdminPaymentRevenueSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [monthlyRevenue, annualRevenue, lifetimeRevenue, paidStores] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        paidAt: {
          gte: monthStart
        },
        status: "PAID"
      }
    }),
    prisma.payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        paidAt: {
          gte: yearStart
        },
        status: "PAID"
      }
    }),
    prisma.payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        status: "PAID"
      }
    }),
    prisma.payment.findMany({
      distinct: ["storeId"],
      select: {
        storeId: true
      },
      where: {
        status: "PAID"
      }
    })
  ]);

  const lifetime = Number(lifetimeRevenue._sum.amount ?? 0);

  return {
    annualRevenue: annualRevenue._sum.amount?.toString() ?? "0",
    arps: paidStores.length ? (lifetime / paidStores.length).toFixed(2) : "0",
    lifetimeRevenue: lifetimeRevenue._sum.amount?.toString() ?? "0",
    monthlyRevenue: monthlyRevenue._sum.amount?.toString() ?? "0"
  };
}

export async function getAdminPayments(filters: {
  dateRange?: string;
  gateway?: AdminPaymentGatewayFilter;
  search?: string;
  status?: AdminPaymentStatusFilter;
}) {
  const search = filters.search?.trim();
  const where: Prisma.PaymentWhereInput = {};
  const status = statusFilter(filters.status);
  const gateway = gatewayFilter(filters.gateway);
  const dateRange = parseDateRange(filters.dateRange);

  if (status) {
    where.status = status;
  }

  if (gateway) {
    where.gateway = gateway;
  }

  if (dateRange) {
    where.createdAt = dateRange;
  }

  if (search) {
    where.OR = [
      {
        invoiceNumber: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        paymentReference: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        store: {
          name: {
            contains: search,
            mode: "insensitive"
          }
        }
      },
      {
        organization: {
          members: {
            some: {
              user: {
                email: {
                  contains: search,
                  mode: "insensitive"
                }
              }
            }
          }
        }
      }
    ];
  }

  return prisma.payment.findMany({
    include: {
      organization: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  email: true,
                  image: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          }
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
      subscription: {
        include: {
          plan: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    where
  });
}

export async function getAdminPaymentChartData() {
  const payments = await prisma.payment.findMany({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      amount: true,
      createdAt: true,
      gateway: true,
      status: true
    }
  });

  return {
    gatewayDistribution: countBy(payments, (payment) => payment.gateway),
    revenueByMonth: revenueByMonth(payments.filter((payment) => payment.status === "PAID")),
    statusDistribution: countBy(payments, (payment) => payment.status)
  };
}

export async function updateAdminPaymentStatus(paymentId: string, status: "FAILED" | "PAID") {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      include: {
        subscription: true
      },
      where: {
        id: paymentId
      }
    });

    if (!payment) {
      throw new Error("Payment could not be found.");
    }

    if (status === "PAID") {
      if (payment.status === "PAID") {
        return payment;
      }

      if (payment.status !== "PENDING") {
        throw new Error("Only pending payments can be approved.");
      }

      const now = new Date();
      const currentPeriodEndsAt = addDays(now, BILLING_CYCLE_DAYS[payment.subscription.billingCycle]);

      await tx.subscription.update({
        data: {
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          currentPeriodEndsAt,
          currentPeriodStartsAt: now,
          status: "ACTIVE"
        },
        where: {
          id: payment.subscriptionId
        }
      });

      return tx.payment.update({
        data: {
          paidAt: now,
          rejectionReason: null,
          status: "PAID"
        },
        where: {
          id: paymentId
        }
      });
    }

    if (payment.status === "PAID") {
      throw new Error("Paid payments cannot be rejected.");
    }

    if (payment.status === "FAILED") {
      return payment;
    }

    if (payment.subscription.status !== "ACTIVE") {
      await tx.subscription.update({
        data: {
          status: "PAST_DUE"
        },
        where: {
          id: payment.subscriptionId
        }
      });
    }

    return tx.payment.update({
      data: {
        paidAt: null,
        rejectionReason: "Rejected by admin.",
        status: "FAILED"
      },
      where: {
        id: paymentId
      }
    });
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function statusFilter(status: AdminPaymentStatusFilter | undefined) {
  if (!status || status === "all") {
    return undefined;
  }

  return status.toUpperCase() as "CANCELLED" | "FAILED" | "PAID" | "PENDING" | "REFUNDED";
}

function gatewayFilter(gateway: AdminPaymentGatewayFilter | undefined) {
  if (!gateway || gateway === "all") {
    return undefined;
  }

  return gateway.toUpperCase() as "MANUAL" | "OTHER" | "PADDLE" | "SSLCOMMERZ" | "STRIPE";
}

function parseDateRange(dateRange: string | undefined): Prisma.DateTimeFilter | undefined {
  if (!dateRange?.trim()) {
    return undefined;
  }

  const [startValue, endValue] = dateRange.split(/\s+-\s+|\s+to\s+/i).map((value) => value.trim());
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return undefined;
  }

  if (!end || Number.isNaN(end.getTime())) {
    return {
      gte: start
    };
  }

  end.setHours(23, 59, 59, 999);

  return {
    gte: start,
    lte: end
  };
}

function countBy<T>(items: T[], getter: (item: T) => string) {
  return Object.entries(
    items.reduce<Record<string, number>>((accumulator, item) => {
      const key = getter(item);
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {})
  ).map(([label, value]) => ({ label, value }));
}

function revenueByMonth(payments: Array<{ amount: Prisma.Decimal; createdAt: Date }>) {
  const monthMap = new Map<string, number>();

  for (let index = 5; index >= 0; index--) {
    const date = new Date();
    date.setMonth(date.getMonth() - index);
    const key = monthKey(date);
    monthMap.set(key, 0);
  }

  for (const payment of payments) {
    const key = monthKey(payment.createdAt);

    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(payment.amount));
    }
  }

  return Array.from(monthMap.entries()).map(([label, value]) => ({ label, value }));
}

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short"
  }).format(date);
}
