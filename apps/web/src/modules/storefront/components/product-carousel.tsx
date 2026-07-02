import type { ReactNode } from "react";

type ProductCarouselProps = {
  children: ReactNode;
};

export function ProductCarousel({ children }: ProductCarouselProps) {
  return <div className="tabbed-product-carousel">{children}</div>;
}
