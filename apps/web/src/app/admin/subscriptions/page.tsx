import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminSubscriptionsPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Track tenant subscriptions, renewals, trials, and cancellations." title="Subscriptions" />
      <AdminPlaceholderCard title="Subscription Management Coming Soon" />
    </section>
  );
}
