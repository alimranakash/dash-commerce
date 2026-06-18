import { Button } from "@dash/ui";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Dash Commerce OS</p>
        <h1 id="hero-title">A clean foundation for multi-tenant commerce.</h1>
        <p className="lede">
          The platform shell is ready for storefronts, seller operations, and background commerce
          workflows to grow from a single TypeScript monorepo.
        </p>
        <div className="actions" aria-label="Project status">
          <Button className="primary" type="button">
            Foundation ready
          </Button>
          <Link className="text-link" href="/login">
            Sign in
          </Link>
          <span>Next.js App Router - Turborepo - Shared packages</span>
        </div>
      </section>
    </main>
  );
}
