import { ProductCard } from "./product-card";
import type { StorefrontProduct } from "../storefront.types";

type FeaturedProductsProps = {
  currency: string;
  products: StorefrontProduct[];
  storeSlug: string;
};

export function FeaturedProducts({ currency, products, storeSlug }: FeaturedProductsProps) {
  return (
    <section className="sf-section" aria-labelledby="featured-products">
      <div className="sf-section-heading">
        <p>Featured</p>
        <h2 id="featured-products">Products worth a closer look</h2>
      </div>
      {products.length === 0 ? (
        <div className="sf-empty">
          <h3>Products coming soon</h3>
          <p>This store is preparing its public catalog. Check back soon for new arrivals.</p>
        </div>
      ) : (
        <div className="sf-product-grid">
          {products.map((product) => (
            <ProductCard
              currency={currency}
              key={product.id}
              product={product}
              storeSlug={storeSlug}
            />
          ))}
        </div>
      )}
    </section>
  );
}
