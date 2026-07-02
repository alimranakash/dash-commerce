"use client";

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
            <p>{item.content}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
