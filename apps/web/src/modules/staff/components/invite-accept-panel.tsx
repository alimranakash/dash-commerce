"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import styles from "../../auth/auth-experience.module.css";
import type { StaffActionState } from "../staff.actions";

type InviteAcceptPanelProps = {
  acceptAction: (state: StaffActionState, formData: FormData) => Promise<StaffActionState>;
  organizationName: string;
  roleLabel: string;
  token: string;
};

const initialState: StaffActionState = { status: "idle" };

/**
 * The confirm step. A successful accept redirects to the dashboard from the
 * server action, so this only ever renders the button and whatever went wrong —
 * an invite can be revoked, expire, or lose the last seat between this page
 * being rendered and the button being pressed.
 */
export function InviteAcceptPanel({
  acceptAction,
  organizationName,
  roleLabel,
  token
}: InviteAcceptPanelProps) {
  const [state, formAction, isPending] = useActionState(acceptAction, initialState);

  return (
    <form action={formAction} className={styles.authForm}>
      <input name="token" type="hidden" value={token} />

      {state.status === "error" && state.message ? (
        <p className={styles.errorMessage}>{state.message}</p>
      ) : null}

      <button className={styles.submitButton} disabled={isPending} type="submit">
        {isPending ? (
          <>
            <LoaderCircle className={styles.spinner} /> Joining...
          </>
        ) : (
          <>
            Join {organizationName} <ArrowRight />
          </>
        )}
      </button>

      <p className={styles.switchPrompt}>
        You will join as {roleLabel.toLowerCase()}. The person who invited you can change that
        later.
      </p>
    </form>
  );
}
