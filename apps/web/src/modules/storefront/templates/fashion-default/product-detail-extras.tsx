import type { StorefrontTemplateProductDetailExtrasProps } from "../types";

export function FashionProductDetailExtras({ product }: StorefrontTemplateProductDetailExtrasProps) {
  return (
    <div className="fashion-product-detail-extras">
      <div>
        <span>Size</span>
        <div aria-label="Size options placeholder">
          {["S", "M", "L", "XL"].map((size) => (
            <button disabled key={size} type="button">
              {size}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span>Color</span>
        <div aria-label="Color options placeholder">
          {["#111827", "#b45309", "#f5e7dc"].map((color) => (
            <button
              aria-label={`Color ${color}`}
              disabled
              key={color}
              style={{ background: color }}
              type="button"
            />
          ))}
        </div>
      </div>
      <p>
        Fit, fabric, and care details for {product.title} can be added as product specifications later.
      </p>
    </div>
  );
}
