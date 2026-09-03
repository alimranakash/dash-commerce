import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getPlatformRootDomain } from "../../lib/host-routing";
import { RegisterForm } from "../../modules/auth/register-form";
import { storePreviewDesigns } from "../../modules/onboarding/store-preview";

/**
 * The form owns its own shell: sign-up steps render in the narrow auth layout,
 * and from the store step on it becomes the full setup wizard, so the page
 * cannot wrap it in a fixed one.
 */
export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <RegisterForm platformDomain={getPlatformRootDomain()} storeDesigns={storePreviewDesigns} />;
}
