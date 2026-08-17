"use client";

import { ArrowUpRight, Loader2, MailPlus, Trash2, UserMinus, Users } from "lucide-react";
import { useActionState } from "react";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import { InviteLinkPanel } from "./invite-link-panel";
import type { StaffActionState } from "../staff.actions";
import type { OrganizationRole, StaffInviteView, StaffMemberView, TeamView } from "../staff.schema";

type StaffFormAction = (state: StaffActionState, formData: FormData) => Promise<StaffActionState>;

type TeamSettingsProps = {
  canManage: boolean;
  changeRoleAction: StaffFormAction;
  inviteAction: StaffFormAction;
  removeAction: StaffFormAction;
  revokeAction: StaffFormAction;
  view: TeamView;
};

const initialState: StaffActionState = { status: "idle" };

const inputClass =
  "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-[#6d3cf5] px-4 text-sm font-semibold text-white hover:bg-[#5c30d6] disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-3 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc] disabled:opacity-60";

const roleLabels: Record<OrganizationRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  OWNER: "Owner"
};

const roleDescriptions: Record<OrganizationRole, string> = {
  ADMIN: "Everything a member can do, plus store settings.",
  MEMBER: "Day-to-day work: products, orders, inventory.",
  OWNER: "Full access, including billing and the team."
};

