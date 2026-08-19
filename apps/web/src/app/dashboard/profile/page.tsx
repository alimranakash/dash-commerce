import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { requireUser } from "../../../lib/auth";
import { changeContactAction } from "../../../modules/auth/contact-change.actions";
import { SignInDetailsCard } from "../../../modules/auth/sign-in-details-card";
import { ConnectedAccountsCard } from "../../../modules/profile/components/connected-accounts-card";
import { PasswordForm, PersonalInfoForm, PreferencesForm } from "../../../modules/profile/components/profile-forms";
import { changePasswordAction, updateProfileInfoAction, updateProfilePreferencesAction } from "../../../modules/profile/profile.actions";
import { getProfileByUserId } from "../../../modules/profile/profile.service";
import { requireStore } from "../../../modules/stores/queries";

export default async function ProfilePage() {
  const [store, sessionUser] = await Promise.all([requireStore(), requireUser()]);
  const profile = await getProfileByUserId(sessionUser.id);

  if (!profile) {
    redirect("/login");
  }

  const googleConnected = profile.accounts.some((account) => account.provider === "google");
  const emailLoginEnabled = Boolean(profile.passwordHash);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Account</p>
            <h1>Profile</h1>
            <p className="auth-copy">Manage your personal account, security, and dashboard preferences.</p>
          </div>
        </div>

        <ProfileCard title="Personal Information" description="Update your profile details used across Dash Commerce OS.">
          <PersonalInfoForm
            action={updateProfileInfoAction}
            profile={{
              image: profile.image,
              name: profile.name
            }}
          />
        </ProfileCard>

        <ProfileCard
          description="The email address and phone number you sign in with. Changing either sends a code to the new one first."
          title="Sign-in Details"
        >
          <SignInDetailsCard
            action={changeContactAction}
            contacts={{
              email: profile.email,
              emailVerified: profile.emailVerified !== null,
              phone: profile.phone,
              phoneVerified: profile.phoneVerified !== null
            }}
          />
        </ProfileCard>

        <ProfileCard id="security" title="Account Security" description="Change your password for email login accounts.">
          <PasswordForm action={changePasswordAction} canChangePassword={emailLoginEnabled} />
        </ProfileCard>

        <ProfileCard title="Preferences" description="Choose how dates, language, and timezones appear in your dashboard.">
          <PreferencesForm
            action={updateProfilePreferencesAction}
            preferences={{
              dateFormat: profile.dateFormat,
              language: profile.language,
              timezone: profile.timezone
            }}
          />
        </ProfileCard>

        <ProfileCard title="Connected Accounts" description="Review sign-in methods connected to your account.">
          <ConnectedAccountsCard emailLoginEnabled={emailLoginEnabled} googleConnected={googleConnected} />
        </ProfileCard>
      </section>
    </DashboardShell>
  );
}

function ProfileCard({
  children,
  description,
  id,
  title
}: {
  children: ReactNode;
  description: string;
  id?: string;
  title: string;
}) {
  return (
    <section className="panel-card p-5" id={id}>
      <div className="mb-5 border-b border-[#efeff5] pb-4">
        <h2 className="m-0 text-base font-semibold text-[#20212c]">{title}</h2>
        <p className="m-0 mt-1 text-sm text-[#74758a]">{description}</p>
      </div>
      {children}
    </section>
  );
}
