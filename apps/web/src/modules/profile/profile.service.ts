import { compare, hash } from "bcryptjs";
import { getProfileByUserId, updateProfileInfo, updateProfilePreferences, updateUserPasswordHash } from "./profile.repository";
import { changePasswordSchema, profileInfoSchema, profilePreferencesSchema, type ChangePasswordInput, type ProfileInfoInput, type ProfilePreferencesInput } from "./profile.schema";

export { getProfileByUserId };

export async function saveProfileInfo(userId: string, input: ProfileInfoInput) {
  const data = profileInfoSchema.parse(input);

  return updateProfileInfo(userId, { image: data.image || null, name: data.name });
}

export async function saveProfilePreferences(userId: string, input: ProfilePreferencesInput) {
  const data = profilePreferencesSchema.parse(input);
  return updateProfilePreferences(userId, data);
}

export async function changeProfilePassword(userId: string, input: ChangePasswordInput) {
  const data = changePasswordSchema.parse(input);
  const profile = await getProfileByUserId(userId);

  if (!profile) {
    throw new Error("Profile not found.");
  }

  if (!profile.passwordHash) {
    throw new Error("Password change is unavailable for accounts without email/password login.");
  }

  const isCurrentPasswordValid = await compare(data.currentPassword, profile.passwordHash);

  if (!isCurrentPasswordValid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await hash(data.newPassword, 12);
  return updateUserPasswordHash(userId, passwordHash);
}
