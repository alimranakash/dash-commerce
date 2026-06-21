export type ProductListItem = {
  category: { id: string; name: string } | null;
  id: string;
  imageUrl: string | null;
  price: string;
  slug: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  stockQuantity: number;
  title: string;
};

export type ProductListStatus = "all" | "live" | "draft" | "trash";
