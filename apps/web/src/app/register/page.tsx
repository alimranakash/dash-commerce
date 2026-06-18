import { getCurrentUser } from "../../lib/auth";
import { RegisterForm } from "../../modules/auth/register-form";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="register-title">
        <p className="eyebrow">Dash Commerce OS</p>
        <h1 id="register-title">Create your account</h1>
        <p className="auth-copy">Start with a secure account. Organizations and stores come next.</p>
        <RegisterForm />
      </section>
    </main>
  );
}
