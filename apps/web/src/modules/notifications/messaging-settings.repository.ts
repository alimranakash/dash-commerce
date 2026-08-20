import { prisma } from "@dash/db";

/**
 * The one row of platform messaging credentials.
 *
 * A singleton in the same shape as `BillingSetting`: there is one SMS account
 * and one mail relay for the whole platform, not one per store. `findFirst`
 * rather than a fixed id, so nothing depends on a seeded row existing.
 */
export async function getMessagingSettingRecord() {
  return prisma.messagingSetting.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function saveMessagingSettingRecord(data: {
  emailEnabled: boolean;
  emailFrom: string | null;
  smsApiKeyCipher?: string | null;
  smsApiKeyHint?: string | null;
  smsEnabled: boolean;
  smsProvider: string;
  smsSenderId: string | null;
  smtpHost: string | null;
  smtpPasswordCipher?: string | null;
  smtpPasswordHint?: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
}) {
  const existing = await getMessagingSettingRecord();

  if (!existing) {
    return prisma.messagingSetting.create({ data });
  }

  return prisma.messagingSetting.update({
    data,
    where: {
      id: existing.id
    }
  });
}
