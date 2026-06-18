export type CartItem = {
  productId: string;
  title: string;
  price: string;
  image: string | null;
  quantity: number;
  lineTotal: string;
};

export type CartTotals = {
  itemCount: number;
  subtotal: string;
};

export type Cart = {
  storeId: string;
  items: CartItem[];
  totals: CartTotals;
};

export type StoredCartItem = Omit<CartItem, "lineTotal">;

export type StoredCart = {
  storeId: string;
  items: StoredCartItem[];
};
