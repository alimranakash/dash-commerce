import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";
import type { AudienceRule, AudienceRules } from "./audience.schema";

/**
 * Turns a saved rule set into a customer query.
 *
 * `storeId` is applied here and nowhere else is allowed to drop it. Everything
 * downstream — counting, previewing, materialising a recipient list — goes
 * through this function, so tenant scoping is one line that every path shares
 * rather than a discipline each caller has to remember.
 *
 * Async because two of the rules cannot be expressed as a `where` clause:
 * Prisma has no "related row count is at least N" filter, so those are resolved
 * to a set of customer ids first and folded back in as an `id: { in }`.
 */
export async function compileAudienceRules(
  storeId: string,
  rules: AudienceRules
): Promise<Prisma.CustomerWhereInput> {
  const clauses: Prisma.CustomerWhereInput[] = [];

  for (const rule of rules) {
    const clause = await compileRule(storeId, rule);

    if (clause) {
      clauses.push(clause);
    }
  }

  return {
    storeId,
    ...(clauses.length > 0 ? { AND: clauses } : {})
  };
}

async function compileRule(
  storeId: string,
  rule: AudienceRule
): Promise<Prisma.CustomerWhereInput | null> {
  switch (rule.type) {
    case "all":
      return null;

    case "has_ordered":
      return { orders: { some: { storeId } } };

    case "never_ordered":
      return { orders: { none: { storeId } } };

    case "min_orders":
      return { id: { in: await customerIdsWithOrderCount(storeId, rule.minOrders) } };

    case "min_spend":
      return { id: { in: await customerIdsWithSpend(storeId, rule.minSpend) } };

    case "inactive_days": {
      const cutoff = new Date(Date.now() - rule.days * 24 * 60 * 60 * 1000);

      // Deliberately requires a past order. "Has not ordered in 90 days" as a
      // win-back segment means someone who used to buy and stopped — sweeping in
      // everyone who never bought at all would make it a different segment
      // wearing the same name.
      return {
        orders: { some: { storeId } },
        NOT: { orders: { some: { createdAt: { gte: cutoff }, storeId } } }
      };
    }

    case "has_abandoned_cart":
      return { abandonedCarts: { some: { storeId } } };

    case "flag_status":
      return { flagStatus: rule.status };
  }
}

async function customerIdsWithOrderCount(storeId: string, minOrders: number) {
  const groups = await prisma.order.groupBy({
    by: ["customerId"],
    where: {
      customerId: { not: null },
      storeId
    },
    _count: { _all: true },
    having: {
      customerId: {
        _count: { gte: minOrders }
      }
    }
  });

  return groups.flatMap((group) => (group.customerId ? [group.customerId] : []));
}

async function customerIdsWithSpend(storeId: string, minSpend: number) {
  const groups = await prisma.order.groupBy({
    by: ["customerId"],
    where: {
      customerId: { not: null },
      storeId
    },
    _sum: { totalAmount: true },
    having: {
      totalAmount: {
        _sum: { gte: minSpend }
      }
    }
  });

  return groups.flatMap((group) => (group.customerId ? [group.customerId] : []));
}
