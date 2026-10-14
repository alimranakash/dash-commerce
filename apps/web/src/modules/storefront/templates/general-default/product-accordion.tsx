"use client";

import { ProductRichText } from "../../components/product-rich-text";

type ProductAccordionItem = {
  content: string;
  title: string;
};

type GeneralProductAccordionProps = {
  items: ProductAccordionItem[];
};

export function GeneralProductAccordion({ items }: GeneralProductAccordionProps) {
  return (
    <div className="general-product-accordion">
      {items.map((item, index) => (
        <details key={item.title} open={index === 0}>
          <summary>{item.title}</summary>
          <div>
            <ProductRichText className="general-product-accordion-copy" text={item.content} />
          </div>
        </details>
      ))}
    </div>
  );
}
