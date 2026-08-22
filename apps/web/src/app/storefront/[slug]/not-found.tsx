import Link from "next/link";

export default function StorefrontNotFound() {
  return (
    <main className="sf-page">
      <section className="sf-missing" aria-labelledby="storefront-404">
        <p>Storefront unavailable</p>
        <h1 id="storefront-404">This store could not be found.</h1>
        <span>
          The storefront may not exist yet, or the domain may not be connected to StoreIM.
        </span>
        <Link className="sf-button" href="/">
          Back to StoreIM
        </Link>
      </section>
    </main>
  );
}
