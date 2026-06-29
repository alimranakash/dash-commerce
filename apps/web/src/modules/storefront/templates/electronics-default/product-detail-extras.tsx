import type { StorefrontTemplateProductDetailExtrasProps } from "../types";

export function ElectronicsProductDetailExtras({
  product,
  store
}: StorefrontTemplateProductDetailExtrasProps) {
  return (
    <div className="electronics-product-detail-extras">
      <dl>
        <div>
          <dt>Brand</dt>
          <dd>{store.name}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{product.sku || "Model details coming soon"}</dd>
        </div>
        <div>
          <dt>Warranty</dt>
          <dd>Seller warranty support</dd>
        </div>
      </dl>
      <section aria-label="Specifications placeholder">
        <h2>Key Specifications</h2>
        <ul>
          <li>Product specifications can be added from future product attributes.</li>
          <li>Compatibility, power, storage, or connectivity details will appear here.</li>
          <li>Support and warranty notes are managed by the seller.</li>
        </ul>
      </section>
    </div>
  );
}
