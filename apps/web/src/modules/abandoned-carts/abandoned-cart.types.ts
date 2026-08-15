export type AbandonedCartStatus = "NOT_CONTACTED" | "CONTACTED" | "RECOVERED";

export type AbandonedCartOutreachChannel = "email" | "manual" | "whatsapp";

/** One line of a snapshotted cart, as shown in the dashboard drawer. */
export type AbandonedCartLine = {
  id: string;
  price: number;
  productName: string;
  quantity: number;
};

export type AbandonedCartRecord = {
  cartValue: number;
  currency: string;
  customerName: string;
  email: string | null;
  id: string;
  items: AbandonedCartLine[];
  lastActivity: string;
  phone: string | null;
  /** Storefront link that restores this exact cart, for manual outreach. */
  recoveryUrl: string;
  status: AbandonedCartStatus;
};

export type AbandonedCartListFilters = {
  dateRange?: string | undefined;
  limit?: number | undefined;
  search?: string | undefined;
};
