import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminLogsPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Inspect platform audit logs, admin actions, and system events." title="Logs" />
      <AdminPlaceholderCard title="Audit Logs Coming Soon" />
    </section>
  );
}
