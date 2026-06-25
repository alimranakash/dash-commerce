import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "./generated/prisma/client";

const packageSrc = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageSrc, "../../..");

config({ path: resolve(repoRoot, ".env"), quiet: true });
config({ path: resolve(repoRoot, ".env.local"), override: true, quiet: true });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSignature?: string;
};

const PRISMA_CLIENT_SIGNATURE = "dash-commerce-os-inventory-v1";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL ?? "";
  const schema = getDatabaseSchema(connectionString);
  const adapter = new PrismaPg(
    {
      connectionString
    },
    schema ? { schema } : undefined
  );

  return new PrismaClient({ adapter });
}

function getDatabaseSchema(connectionString: string) {
  if (!connectionString) {
    return undefined;
  }

  return new URL(connectionString).searchParams.get("schema") ?? undefined;
}

export const prisma =
  globalForPrisma.prismaSignature === PRISMA_CLIENT_SIGNATURE && globalForPrisma.prisma
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSignature = PRISMA_CLIENT_SIGNATURE;
}

export type { PrismaClient } from "./generated/prisma/client";
export type { Prisma } from "./generated/prisma/client";
