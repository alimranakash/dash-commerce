import { prisma } from "@dash/db";
import { getPlatformRootDomain } from "../../lib/host-routing";
import { ensureDefaultPlans } from "../admin/admin-plans.repository";
import { getDemoPackIdForBusinessType } from "../demo-packs/registry";
import { seedDemoPack } from "../demo-packs/seeder";
import { createDefaultSubscriptionRecord } from "../admin/admin-subscriptions.repository";
import { createDefaultShippingRecords } from "../shipping/shipping.repository";
import {
  DEFAULT_FEATURED_TITLE,
  DEFAULT_HERO_TITLE,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_THEME_NAME
} from "../settings/settings.repository";
import { connectStoreOSForStore } from "../storeos/storeos.service";
import { getStorefrontTemplateById } from "../storefront/templates/registry";
import { getTemplateIdForBusinessType } from "../storefront/templates/template-mapping";
import { onboardingSchema, type OnboardingInput } from "./schemas";

export async function createOnboardingWorkspace(userId: string, input: OnboardingInput) {
  const data = onboardingSchema.parse(input);
  const storeSlug = data.storeSlug;
  const activeTemplate = getTemplateIdForBusinessType(data.businessType);
  const activeDemoPack = getDemoPackIdForBusinessType(data.businessType);
  const storefrontTemplate = getStorefrontTemplateById(activeTemplate);
  const organizationSlug = await createUniqueOrganizationSlug(data.organizationName);
  const existingMembership = await prisma.organizationMember.findFirst({
    where: {
      userId
    },
    select: {
      id: true
    }
  });

  if (existingMembership) {
    throw new Error("This user already belongs to an organization.");
  }

  const existingStore = await prisma.store.findUnique({
    where: {
      slug: storeSlug
    },
    select: {
      id: true
    }
  });

  if (existingStore) {
    throw new Error("This store slug is already taken.");
  }

  await ensureDefaultPlans();

  const workspace = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: data.organizationName,
        slug: organizationSlug,
        members: {
          create: {
            userId,
            role: "OWNER"
          }
        },
        stores: {
          create: {
            name: data.storeName,
            slug: storeSlug,
            businessType: data.businessType,
            country: data.country,
            currency: data.currency,
            timezone: data.timezone,
            domains: {
              create: {
                // Must follow the deployment's real root domain: this row is what
                // request routing matches and what authorises the subdomain's TLS
                // certificate, so a hardcoded one would be unreachable in production.
                domain: `${storeSlug}.${getPlatformRootDomain()}`,
                type: "DASH_SUBDOMAIN",
                isPrimary: true
              }
            },
            setting: {
              create: {}
            },
            themeSetting: {
              create: {
                themeName: DEFAULT_THEME_NAME,
                primaryColor: storefrontTemplate.defaultColors.primary || DEFAULT_PRIMARY_COLOR,
                secondaryColor: storefrontTemplate.defaultColors.secondary,
                heroTitle: `${DEFAULT_HERO_TITLE} at ${data.storeName}`,
                featuredSectionTitle: DEFAULT_FEATURED_TITLE
              }
            },
            paymentMethods: {
              create: {
                type: "COD",
                name: "Cash on delivery",
                description: "Pay when your order is delivered.",
                instructions: "Keep the exact amount ready for delivery.",
                isEnabled: true,
                sortOrder: 0
              }
            }
          }
        }
      },
      include: {
        stores: {
          include: {
            domains: true
          }
        }
      }
    });
    const store = organization.stores[0];

    if (!store) {
      throw new Error("Store setup failed.");
    }

    await tx.$executeRawUnsafe(
      `UPDATE "${getDatabaseSchemaName()}"."Store" SET "activeTemplate" = $1 WHERE "id" = $2`,
      activeTemplate,
      store.id
    );
    // Before the demo pack, not after: the seeder caps how many products it
    // imports at the plan's product limit, and it can only read that limit once
    // the subscription row exists in this transaction.
    await createDefaultSubscriptionRecord(tx, {
      organizationId: organization.id,
      storeId: store.id
    });
    await seedDemoPack(tx, {
      demoPackId: activeDemoPack,
      organizationId: organization.id,
      storeId: store.id
    });
    await createDefaultShippingRecords(tx, store.id);

    return {
      organization,
      store
    };
  });

  try {
    await connectStoreOSForStore(workspace.store.id);
  } catch {
    // StoreOS is an external service; store creation must remain reliable if it is unavailable.
  }

  return workspace;
}

async function createUniqueOrganizationSlug(name: string) {
  const baseSlug = slugify(name) || "organization";

  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existingOrganization = await prisma.organization.findUnique({
      where: {
        slug
      },
      select: {
        id: true
      }
    });

    if (!existingOrganization) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function getDatabaseSchemaName() {
  const fallbackSchema = "public";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return fallbackSchema;
  }

  try {
    const schema = new URL(connectionString).searchParams.get("schema") ?? fallbackSchema;

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : fallbackSchema;
  } catch {
    return fallbackSchema;
  }
}
