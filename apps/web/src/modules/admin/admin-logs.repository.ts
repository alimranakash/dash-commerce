import { prisma, type Prisma } from "@dash/db";

export type AdminLogLevelFilter = "all" | "critical" | "error" | "info" | "warning";
export type AdminLogSourceFilter =
  | "all"
  | "api"
  | "auth"
  | "billing"
  | "order"
  | "payment"
  | "product"
  | "store"
  | "subscription"
  | "support"
  | "system";

const logSources = ["API", "AUTH", "BILLING", "ORDER", "PAYMENT", "PRODUCT", "STORE", "SUBSCRIPTION", "SUPPORT", "SYSTEM"] as const;

export async function getAdminLogMetrics() {
  const [totalLogs, errors, warnings, criticalIssues] = await Promise.all([
    prisma.systemLog.count(),
    prisma.systemLog.count({
      where: {
        level: "ERROR"
      }
    }),
    prisma.systemLog.count({
      where: {
        level: "WARNING"
      }
    }),
    prisma.systemLog.count({
      where: {
        level: "CRITICAL"
      }
    })
  ]);

  return {
    criticalIssues,
    errors,
    totalLogs,
    warnings
  };
}

export async function getAdminSystemLogs(filters: {
  dateRange?: string;
  level?: AdminLogLevelFilter;
  search?: string;
  source?: AdminLogSourceFilter;
}) {
  const search = filters.search?.trim();
  const where: Prisma.SystemLogWhereInput = {};
  const level = levelFilter(filters.level);
  const source = sourceFilter(filters.source);
  const dateRange = parseDateRange(filters.dateRange);

  if (level) {
    where.level = level;
  }

  if (source) {
    where.source = source;
  }

  if (dateRange) {
    where.createdAt = dateRange;
  }

  if (search) {
    const matchingSources = logSources.filter((entry) => entry.toLowerCase().includes(search.toLowerCase()));
    where.OR = [
      {
        message: {
          contains: search,
          mode: "insensitive"
        }
      },
      ...(matchingSources.length
        ? [
            {
              source: {
                in: matchingSources
              }
            }
          ]
        : [])
    ];
  }

  return prisma.systemLog.findMany({
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true
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
    take: 500,
    where
  });
}

function levelFilter(level: AdminLogLevelFilter | undefined) {
  if (!level || level === "all") {
    return undefined;
  }

  return level.toUpperCase() as "CRITICAL" | "ERROR" | "INFO" | "WARNING";
}

function sourceFilter(source: AdminLogSourceFilter | undefined) {
  if (!source || source === "all") {
    return undefined;
  }

  return source.toUpperCase() as "API" | "AUTH" | "BILLING" | "ORDER" | "PAYMENT" | "PRODUCT" | "STORE" | "SUBSCRIPTION" | "SUPPORT" | "SYSTEM";
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
