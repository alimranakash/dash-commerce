"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { requireUser } from "../../lib/auth";
import { readClientIp } from "../../lib/request-ip";
import { confirmContactChange, requestContactChangeCode } from "./contact-change.service";
import { isOtpError } from "./otp/otp-errors";

export type ContactChallenge = {
  channel: "EMAIL" | "SMS";
  /** Development only, when nothing is configured to send messages. */
  devCode: string | null;
  identifier: string;
};

export type ContactActionState = {
  challenge?: ContactChallenge;
  message?: string;
  status: "idle" | "code-sent" | "error" | "success";
};

/**
 * One action for both halves of the change, because the form is one form: with
 * no code it asks for one, and with a code it commits. Keeping them together is
 * what lets a failed confirmation re-render with the code boxes still in place.
 */
export async function changeContactAction(
  state: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const user = await requireUser();
  const identifier = String(formData.get("identifier") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  try {
    if (!code) {
      const ticket = await requestContactChangeCode(
        user.id,
        { identifier },
        { ipAddress: readClientIp(await headers()) }
      );

      return {
        challenge: {
          channel: ticket.channel,
          devCode: ticket.devCode ?? null,
          identifier: ticket.identifier
        },
        message: `We sent a code to ${ticket.identifier}. Enter it to confirm the change.`,
        status: "code-sent"
      };
    }

    const updated = await confirmContactChange(user.id, { code, identifier });
    revalidatePath("/dashboard/profile");

    return {
      message:
        updated.email === identifier.toLowerCase()
          ? "That email address is now on your account."
          : "That phone number is now on your account.",
      status: "success"
    };
  } catch (error) {
    return {
      // Held on to so a wrong code re-renders with the boxes still there rather
      // than dumping the visitor back to the start of the change.
      ...(state.challenge === undefined ? {} : { challenge: state.challenge }),
      message: contactErrorMessage(error),
      status: "error"
    };
  }
}

/**
 * Only messages this module wrote itself reach the visitor. A raw Prisma or
 * driver error would be both useless to them and a description of our schema.
 */
function contactErrorMessage(error: unknown) {
  if (isOtpError(error)) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the details you entered.";
  }

  console.error("Contact change failed", error);

  return "That change could not be made. Try again.";
}
