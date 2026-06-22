import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { AuthExperience } from "../../modules/auth/auth-experience";
import { RegisterForm } from "../../modules/auth/register-form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <AuthExperience description="Create your account, shape your store identity, and step into a calmer way to run commerce." eyebrow="Start building" title="Your next stage starts here."><RegisterForm /></AuthExperience>;
}
