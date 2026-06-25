import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminPlansPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Prepare subscription plans, pricing tiers, and feature limits." title="Plans" />
      <AdminPlaceholderCard title="Plan Management Coming Soon" />
    </section>
  );
}
