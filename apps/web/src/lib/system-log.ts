import { prisma, type Prisma } from "@dash/db";

export type CreateSystemLogInput = {
  level: "CRITICAL" | "ERROR" | "INFO" | "WARNING";
  message: string;
  metadata?: Prisma.InputJsonValue;
  organizationId?: string;
  source: "API" | "AUTH" | "BILLING" | "ORDER" | "PAYMENT" | "PRODUCT" | "STORE" | "SUBSCRIPTION" | "SUPPORT" | "SYSTEM";
  storeId?: string;
  userId?: string;
};

export async function createSystemLog(input: CreateSystemLogInput) {
  const data: Prisma.SystemLogUncheckedCreateInput = {
    level: input.level,
    message: input.message,
    source: input.source
  };

  if (input.metadata !== undefined) {
    data.metadata = input.metadata;
  }

  if (input.userId) {
    data.userId = input.userId;
  }

  if (input.organizationId) {
    data.organizationId = input.organizationId;
  }

  if (input.storeId) {
    data.storeId = input.storeId;
  }

  return prisma.systemLog.create({
    data
  });
}
