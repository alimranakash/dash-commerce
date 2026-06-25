import { z } from "zod";

export const profileInfoSchema = z.object({
  image: z.url("Use a valid image URL.").optional().or(z.literal("")),
  name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(80),
  phone: z.string().trim().max(40, "Phone must be 40 characters or less.").optional()
});

export const profilePreferencesSchema = z.object({
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  language: z.enum(["en", "bn"]),
  timezone: z.string().trim().min(1, "Timezone is required.").max(80)
});

export const changePasswordSchema = z.object({
  confirmPassword: z.string().min(8, "Confirm your new password."),
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInfoInput = z.infer<typeof profileInfoSchema>;
export type ProfilePreferencesInput = z.infer<typeof profilePreferencesSchema>;
