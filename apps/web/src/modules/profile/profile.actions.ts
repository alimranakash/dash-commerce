"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "../../lib/auth";
import { changeProfilePassword, saveProfileInfo, saveProfilePreferences } from "./profile.service";
import type { ChangePasswordInput, ProfileInfoInput, ProfilePreferencesInput } from "./profile.schema";

export type ProfileActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
};

export async function updateProfileInfoAction(
  _state: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();

  try {
    await saveProfileInfo(user.id, profileInfoFromFormData(formData));
  } catch (error) {
    return profileErrorState(error, "Please fix the highlighted profile fields.");
  }

  revalidatePath("/dashboard/profile");
  return {
    message: "Profile information updated.",
    status: "success"
  };
}

export async function updateProfilePreferencesAction(
  _state: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();

  try {
    await saveProfilePreferences(user.id, preferencesFromFormData(formData));
  } catch (error) {
    return profileErrorState(error, "Please fix the highlighted preferences.");
  }

  revalidatePath("/dashboard/profile");
  return {
    message: "Preferences updated.",
    status: "success"
  };
}

export async function changePasswordAction(
  _state: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();

  try {
    await changeProfilePassword(user.id, passwordFromFormData(formData));
  } catch (error) {
    return profileErrorState(error, "Please fix the highlighted password fields.");
  }

  return {
    message: "Password updated.",
    status: "success"
  };
}

function profileInfoFromFormData(formData: FormData): ProfileInfoInput {
  return {
    image: optionalValue(formData, "image") ?? "",
    name: getValue(formData, "name"),
    phone: optionalValue(formData, "phone")
  };
}

function preferencesFromFormData(formData: FormData): ProfilePreferencesInput {
  return {
    dateFormat: getValue(formData, "dateFormat") as ProfilePreferencesInput["dateFormat"],
    language: getValue(formData, "language") as ProfilePreferencesInput["language"],
    timezone: getValue(formData, "timezone")
  };
}

function passwordFromFormData(formData: FormData): ChangePasswordInput {
  return {
    confirmPassword: getValue(formData, "confirmPassword"),
    currentPassword: getValue(formData, "currentPassword"),
    newPassword: getValue(formData, "newPassword")
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);
  return value || undefined;
}

function profileErrorState(error: unknown, fallback: string): ProfileActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])),
      message: fallback,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Profile update failed.",
    status: "error"
  };
}
