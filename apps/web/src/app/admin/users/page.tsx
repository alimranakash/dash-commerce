import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminUsersPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Review platform users, roles, and access status." title="Users" />
      <AdminPlaceholderCard title="User Management Coming Soon" />
    </section>
  );
}
