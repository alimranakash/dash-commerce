import { prisma } from "@dash/db";
import { CampaignError } from "./campaign.service";
import { countSmsSegments } from "./campaign.schema";
import { findCampaignPlaceholders } from "./campaign-message";
import { templateSchema, type TemplateFormInput } from "./template.schema";

export type TemplateView = {
  body: string;
  channel: "EMAIL" | "SMS";
  createdAt: Date;
  id: string;
  name: string;
  /** Which `{{…}}` values this body expects, so the picker can warn about them. */
  placeholders: string[];
  segments: number;
  subject: string | null;
  unicode: boolean;
};

export async function getTemplatesForStore(storeId: string, search?: string) {
  const query = search?.trim();

  return prisma.campaignTemplate.findMany({
    where: {
      storeId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { body: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getTemplateByIdForStore(storeId: string, templateId: string) {
  return prisma.campaignTemplate.findFirst({
    where: { id: templateId, storeId }
  });
}

type TemplateRow = Awaited<ReturnType<typeof getTemplateByIdForStore>>;

export function toTemplateView(template: NonNullable<TemplateRow>): TemplateView {
  const { segments, unicode } = countSmsSegments(template.body);

  return {
    body: template.body,
    channel: template.channel,
    createdAt: template.createdAt,
    id: template.id,
    name: template.name,
    placeholders: findCampaignPlaceholders(template.body),
    segments,
    subject: template.subject,
    unicode
  };
}

export async function listTemplates(storeId: string, search?: string) {
  return (await getTemplatesForStore(storeId, search)).map(toTemplateView);
}

export async function findTemplate(storeId: string, templateId: string) {
  const template = await getTemplateByIdForStore(storeId, templateId);

  return template ? toTemplateView(template) : null;
}

export async function createTemplate(storeId: string, input: TemplateFormInput) {
  const data = templateSchema.parse(input);

  await assertNameFree(storeId, data.name);

  return prisma.campaignTemplate.create({
    data: {
      body: data.body,
      channel: data.channel,
      name: data.name,
      storeId,
      subject: data.subject ?? null
    }
  });
}

export async function updateTemplate(storeId: string, templateId: string, input: TemplateFormInput) {
  const data = templateSchema.parse(input);
  const existing = await getTemplateByIdForStore(storeId, templateId);

  if (!existing) {
    return null;
  }

  await assertNameFree(storeId, data.name, templateId);

  const result = await prisma.campaignTemplate.updateMany({
    where: { id: templateId, storeId },
    data: {
      body: data.body,
      channel: data.channel,
      name: data.name,
      subject: data.subject ?? null
    }
  });

  return result.count === 0 ? null : getTemplateByIdForStore(storeId, templateId);
}

/**
 * Deleting a template is safe at any time.
 *
 * Unlike an audience, nothing references one: a template's body is copied into
 * the campaign when it is picked, so campaigns written from it are unaffected.
 * That copy is deliberate — editing a template must not rewrite the message of
 * a campaign that already went out.
 */
export async function deleteTemplate(storeId: string, templateId: string) {
  const existing = await getTemplateByIdForStore(storeId, templateId);

  if (!existing) {
    return null;
  }

  await prisma.campaignTemplate.deleteMany({ where: { id: templateId, storeId } });

  return existing;
}

async function assertNameFree(storeId: string, name: string, excludeId?: string) {
  const clash = await prisma.campaignTemplate.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      storeId,
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  });

  if (clash) {
    throw new CampaignError(`A template called ${name} already exists.`, "name");
  }
}
