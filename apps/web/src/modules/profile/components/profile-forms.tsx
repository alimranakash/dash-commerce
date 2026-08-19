"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { ProfileActionState } from "../profile.actions";

type ProfileInfoValue = {
  image?: string | null;
  name?: string | null;
};

type PreferencesValue = {
  dateFormat: string;
  language: string;
  timezone: string;
};

const initialState: ProfileActionState = {
  status: "idle"
};

const inputClass = "mt-2 h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3.5 text-sm text-[#30313d] outline-none transition placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10 disabled:bg-[#f7f7fb] disabled:text-[#777985]";
const labelClass = "block text-sm font-semibold text-[#20212c]";

export function PersonalInfoForm({
  action,
  profile
}: {
  action: (state: ProfileActionState, formData: FormData) => Promise<ProfileActionState>;
  profile: ProfileInfoValue;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />
      <div className="grid gap-5 md:grid-cols-2">
        <FieldError errors={state.fieldErrors} name="name">
          <label className={labelClass}>
            Full Name
            <input className={inputClass} defaultValue={profile.name ?? ""} name="name" placeholder="Your full name" required />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="image">
          <label className={labelClass}>
            Avatar/Image URL
            <input className={inputClass} defaultValue={profile.image ?? ""} name="image" placeholder="https://..." type="url" />
          </label>
        </FieldError>
      </div>
      <FormFooter>
        <Button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
      </FormFooter>
    </form>
  );
}

export function PasswordForm({
  action,
  canChangePassword
}: {
  action: (state: ProfileActionState, formData: FormData) => Promise<ProfileActionState>;
  canChangePassword: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (!canChangePassword) {
    return (
      <div className="rounded-xl border border-[#ede9fe] bg-[#fbfaff] p-4 text-sm text-[#6b5b95]">
        Password change is unavailable for accounts that only use Google sign-in. Add email/password login later to enable this.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />
      <div className="grid gap-5 md:grid-cols-3">
        <FieldError errors={state.fieldErrors} name="currentPassword">
          <label className={labelClass}>
            Current Password
            <input className={inputClass} name="currentPassword" required type="password" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="newPassword">
          <label className={labelClass}>
            New Password
            <input className={inputClass} name="newPassword" required type="password" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="confirmPassword">
          <label className={labelClass}>
            Confirm New Password
            <input className={inputClass} name="confirmPassword" required type="password" />
          </label>
        </FieldError>
      </div>
      <FormFooter>
        <Button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
          {isPending ? "Updating..." : "Change Password"}
        </Button>
      </FormFooter>
    </form>
  );
}

export function PreferencesForm({
  action,
  preferences
}: {
  action: (state: ProfileActionState, formData: FormData) => Promise<ProfileActionState>;
  preferences: PreferencesValue;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />
      <div className="grid gap-5 md:grid-cols-3">
        <FieldError errors={state.fieldErrors} name="language">
          <label className={labelClass}>
            Language
            <select className={inputClass} defaultValue={preferences.language} name="language">
              <option value="en">English</option>
              <option value="bn">Bangla</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="timezone">
          <label className={labelClass}>
            Timezone
            <select className={inputClass} defaultValue={preferences.timezone} name="timezone">
              <option value="Asia/Dhaka">Asia/Dhaka</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="dateFormat">
          <label className={labelClass}>
            Date Format
            <select className={inputClass} defaultValue={preferences.dateFormat} name="dateFormat">
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </label>
        </FieldError>
      </div>
      <FormFooter>
        <Button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </FormFooter>
    </form>
  );
}

function ActionMessage({ state }: { state: ProfileActionState }) {
  if (state.status === "idle") return null;

  return (
    <p className={state.status === "success" ? "success-message" : "form-error"}>
      {state.message}
    </p>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div>
      {children}
      {errors?.[name] ? <p className="form-error">{errors[name]}</p> : null}
    </div>
  );
}

function FormFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end border-t border-[#efeff5] pt-5">{children}</div>;
}
