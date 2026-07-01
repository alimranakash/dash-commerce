import { prisma, type Prisma } from "@dash/db";
import { ensureDemoContentSchema, getDatabaseSchemaName } from "./demo-schema";
import { getDemoPackById, getDemoPackIdForBusinessType } from "./registry";
import { seedDemoPack } from "./seeder";

type StoreDemoRow = {
  activeDemoPack: string | null;
  activeTemplate: string | null;
  businessType: string | null;
  demoPackInstalledAt: Date | null;
};

type CountRow = {
  count: bigint | number | string;
};

type IdRow = {
  id: string;
};

type DemoSettingsSnapshot = {
  storeSetting: {
    businessAddress: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    facebookUrl: string | null;
    faviconUrl: string | null;
    instagramUrl: string | null;
    logoUrl: string | null;
    supportPhone: string | null;
    tagline: string | null;
    whatsappNumber: string | null;
  } | null;
  themeSetting: {
    announcementText: string | null;
    featuredSectionTitle: string;
    heroImageUrl: string | null;
    heroSubtitle: string | null;
    heroTitle: string;
    primaryColor: string;
    secondaryColor: string | null;
    themeName: string;
  } | null;
};

export type DemoContentOverview = {
  activeTemplate: string;
  businessType: string;
  demoPackDescription: string;
  demoPackId: string;
  demoPackName: string;
  demoPackVersion: string;
  installedAt: string | null;
  totals: {
    categories: number;
    collections: number;
    pages: number;
    products: number;
  };
};

export async function getDemoContentOverview(storeId: string): Promise<DemoContentOverview> {
  await ensureDemoContentSchema(prisma);
  const storeDemo = await getStoreDemoState(storeId);
  const demoPackId = resolveDemoPackId(storeDemo);
  const demoPack = getDemoPackById(demoPackId);
  const [products, categories] = await Promise.all([
    countDemoProducts(storeId, demoPack.id),
    countDemoCategories(storeId, demoPack.id)
  ]);

  return {
    activeTemplate: storeDemo.activeTemplate ?? demoPack.compatibleTemplate,
    businessType: storeDemo.businessType ?? demoPack.businessType,
    demoPackDescription: demoPack.description,
    demoPackId: demoPack.id,
    demoPackName: demoPack.name,
    demoPackVersion: demoPack.version,
    installedAt: storeDemo.demoPackInstalledAt?.toISOString() ?? null,
    totals: {
      categories,
      collections: demoPack.content.collections.length,
      pages: demoPack.content.pages.length,
      products
    }
  };
}

export async function reinstallDemoPackForStore(storeId: string, organizationId: string) {
  await prisma.$transaction(async (tx) => {
    await ensureDemoContentSchema(tx);
    const demoPackId = resolveDemoPackId(await getStoreDemoState(storeId, tx));
    const settingsSnapshot = await getSettingsSnapshot(tx, storeId);
    await removeDemoContent(tx, storeId, demoPackId);
    await seedDemoPack(tx, {
      demoPackId,
      organizationId,
      storeId
    });
    await restoreSettingsSnapshot(tx, storeId, settingsSnapshot);
  });
}

export async function resetDemoContentForStore(storeId: string, organizationId: string) {
  await reinstallDemoPackForStore(storeId, organizationId);
}

export async function removeDemoContentForStore(storeId: string) {
  await prisma.$transaction(async (tx) => {
    await ensureDemoContentSchema(tx);
    const demoPackId = resolveDemoPackId(await getStoreDemoState(storeId, tx));
    await removeDemoContent(tx, storeId, demoPackId);
    await tx.$executeRawUnsafe(
      `UPDATE "${getDatabaseSchemaName()}"."Store" SET "demoPackInstalledAt" = NULL WHERE "id" = $1`,
      storeId
    );
  });
}

