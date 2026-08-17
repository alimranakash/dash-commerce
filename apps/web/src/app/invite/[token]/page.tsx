import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "../../../lib/auth";
import { AuthExperience } from "../../../modules/auth/auth-experience";
import styles from "../../../modules/auth/auth-experience.module.css";
import { LogoutButton } from "../../../modules/auth/logout-button";
import { InviteAcceptPanel } from "../../../modules/staff/components/invite-accept-panel";
import { acceptStaffInviteAction } from "../../../modules/staff/staff.actions";
import {
  StaffInviteError,
  describeStaffInvite,
  type StaffInviteProblem
} from "../../../modules/staff/staff.service";
import type { AssignableStaffRole } from "../../../modules/staff/staff.schema";

const roleLabels: Record<AssignableStaffRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member"
};

const roleDescriptions: Record<AssignableStaffRole, string> = {
  ADMIN: "You will be able to do everything a member can, plus change store settings.",
  MEMBER: "You will be able to work on products, orders, and inventory."
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  const viewer = user ? { email: user.email, id: user.id } : null;
  const result = await resolveInvite(token, viewer);

  if (!result.ok) {
    return (
      <InviteProblemScreen
        invitePath={`/invite/${token}`}
        problem={result}
        signedIn={Boolean(viewer)}
      />
    );
  }

  const { invite } = result;
  const roleLabel = roleLabels[invite.role];

  // Signed out. The invite is real, so the page says who it is from before
  // asking for a login — arriving at a bare sign-in form from a link a friend
  // sent looks like phishing.
  if (!viewer) {
    return (
      <AuthExperience
        description={`You have been invited to help run ${invite.organizationName} on Dash. Sign in as ${invite.email} to join, or create that account if you do not have one yet.`}
        eyebrow="Team invite"
        title={`Join ${invite.organizationName}.`}
      >
        <div className={styles.formStack}>
          <InviteSummary
            email={invite.email}
            organizationName={invite.organizationName}
            roleLabel={roleLabel}
          />

          <div className="grid gap-2.5">
            <Link
              className={styles.submitButton}
              href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
            >
              Log in to accept
            </Link>
            <Link
              className={styles.backButton}
              href={`/register?invite=${encodeURIComponent(token)}`}
            >
              I do not have an account yet
            </Link>
          </div>

          <p className={styles.switchPrompt}>
            Use the address this invite was sent to — {invite.email}. Any other account will be
            turned away.
          </p>
        </div>
      </AuthExperience>
    );
  }

  return (
    <AuthExperience
      description={`${invite.organizationName} wants you on their team. ${roleDescriptions[invite.role]}`}
      eyebrow="Team invite"
      title={`Join ${invite.organizationName}.`}
    >
      <div className={styles.formStack}>
        <InviteSummary
          email={invite.email}
          organizationName={invite.organizationName}
          roleLabel={roleLabel}
        />
        <InviteAcceptPanel
          acceptAction={acceptStaffInviteAction}
          organizationName={invite.organizationName}
          roleLabel={roleLabel}
          token={token}
        />
      </div>
    </AuthExperience>
  );
}

function InviteSummary({
  email,
  organizationName,
  roleLabel
}: {
  email: string;
  organizationName: string;
  roleLabel: string;
}) {
  return (
    <div className={styles.stepHeading}>
      <span>{organizationName.slice(0, 1).toUpperCase()}</span>
      <div>
        <h2>
          {organizationName} · {roleLabel}
        </h2>
        <p>Invited as {email}. This link works once and expires 7 days after it was created.</p>
      </div>
    </div>
  );
}

/**
 * Every dead-end an invite link can reach. Each one names what actually happened
 * and what to do about it — "invalid link" for all six would leave someone
 * whose invite simply expired thinking they had been shut out.
 */
function InviteProblemScreen({
  invitePath,
  problem,
  signedIn
}: {
  invitePath: string;
  problem: { message: string; ok: false; problem: StaffInviteProblem };
  signedIn: boolean;
}) {
  const copy = describeProblem(problem.problem);

  return (
    <AuthExperience description={problem.message} eyebrow="Team invite" title={copy.title}>
      <div className={styles.formStack}>
        <p className={styles.errorMessage}>{copy.detail}</p>

        <div className="grid gap-2.5">
          {copy.showSignOut ? (
            <LogoutButton
              callbackUrl={`/login?callbackUrl=${encodeURIComponent(invitePath)}`}
              label="Sign out and use the invited account"
            />
          ) : null}
          <Link className={signedIn ? styles.submitButton : styles.backButton} href="/dashboard">
            {signedIn ? "Go to my dashboard" : "Go to Dash"}
          </Link>
        </div>

        <p className={styles.switchPrompt}>
          Need a new link? Ask whoever invited you to send another one from Settings → Team.
        </p>
      </div>
    </AuthExperience>
  );
}

function describeProblem(problem: StaffInviteProblem): {
  detail: ReactNode;
  showSignOut: boolean;
  title: string;
} {
  switch (problem) {
    case "already_accepted":
      return {
        detail:
          "This invite has already been used. If that was you, the store is already on your dashboard.",
        showSignOut: false,
        title: "Already used."
      };
    case "already_in_organization":
      return {
        detail:
          "The account you are signed in with already belongs to a store. One account can only be part of one store, so sign out and use the account this invite was sent to.",
        showSignOut: true,
        title: "This account is taken."
      };
    case "expired":
      return {
        detail: "Invite links last 7 days. This one is past that, so it can no longer be used.",
        showSignOut: false,
        title: "This link expired."
      };
    case "revoked":
      return {
        detail: "Whoever invited you cancelled this invite before it was used.",
        showSignOut: false,
        title: "This invite was cancelled."
      };
    case "seats_full":
      return {
        detail:
          "The store has run out of staff seats on its current plan. The owner needs to upgrade before anyone else can join.",
        showSignOut: false,
        title: "No seats left."
      };
    case "wrong_email":
      return {
        detail:
          "An invite only works for the address it was sent to. Sign out and sign back in with that address to accept it.",
        showSignOut: true,
        title: "Wrong account."
      };
    default:
      return {
        detail:
          "We could not find this invite. Check that you copied the whole link — they are long and easy to cut short.",
        showSignOut: false,
        title: "This link is not valid."
      };
  }
}

/**
 * Turns the service's exception into a value, so the page can branch instead of
 * carrying a `try` around its whole body. Anything that is not a
 * `StaffInviteError` is a real fault and is left to the error boundary.
 */
async function resolveInvite(
  token: string,
  viewer: { email: string | null | undefined; id: string } | null
) {
  try {
    return {
      invite: await describeStaffInvite(token, viewer),
      ok: true as const
    };
  } catch (error) {
    if (!(error instanceof StaffInviteError)) {
      throw error;
    }

    return {
      message: error.message,
      ok: false as const,
      problem: error.problem
    };
  }
}
