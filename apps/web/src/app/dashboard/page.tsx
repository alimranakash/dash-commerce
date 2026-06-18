import { requireUser } from "../../lib/auth";
import { LogoutButton } from "../../modules/auth/logout-button";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">Seller dashboard</p>
          <h1 id="dashboard-title">Welcome, {user.name ?? user.email}</h1>
          <p className="auth-copy">
            Authentication is ready. Organization and store setup will be added next.
          </p>
        </div>
        <LogoutButton />
      </section>
    </main>
  );
}
