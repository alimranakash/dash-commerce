import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminPaymentsPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Review platform payment events, invoices, and payout status." title="Payments" />
      <AdminPlaceholderCard title="Payment Operations Coming Soon" />
    </section>
  );
}
