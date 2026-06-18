import Link from "next/link";

export default function StorefrontNotFound() {
  return (
    <main className="storefront-page">
      <section className="storefront-hero storefront-not-found" aria-labelledby="storefront-404">
        <p className="eyebrow">Storefront unavailable</p>
        <h1 id="storefront-404">This store could not be found.</h1>
        <p className="lede">
          The storefront may not exist yet, or the domain may not be connected to Dash Commerce OS.
        </p>
        <Link className="text-link" href="/">
          Back to Dash Commerce OS
        </Link>
      </section>
    </main>
  );
}
