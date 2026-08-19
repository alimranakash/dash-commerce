import { z } from "zod";

/**
 * The Prisma enums are re-declared here as unions rather than imported: the
 * generated client only exports them through `Prisma.$Enums`, and every other
 * module in this repo names its own union for the same reason.
 */
export type OtpChannel = "EMAIL" | "SMS";
export type OtpPurpose = "CHECKOUT" | "CONTACT_CHANGE" | "LOGIN" | "PASSWORD_RESET" | "REGISTRATION";

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your message.");

export const requestRegistrationCodeSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email address or phone number"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  password: z.string().min(8, "Password must be at least 8 characters").max(128)
});

export const verifyRegistrationCodeSchema = z.object({
  code: otpCodeSchema,
  identifier: z.string().trim().min(1, "Enter your email address or phone number")
});

export const requestPasswordResetSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email address or phone number")
});

export const confirmPasswordResetSchema = z.object({
  code: otpCodeSchema,
  identifier: z.string().trim().min(1, "Enter your email address or phone number"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128)
});

export const contactChangeSchema = z.object({
  code: otpCodeSchema.optional(),
  identifier: z.string().trim().min(1, "Enter the new email address or phone number")
});

/**
 * What a CONTACT_CHANGE challenge carries. The code goes to the *new* handle, so
 * confirming it proves the visitor holds it — but the account it belongs to has
 * to be remembered from when the change was asked for, not taken from whoever
 * happens to be signed in when the code comes back.
 */
export const contactChangePayloadSchema = z.object({
  userId: z.string().min(1)
});

/**
 * What a REGISTRATION challenge carries until the code is verified. The password
 * is already bcrypt-hashed by the time it lands here — the same hash that will
 * become `User.passwordHash` — so a challenge row is no more sensitive than the
 * account it is about to create.
 */
export const registrationPayloadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  passwordHash: z.string().min(1)
});

export type ContactChangeInput = z.infer<typeof contactChangeSchema>;
export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;
export type RequestRegistrationCodeInput = z.infer<typeof requestRegistrationCodeSchema>;
export type VerifyRegistrationCodeInput = z.infer<typeof verifyRegistrationCodeSchema>;
