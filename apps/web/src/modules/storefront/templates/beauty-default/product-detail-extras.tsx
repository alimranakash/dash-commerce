import type { StorefrontTemplateProductDetailExtrasProps } from "../types";

export function BeautyProductDetailExtras({ product, store }: StorefrontTemplateProductDetailExtrasProps) {
  return (
    <div className="beauty-product-detail-extras">
      <dl>
        <div>
          <dt>Brand</dt>
          <dd>{store.name}</dd>
        </div>
        <div>
          <dt>Skin Type</dt>
          <dd>All skin types</dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>Seller managed</dd>
        </div>
      </dl>
      <section aria-label="Ingredients placeholder">
        <h2>Ingredients & Beauty Notes</h2>
        <p>
          Ingredient lists, shade details, skin concerns, and routine guidance for {product.title} can
          be added as product attributes later.
        </p>
      </section>
    </div>
  );
}
