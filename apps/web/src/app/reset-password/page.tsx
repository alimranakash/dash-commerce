import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { AuthExperience } from "../../modules/auth/auth-experience";
import { ResetPasswordForm } from "../../modules/auth/reset-password-form";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <AuthExperience description="Send yourself a code, then choose a new password. It works with whichever email or number you sign in with." eyebrow="Account recovery" title="Reset your password."><ResetPasswordForm /></AuthExperience>;
}
