import Link from "next/link";

export default function StorefrontProductUnavailable() {
  return (
    <main className="sf-page">
      <section className="sf-missing" aria-labelledby="product-404">
        <p>Product unavailable</p>
        <h1 id="product-404">This product is not available.</h1>
        <span>It may have been unpublished, archived, or moved by the seller.</span>
        <Link className="sf-button" href="/">
          Back to Dash Commerce OS
        </Link>
      </section>
    </main>
  );
}
