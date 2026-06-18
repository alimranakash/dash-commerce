import { prisma } from "@dash/db";
import type { PaymentMethodInput, PaymentMethodTypeValue } from "./payment.schema";

export const defaultPaymentMethods: Record<PaymentMethodTypeValue, PaymentMethodInput> = {
  COD: {
    type: "COD",
    name: "Cash on delivery",
    description: "Pay when your order is delivered.",
    instructions: "Keep the exact amount ready for delivery.",
    accountNumber: undefined,
    accountType: undefined,
    isEnabled: true,
    sortOrder: 0
  },
  BKASH_MANUAL: {
    type: "BKASH_MANUAL",
    name: "bKash manual payment",
    description: "Send payment manually through bKash.",
    instructions: "Send money to the seller bKash number, then enter the transaction ID.",
    accountNumber: undefined,
    accountType: "Personal",
    isEnabled: false,
    sortOrder: 10
  },
  NAGAD_MANUAL: {
    type: "NAGAD_MANUAL",
    name: "Nagad manual payment",
    description: "Send payment manually through Nagad.",
    instructions: "Send money to the seller Nagad number, then enter the transaction ID.",
    accountNumber: undefined,
    accountType: "Personal",
    isEnabled: false,
    sortOrder: 20
  },
  ROCKET_MANUAL: {
    type: "ROCKET_MANUAL",
    name: "Rocket manual payment",
    description: "Send payment manually through Rocket.",
    instructions: "Send money to the seller Rocket number, then enter the transaction ID.",
    accountNumber: undefined,
    accountType: "Personal",
    isEnabled: false,
    sortOrder: 30
  }
};

export async function getPaymentMethodsRecord(storeId: string) {
  return prisma.paymentMethod.findMany({
    where: {
      storeId
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });
}

export async function getEnabledPaymentMethodsRecord(storeId: string) {
  return prisma.paymentMethod.findMany({
    where: {
      storeId,
      isEnabled: true
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });
}

export async function ensureDefaultPaymentMethodsRecords(storeId: string) {
  await Promise.all(
    Object.values(defaultPaymentMethods).map((method) =>
      prisma.paymentMethod.upsert({
        where: {
          storeId_type: {
            storeId,
            type: method.type
          }
        },
        update: {},
        create: paymentCreateData(storeId, method)
      })
    )
  );

  return getPaymentMethodsRecord(storeId);
}

export async function updatePaymentMethodsRecord(storeId: string, methods: PaymentMethodInput[]) {
  await prisma.$transaction(
    methods.map((method) =>
      prisma.paymentMethod.upsert({
        where: {
          storeId_type: {
            storeId,
            type: method.type
          }
        },
        update: paymentUpdateData(method),
        create: paymentCreateData(storeId, method)
      })
    )
  );

  return getPaymentMethodsRecord(storeId);
}

function paymentCreateData(storeId: string, method: PaymentMethodInput) {
  return {
    storeId,
    ...paymentUpdateData(method)
  };
}

function paymentUpdateData(method: PaymentMethodInput) {
  return {
    type: method.type,
    name: method.name,
    description: method.description ?? null,
    instructions: method.instructions ?? null,
    accountNumber: method.accountNumber ?? null,
    accountType: method.accountType ?? null,
    isEnabled: method.isEnabled,
    sortOrder: method.sortOrder
  };
}
