import { prisma, type Prisma } from "@dash/db";
import {
  createDefaultSubscriptionRecord,
  ensureDefaultSubscriptionsForStores
} from "../admin/admin-subscriptions.repository";
import { ensureDefaultPlans } from "../admin/admin-plans.repository";
import type { BillingSettingsInput } from "./billing.schema";

export async function getActiveBillingPlans() {
  await ensureDefaultPlans();

  return prisma.plan.findMany({
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        name: "asc"
      }
    ],
    where: {
      isActive: true
    }
  });
}

export async function getOrCreateStoreSubscription(input: {
  organizationId: string;
  storeId: string;
}) {
  await ensureDefaultSubscriptionsForStores();

  const existing = await prisma.subscription.findUnique({
    include: {
      payments: {
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      },
      plan: true
    },
    where: {
      storeId: input.storeId
    }
  });

  if (existing) {
    return existing;
  }

  await prisma.$transaction(async (tx) => {
    await createDefaultSubscriptionRecord(tx, input);
  });

  return prisma.subscription.findUniqueOrThrow({
    include: {
      payments: {
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      },
      plan: true
    },
    where: {
      storeId: input.storeId
    }
  });
}

export async function getBillingSettingsRecord() {
  const existing = await prisma.billingSetting.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.billingSetting.create({
    data: {
      paymentInstructions:
        "Send the exact plan amount, then submit your transaction ID for manual verification."
    }
  });
}

export async function updateBillingSettingsRecord(input: BillingSettingsInput) {
  const existing = await getBillingSettingsRecord();

  return prisma.billingSetting.update({
    data: nullableBillingSettings(input),
    where: {
      id: existing.id
    }
  });
}

export async function getBillingStoreUsage(storeId: string) {
  const [products, orders] = await Promise.all([
    prisma.product.count({
      where: {
        storeId
      }
    }),
    prisma.order.count({
      where: {
        storeId
      }
    })
  ]);

  return {
    aiUsage: 0,
    orders,
    products,
    staff: 1,
    storage: 0,
    stores: 1
  };
}

export async function findDuplicateManualPayment(storeId: string, paymentReference: string) {
  return prisma.payment.findFirst({
    select: {
      id: true
    },
    where: {
      paymentReference,
      status: {
        in: ["PENDING", "PAID"]
      },
      storeId
    }
  });
}

export async function createManualSubscriptionPayment(input: {
  amount: string;
  billingCycle: "MONTHLY" | "YEARLY";
  currency: string;
  organizationId: string;
  paymentMethod: string;
  paymentNote?: string | undefined;
  paymentReference: string;
  planId: string;
  senderNumber: string;
  storeId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      create: {
        billingCycle: input.billingCycle,
        organizationId: input.organizationId,
        planId: input.planId,
        status: "PAST_DUE",
        storeId: input.storeId
      },
      update: {
        billingCycle: input.billingCycle,
        cancelAtPeriodEnd: false,
        planId: input.planId,
        status: "PAST_DUE"
      },
      where: {
        storeId: input.storeId
      }
    });

    return tx.payment.create({
      data: {
        amount: input.amount,
        currency: input.currency,
        gateway: "MANUAL",
        invoiceNumber: await generateInvoiceNumber(tx),
        organizationId: input.organizationId,
        paymentMethod: input.paymentMethod,
        paymentNote: input.paymentNote ?? null,
        paymentReference: input.paymentReference,
        senderNumber: input.senderNumber,
        status: "PENDING",
        storeId: input.storeId,
        subscriptionId: subscription.id
      }
    });
  });
}

async function generateInvoiceNumber(tx: Prisma.TransactionClient) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await tx.payment.count({
    where: {
      invoiceNumber: {
        startsWith: `INV-${datePart}`
      }
    }
  });

  return `INV-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

function nullableBillingSettings(input: BillingSettingsInput) {
  return {
    bankAccountDetails: input.bankAccountDetails ?? null,
    bkashAccountType: input.bkashAccountType ?? null,
    bkashNumber: input.bkashNumber ?? null,
    nagadAccountType: input.nagadAccountType ?? null,
    nagadNumber: input.nagadNumber ?? null,
    paymentInstructions: input.paymentInstructions ?? null,
    rocketAccountType: input.rocketAccountType ?? null,
    rocketNumber: input.rocketNumber ?? null
  };
}
