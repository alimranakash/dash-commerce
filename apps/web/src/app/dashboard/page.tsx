import { requireUser } from "../../lib/auth";
import { LogoutButton } from "../../modules/auth/logout-button";
import { OnboardingForm } from "../../modules/onboarding/onboarding-form";
import { getCurrentStore } from "../../modules/stores/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const store = await getCurrentStore();
  const primaryDomain = store?.domains.find((domain) => domain.isPrimary) ?? store?.domains[0];

  if (!store) {
    return (
      <main className="dashboard-page">
        <section className="onboarding-shell" aria-labelledby="onboarding-title">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">Workspace setup</p>
              <h1 id="onboarding-title">Create your organization and first store</h1>
              <p className="auth-copy">
                Welcome, {user.name ?? user.email}. This creates your owner organization, store,
                and default Dash subdomain.
              </p>
            </div>
            <LogoutButton />
          </div>
          <OnboardingForm />
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell dashboard-overview" aria-labelledby="dashboard-title">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">Seller dashboard</p>
            <h1 id="dashboard-title">Welcome, {user.name ?? user.email}</h1>
            <p className="auth-copy">Your commerce workspace is ready for the next build phase.</p>
          </div>
          <LogoutButton />
        </div>
        <div className="overview-grid">
          <div className="metric-card">
            <span>Store</span>
            <strong>{store.name}</strong>
          </div>
          <div className="metric-card">
            <span>Slug</span>
            <strong>{store.slug}</strong>
          </div>
          <div className="metric-card">
            <span>Status</span>
            <strong>{store.status.toLowerCase()}</strong>
          </div>
          <div className="metric-card">
            <span>Primary domain</span>
            <strong>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
