export function NewsletterCta() {
  return (
    <section className="sf-newsletter" aria-labelledby="storefront-newsletter">
      <div>
        <p>New arrivals and offers</p>
        <h2 id="storefront-newsletter">Stay updated with new products and offers</h2>
      </div>
      <div className="sf-newsletter-form" aria-label="Newsletter signup">
        <input placeholder="Enter your email" type="email" />
        <button type="button">Subscribe</button>
      </div>
    </section>
  );
}
