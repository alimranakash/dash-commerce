import { prisma } from "@dash/db";
import type { ProfileInfoInput, ProfilePreferencesInput } from "./profile.schema";

export async function getProfileByUserId(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      accounts: {
        select: {
          provider: true
        }
      }
    }
  });
}

export async function updateProfileInfo(userId: string, data: ProfileInfoInput) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      image: data.image || null,
      name: data.name,
      phone: data.phone || null
    }
  });
}

export async function updateProfilePreferences(userId: string, data: ProfilePreferencesInput) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      dateFormat: data.dateFormat,
      language: data.language,
      timezone: data.timezone
    }
  });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      passwordHash
    }
  });
}
