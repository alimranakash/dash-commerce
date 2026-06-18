import { getCurrentUser } from "../../lib/auth";
import { LoginForm } from "../../modules/auth/login-form";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">Dash Commerce OS</p>
        <h1 id="login-title">Sign in</h1>
        <p className="auth-copy">Access the seller dashboard for your commerce workspace.</p>
        <LoginForm />
      </section>
    </main>
  );
}