async function removeDemoContent(tx: Prisma.TransactionClient, storeId: string, demoPackId: string) {
  const demoProducts = await tx.$queryRawUnsafe<IdRow[]>(
    `SELECT "id" FROM "${getDatabaseSchemaName()}"."Product" WHERE "storeId" = $1 AND "isDemoContent" = TRUE AND "demoPackId" = $2`,
    storeId,
    demoPackId
  );
  const productIds = demoProducts.map((product) => product.id);

  if (productIds.length > 0) {
    await tx.productImage.deleteMany({
      where: {
        productId: {
          in: productIds
        }
      }
    });
    await tx.product.deleteMany({
      where: {
        id: {
          in: productIds
        },
        storeId
      }
    });
  }

  const demoCategories = await tx.$queryRawUnsafe<IdRow[]>(
    `SELECT "id" FROM "${getDatabaseSchemaName()}"."Category" WHERE "storeId" = $1 AND "isDemoContent" = TRUE AND "demoPackId" = $2`,
    storeId,
    demoPackId
  );
  const categoryIds = demoCategories.map((category) => category.id);

  if (categoryIds.length > 0) {
    await tx.category.deleteMany({
      where: {
        id: {
          in: categoryIds
        },
        storeId
      }
    });
  }
}

async function getSettingsSnapshot(tx: Prisma.TransactionClient, storeId: string): Promise<DemoSettingsSnapshot> {
  const [storeSetting, themeSetting] = await Promise.all([
    tx.storeSetting.findUnique({
      select: {
        businessAddress: true,
        contactEmail: true,
        contactPhone: true,
        facebookUrl: true,
        faviconUrl: true,
        instagramUrl: true,
        logoUrl: true,
        supportPhone: true,
        tagline: true,
        whatsappNumber: true
      },
      where: {
        storeId
      }
    }),
    tx.themeSetting.findUnique({
      select: {
        announcementText: true,
        featuredSectionTitle: true,
        heroImageUrl: true,
        heroSubtitle: true,
        heroTitle: true,
        primaryColor: true,
        secondaryColor: true,
        themeName: true
      },
      where: {
        storeId
      }
    })
  ]);

  return {
    storeSetting,
    themeSetting
  };
}

async function restoreSettingsSnapshot(tx: Prisma.TransactionClient, storeId: string, snapshot: DemoSettingsSnapshot) {
  if (snapshot.storeSetting) {
    await tx.storeSetting.upsert({
      create: {
        ...snapshot.storeSetting,
        storeId
      },
      update: snapshot.storeSetting,
      where: {
        storeId
      }
    });
  }

  if (snapshot.themeSetting) {
    await tx.themeSetting.upsert({
      create: {
        ...snapshot.themeSetting,
        storeId
      },
      update: snapshot.themeSetting,
      where: {
        storeId
      }
    });
  }
}

async function getStoreDemoState(storeId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const rows = await tx.$queryRawUnsafe<StoreDemoRow[]>(
    `SELECT "activeDemoPack", "activeTemplate", "businessType", "demoPackInstalledAt" FROM "${getDatabaseSchemaName()}"."Store" WHERE "id" = $1 LIMIT 1`,
    storeId
  );

  if (!rows[0]) {
    throw new Error("Store not found.");
  }

  return rows[0];
}

async function countDemoProducts(storeId: string, demoPackId: string) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count FROM "${getDatabaseSchemaName()}"."Product" WHERE "storeId" = $1 AND "isDemoContent" = TRUE AND "demoPackId" = $2`,
    storeId,
    demoPackId
  );

  return normalizeCount(rows[0]?.count);
}

async function countDemoCategories(storeId: string, demoPackId: string) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count FROM "${getDatabaseSchemaName()}"."Category" WHERE "storeId" = $1 AND "isDemoContent" = TRUE AND "demoPackId" = $2`,
    storeId,
    demoPackId
  );

  return normalizeCount(rows[0]?.count);
}

function resolveDemoPackId(storeDemo: StoreDemoRow) {
  return storeDemo.activeDemoPack ?? getDemoPackIdForBusinessType(storeDemo.businessType);
}

function normalizeCount(value: CountRow["count"] | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);

  return 0;
}
