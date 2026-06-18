import type { CartItem } from "../cart.types";

type CartLineItemProps = {
  currency: string;
  item: CartItem;
  storeId: string;
  storeSlug: string;
};

export function CartLineItem({ currency, item, storeId, storeSlug }: CartLineItemProps) {
  return (
    <article className="sf-cart-line">
      <div className="sf-cart-image">
        {item.image ? <img alt={item.title} src={item.image} /> : <span>No image</span>}
      </div>
      <div className="sf-cart-details">
        <h2>{item.title}</h2>
        <span>{formatMoney(item.price, currency)}</span>
      </div>
      <form action="/api/cart" className="sf-cart-quantity" method="post">
        <input name="cartAction" type="hidden" value="update" />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="storeSlug" type="hidden" value={storeSlug} />
        <input name="productId" type="hidden" value={item.productId} />
        <label htmlFor={`quantity-${item.productId}`}>Quantity</label>
        <input
          defaultValue={item.quantity}
          id={`quantity-${item.productId}`}
          min="1"
          name="quantity"
          type="number"
        />
        <button type="submit">Update</button>
      </form>
      <div className="sf-cart-line-total">
        <span>Line total</span>
        <strong>{formatMoney(item.lineTotal, currency)}</strong>
      </div>
      <form action="/api/cart" method="post">
        <input name="cartAction" type="hidden" value="remove" />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="storeSlug" type="hidden" value={storeSlug} />
        <input name="productId" type="hidden" value={item.productId} />
        <button className="sf-text-button" type="submit">
          Remove
        </button>
      </form>
    </article>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
