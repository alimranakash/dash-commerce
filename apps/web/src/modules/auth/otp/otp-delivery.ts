import { isNotificationError } from "../../notifications/notifications-errors";
import { sendEmail, sendSms } from "../../notifications/notifications.service";
import { otpCodeEmail, otpCodeSms } from "../../notifications/templates";
import { OtpError } from "./otp-errors";
import type { OtpChannel } from "./otp.schema";

/**
 * Hands a code to the notifications layer and turns anything that goes wrong
 * into something a visitor can act on.
 *
 * The distinction worth keeping: a refused recipient is theirs to fix and gets
 * said plainly, while a dead gateway is ours and gets a vague apology plus a
 * loud server log. Telling a visitor "the SMS account is out of balance" would
 * be honest and completely useless to them.
 */

export type OtpDeliveryResult = {
  /**
   * Only when nothing was configured to send the code and this is a development
   * build. A real send never echoes it, and neither does production.
   */
  devCode?: string;
  delivered: boolean;
};

export async function deliverOtpCode(input: {
  channel: OtpChannel;
  code: string;
  expiresInMinutes: number;
  identifier: string;
  /** The store whose allowance pays for this, or null when the platform does. */
  storeId: string | null;
}): Promise<OtpDeliveryResult> {
  try {
    const outcome =
      input.channel === "EMAIL"
        ? await sendEmail({
            ...otpCodeEmail({ code: input.code, expiresInMinutes: input.expiresInMinutes }),
            storeId: input.storeId,
            template: "otp_code",
            to: input.identifier
          })
        : await sendSms({
            message: otpCodeSms({ code: input.code, expiresInMinutes: input.expiresInMinutes }),
            storeId: input.storeId,
            template: "otp_code",
            to: input.identifier
          });

    const echo = outcome.status === "SKIPPED" && process.env.NODE_ENV === "development";

    return {
      delivered: outcome.status === "SENT",
      ...(echo ? { devCode: input.code } : {})
    };
  } catch (error) {
    throw toOtpDeliveryError(error, input.channel);
  }
}

function toOtpDeliveryError(error: unknown, channel: OtpChannel) {
  if (!isNotificationError(error)) {
    return new OtpError("DELIVERY_FAILED", "We could not send your code. Try again in a moment.", {
      cause: error
    });
  }

  if (error.kind === "INVALID_RECIPIENT") {
    return new OtpError(
      "DELIVERY_FAILED",
      channel === "EMAIL"
        ? "That email address was refused by the mail server. Check it and try again."
        : "That number could not be reached. Check it and try again.",
      { cause: error }
    );
  }

  return new OtpError(
    "DELIVERY_FAILED",
    "We could not send your code right now. Try again in a few minutes.",
    { cause: error }
  );
}
