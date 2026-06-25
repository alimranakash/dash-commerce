import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../components/admin/admin-shell";
import { requireUser } from "../../lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <AdminShell
      admin={{
        image: user.image ?? null,
        name: user.name ?? null
      }}
    >
      {children}
    </AdminShell>
  );
}
