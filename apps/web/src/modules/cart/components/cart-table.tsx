import type { Cart } from "../cart.types";
import { CartRow } from "./cart-row";

type CartTableProps = {
  cart: Cart;
  currency: string;
  showBrand: boolean;
  showRemoveButton: boolean;
  showVariant: boolean;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

export function CartTable({
  cart,
  currency,
  showBrand,
  showRemoveButton,
  showVariant,
  storeId,
  storeName,
  storeSlug
}: CartTableProps) {
  return (
    <div className="general-cart-table" role="table" aria-label="Cart products">
      <div className="general-cart-head" role="row">
        <span role="columnheader">Product</span>
        <span role="columnheader">Price</span>
        <span role="columnheader">Quantity</span>
        <span role="columnheader">Total</span>
        <span role="columnheader">Remove</span>
      </div>
      <div className="general-cart-body">
        {cart.items.map((item) => (
          <CartRow
            currency={currency}
            item={item}
            key={item.lineId}
            showBrand={showBrand}
            showRemoveButton={showRemoveButton}
            showVariant={showVariant}
            storeId={storeId}
            storeName={storeName}
            storeSlug={storeSlug}
          />
        ))}
      </div>
    </div>
  );
}
