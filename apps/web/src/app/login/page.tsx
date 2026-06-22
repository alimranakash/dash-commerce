import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { AuthExperience } from "../../modules/auth/auth-experience";
import { LoginForm } from "../../modules/auth/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <AuthExperience description="Welcome back. Your store, orders, and insights are ready when you are." eyebrow="Seller access" title="Log in to your commerce OS."><LoginForm /></AuthExperience>;
}
