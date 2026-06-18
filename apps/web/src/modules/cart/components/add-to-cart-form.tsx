type AddToCartFormProps = {
  maxQuantity: number;
  productId: string;
  productSlug: string;
  storeId: string;
  storeSlug: string;
};

export function AddToCartForm({
  maxQuantity,
  productId,
  productSlug,
  storeId,
  storeSlug
}: AddToCartFormProps) {
  const isUnavailable = maxQuantity < 1;

  return (
    <form action="/api/cart" className="sf-purchase-box" method="post">
      <input name="cartAction" type="hidden" value="add" />
      <input name="storeId" type="hidden" value={storeId} />
      <input name="storeSlug" type="hidden" value={storeSlug} />
      <input name="productId" type="hidden" value={productId} />
      <input name="productSlug" type="hidden" value={productSlug} />
      <label htmlFor="quantity">Quantity</label>
      <input
        defaultValue="1"
        disabled={isUnavailable}
        id="quantity"
        max={Math.max(maxQuantity, 1)}
        min="1"
        name="quantity"
        type="number"
      />
      <button disabled={isUnavailable} type="submit">
        Add to Cart
      </button>
    </form>
  );
}
