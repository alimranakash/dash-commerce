import { prisma } from "@dash/db";
import { onboardingSchema, type OnboardingInput } from "./schemas";

export async function createOnboardingWorkspace(userId: string, input: OnboardingInput) {
  const data = onboardingSchema.parse(input);
  const storeSlug = data.storeSlug;
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

  return prisma.$transaction(async (tx) => {
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
                domain: `${storeSlug}.dash.com`,
                type: "DASH_SUBDOMAIN",
                isPrimary: true
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

    return {
      organization,
      store: organization.stores[0]
    };
  });
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
