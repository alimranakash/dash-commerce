import { isNotificationError } from "../../notifications/notifications-errors";
import { redactLogText } from "../../notifications/notifications.redact";
import { sendEmail, sendSms } from "../../notifications/notifications.service";
import type { MessageDeliveryStatus } from "../../notifications/notifications.types";
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
   * Only in a development build, and only when the code never reached a gateway
   * — either nothing is configured to send it, or the gateway refused it. A real
   * send never echoes it, and neither does production.
   */
  devCode?: string;
  delivered: boolean;
};

/**
 * Whether this process may hand a code back to the browser: the one gate every
 * echo goes through, whichever flow or provider produced it.
 *
 * A development build only. `process.env.NODE_ENV` is written out literally on
 * purpose — Next replaces that exact expression with `"production"` when it
 * builds, so in the code `next start` runs this is false whatever the
 * environment says (`next.config` must not set `allowDevelopmentBuild`, which
 * would undo that). And never on a server configured as a deployment: a real
 * `PLATFORM_ROOT_DOMAIN`, which every deployed server must set, means a
 * development server was started somewhere shoppers can reach it.
 */
export function canEchoOtpCode() {
  return (
    process.env.NODE_ENV === "development" && isLocalRootDomain(process.env.PLATFORM_ROOT_DOMAIN)
  );
}

function isLocalRootDomain(value: string | undefined) {
  const host = value?.trim().toLowerCase().replace(/:\d+$/, "");

  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".test")
  );
}

/**
 * The code a response may carry — checked again at the boundary, so a ticket
 * that somehow holds one still cannot put it on the wire where echoing is not
 * allowed. Every route and action that answers a code request goes through it.
 */
export function responseDevCode(devCode: string | undefined) {
  return devCode !== undefined && canEchoOtpCode() ? devCode : undefined;
}

/** What a finished send tells the caller: echoed only when nothing was configured to send it. */
export function otpDeliveryResult(status: MessageDeliveryStatus, code: string): OtpDeliveryResult {
  return {
    delivered: status === "SENT",
    ...(status === "SKIPPED" && canEchoOtpCode() ? { devCode: code } : {})
  };
}

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

    return otpDeliveryResult(outcome.status, input.code);
  } catch (error) {
    // A gateway that refuses everything — an unwhitelisted IP, an unapproved
    // sender ID, an empty balance — is fixed in that gateway's own panel and not
    // from here, so failing hard would leave local sign-up impossible to walk
    // through until somebody else fixes an account. Development therefore falls
    // back to the same echo an unconfigured install gets. Production still
    // fails, and either way the refusal is already loud in the log.
    if (canEchoOtpCode()) {
      console.warn(
        `[otp] the gateway would not take this code, so it is being shown in the browser instead — development build only: ${redactLogText(
          error instanceof Error ? error.message : String(error)
        )}`
      );

      return { delivered: false, devCode: input.code };
    }

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
