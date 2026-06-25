import { AdminPageHeader, AdminPlaceholderCard } from "../../../components/admin/admin-ui";

export default function AdminSupportPage() {
  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Handle merchant support requests and escalation workflows." title="Support" />
      <AdminPlaceholderCard title="Support Desk Coming Soon" />
    </section>
  );
}
