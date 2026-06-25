import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth";

export async function requirePlatformAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
