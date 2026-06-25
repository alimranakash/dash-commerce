import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminStoresPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Monitor tenant stores, statuses, domains, and health." title="Stores" />
      <AdminPlaceholderCard title="Store Management Coming Soon" />
    </section>
  );
}