export function TeamSettings({
  canManage,
  changeRoleAction,
  inviteAction,
  removeAction,
  revokeAction,
  view
}: TeamSettingsProps) {
  const [inviteState, inviteFormAction, isInviting] = useActionState(inviteAction, initialState);
  const seatsFull = !view.canInvite;

  return (
    <div className="grid gap-5">
      <DashboardCard title="Seats">
        <SeatMeter view={view} />
      </DashboardCard>

      <DashboardCard title="Invite someone">
        <form action={inviteFormAction} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-start">
            <label className="grid gap-2 text-sm font-medium text-[#33343e]">
              Email
              <input
                autoComplete="off"
                className={inputClass}
                disabled={!canManage || seatsFull}
                name="email"
                placeholder="rahim@example.com"
                spellCheck={false}
                type="email"
              />
              {inviteState.fieldErrors?.email ? (
                <span className="text-[11px] font-medium text-rose-600">
                  {inviteState.fieldErrors.email}
                </span>
              ) : (
                <span className="text-[11px] font-normal leading-5 text-[#858691]">
                  They will need to sign in with this exact address to join.
                </span>
              )}
            </label>

            <label className="grid gap-2 text-sm font-medium text-[#33343e]">
              Role
              <select
                className={inputClass}
                defaultValue="MEMBER"
                disabled={!canManage || seatsFull}
                name="role"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <span className="text-[11px] font-normal leading-5 text-[#858691]">
                {roleDescriptions.MEMBER}
              </span>
            </label>

            <button
              className={`${primaryButtonClass} sm:mt-[26px]`}
              disabled={!canManage || seatsFull || isInviting}
              type="submit"
            >
              {isInviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MailPlus className="h-4 w-4" />
              )}
              {isInviting ? "Creating..." : "Create invite link"}
            </button>
          </div>

          {inviteState.status === "error" && inviteState.message ? (
            <ActionMessage state={inviteState} />
          ) : null}

          {inviteState.invite ? <InviteLinkPanel invite={inviteState.invite} /> : null}

          {seatsFull ? <SeatsFullNotice view={view} /> : null}
        </form>
      </DashboardCard>

      {view.invites.length > 0 ? (
        <DashboardCard title={`Pending invites (${view.invites.length})`}>
          <div className="grid gap-3">
            {view.invites.map((invite) => (
              <InviteRow
                canManage={canManage}
                invite={invite}
                key={invite.id}
                revokeAction={revokeAction}
              />
            ))}
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard title={`Team (${view.members.length})`}>
        <div className="grid gap-3">
          {view.members.map((member) => (
            <MemberRow
              canManage={canManage}
              changeRoleAction={changeRoleAction}
              key={member.id}
              member={member}
              removeAction={removeAction}
            />
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}

/**
 * The bar reads "used of limit" where used counts members *and* invites that
 * have not been accepted yet, because that is what the plan actually caps. The
 * breakdown underneath spells the two apart so a full bar with an empty team
 * makes sense.
 */
function SeatMeter({ view }: { view: TeamView }) {
  const { seats } = view;
  const isUnlimited = seats.limit === null;
  const percent = isUnlimited
    ? 0
    : Math.min(100, Math.round((seats.used / Math.max(1, seats.limit ?? 1)) * 100));
  const isFull = !isUnlimited && seats.remaining === 0;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-[#1f2029]">{seats.used}</span>
          <span className="text-sm text-[#737582]">
            {isUnlimited ? "people — unlimited seats on your plan" : `of ${seats.limit} seats used`}
          </span>
        </div>
        {view.overLimitBy > 0 ? (
          <StatusBadge tone="red">{view.overLimitBy} over limit</StatusBadge>
        ) : isFull ? (
          <StatusBadge tone="amber">Full</StatusBadge>
        ) : (
          <StatusBadge tone="green">
            {isUnlimited ? "Unlimited" : `${seats.remaining} free`}
          </StatusBadge>
        )}
      </div>

      {!isUnlimited ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#efedf8]">
          <div
            className={`h-full rounded-full ${isFull ? "bg-[#e0803a]" : "bg-[#6d3cf5]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      <p className="m-0 text-[11px] leading-5 text-[#858691]">
        {seats.members} {seats.members === 1 ? "person" : "people"} on the team
        {seats.pendingInvites > 0
          ? `, ${seats.pendingInvites} invite${seats.pendingInvites === 1 ? "" : "s"} waiting to be accepted`
          : ""}
        . The owner counts as a seat, and a pending invite holds one until it is accepted or
        revoked.
      </p>

      {view.overLimitBy > 0 ? (
        <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
          Your team is {view.overLimitBy} over what your current plan allows. Nobody has been
          removed — you just cannot add anyone until you upgrade or remove someone.
        </p>
      ) : null}
    </div>
  );
}

function SeatsFullNotice({ view }: { view: TeamView }) {
  const onlyOwnerAllowed = view.seats.limit === 1;

  return (
    <div className="grid gap-3 rounded-lg border border-[#e5e0f7] bg-[#f7f4ff] p-5">
      <p className="m-0 text-sm font-semibold text-[#33343e]">
        {onlyOwnerAllowed ? "Your plan is for one person." : "Every seat on your plan is taken."}
      </p>
      <p className="m-0 text-sm leading-6 text-[#655d78]">
        {onlyOwnerAllowed
          ? "Upgrade to bring someone else into this store — they get their own login instead of sharing yours."
          : "Upgrade for more seats, or revoke a pending invite to free one up."}
      </p>
      <a className={`${primaryButtonClass} w-fit`} href="/dashboard/billing">
        See plans
        <ArrowUpRight className="h-4 w-4" />
      </a>
    </div>
  );
}

function InviteRow({
  canManage,
  invite,
  revokeAction
}: {
  canManage: boolean;
  invite: StaffInviteView;
  revokeAction: StaffFormAction;
}) {
  const [state, formAction, isRevoking] = useActionState(revokeAction, initialState);

  return (
    <div className="grid gap-3 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#292a34]">{invite.email}</span>
            <StatusBadge tone="amber">Invited</StatusBadge>
            <StatusBadge tone="gray">{roleLabels[invite.role]}</StatusBadge>
          </div>
          <span className="text-[11px] leading-5 text-[#858691]">
            Invited by {invite.invitedByName ?? "someone on your team"} · expires{" "}
            {formatDate(invite.expiresAt)}. The link was shown once when it was created.
          </span>
        </div>

        {canManage ? (
          <form action={formAction}>
            <input name="inviteId" type="hidden" value={invite.id} />
            <button className={secondaryButtonClass} disabled={isRevoking}>
              {isRevoking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isRevoking ? "Revoking..." : "Revoke"}
            </button>
          </form>
        ) : null}
      </div>

      {state.status !== "idle" && state.message ? <ActionMessage state={state} /> : null}
    </div>
  );
}

function MemberRow({
  canManage,
  changeRoleAction,
  member,
  removeAction
}: {
  canManage: boolean;
  changeRoleAction: StaffFormAction;
  member: StaffMemberView;
  removeAction: StaffFormAction;
}) {
  const [roleState, roleFormAction, isSavingRole] = useActionState(changeRoleAction, initialState);
  const [removeState, removeFormAction] = useActionState(removeAction, initialState);

  return (
    <div className="grid gap-3 rounded-lg border border-[#ececf5] bg-[#fcfcff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#292a34]">
              {member.name ?? member.email}
            </span>
            <StatusBadge tone={member.role === "OWNER" ? "purple" : "gray"}>
              {roleLabels[member.role]}
            </StatusBadge>
            {member.isSelf ? <StatusBadge tone="green">You</StatusBadge> : null}
          </div>
          <span className="text-[11px] leading-5 text-[#858691]">
            {member.name ? `${member.email} · ` : ""}joined {formatDate(member.joinedAt)} ·{" "}
            {roleDescriptions[member.role]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && member.canChangeRole ? (
            <form action={roleFormAction} className="flex items-center gap-2">
              <input name="memberId" type="hidden" value={member.id} />
              <select
                aria-label={`Role for ${member.email}`}
                className="h-9 rounded-lg border border-[#dcd9e8] bg-white px-2.5 text-xs font-semibold text-[#555762]"
                defaultValue={member.role}
                name="role"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className={secondaryButtonClass} disabled={isSavingRole}>
                {isSavingRole ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {isSavingRole ? "Saving..." : "Save role"}
              </button>
            </form>
          ) : null}

          {canManage && member.canRemove ? (
            <DeleteConfirmationButton
              // The confirmation dialog hands back an empty FormData, so the
              // row's id is filled in here rather than by a hidden input.
              action={(formData) => {
                formData.set("memberId", member.id);
                removeFormAction(formData);
              }}
              ariaLabel={`Remove ${member.email} from the team`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#f2d4dc] bg-white px-3 text-xs font-semibold text-[#c02b52] hover:bg-[#fff5f7]"
              title={`Remove ${member.email}`}
            >
              <UserMinus className="h-3.5 w-3.5" />
              Remove
            </DeleteConfirmationButton>
          ) : null}

          {member.role === "OWNER" && !member.canRemove ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#858691]">
              <Users className="h-3.5 w-3.5" />A store always keeps its owner
            </span>
          ) : null}
        </div>
      </div>

      {roleState.status !== "idle" && roleState.message ? (
        <ActionMessage state={roleState} />
      ) : null}
      {removeState.status !== "idle" && removeState.message ? (
        <ActionMessage state={removeState} />
      ) : null}
    </div>
  );
}

function ActionMessage({ state }: { state: StaffActionState }) {
  const isSuccess = state.status === "success";

  return (
    <p
      className={`m-0 rounded-lg border px-4 py-3 text-sm font-medium ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
