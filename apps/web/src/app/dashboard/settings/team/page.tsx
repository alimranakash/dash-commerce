import { redirect } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import {
  changeStaffRoleAction,
  inviteStaffAction,
  removeStaffMemberAction,
  revokeStaffInviteAction
} from "../../../../modules/staff/staff.actions";
import { TeamSettings } from "../../../../modules/staff/components/team-settings";
import { getTeamView } from "../../../../modules/staff/staff.service";
import type { OrganizationRole } from "../../../../modules/staff/staff.schema";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function TeamSettingsPage() {
  const access = await getStoreAccess();

  // A store always belongs to an organization, so this is unreachable in
  // practice — but the team is org-scoped, and there is nothing sensible to
  // render without one.
  if (!access.organizationId || !access.userId) {
    redirect("/dashboard");
  }

  const view = await getTeamView({
    organizationId: access.organizationId,
    role: access.role as OrganizationRole,
    userId: access.userId
  });

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Team</h1>
          <p className="mt-2 text-sm text-[#737582]">
            Give the people who work on this store their own login instead of sharing yours. You
            create an invite link, send it to them, and they join with the role you picked. How many
            people you can have is set by your plan.
          </p>
          {!access.canManage ? (
            <p className="mt-3 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
              You can see who is on the team, but only the store owner or an admin can invite or
              remove people.
            </p>
          ) : null}
        </div>
        <TeamSettings
          canManage={access.canManage}
          changeRoleAction={changeStaffRoleAction}
          inviteAction={inviteStaffAction}
          removeAction={removeStaffMemberAction}
          revokeAction={revokeStaffInviteAction}
          view={view}
        />
      </section>
    </DashboardShell>
  );
}
