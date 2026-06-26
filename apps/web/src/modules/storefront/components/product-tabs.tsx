"use client";

import { useState } from "react";

type ProductTabsProps = {
  brand: string;
  categoryName: string | null;
  description: string | null;
  sku: string | null;
};

const tabs = ["Description", "Specifications", "Reviews", "Shipping & Returns"] as const;

export function ProductTabs({ brand, categoryName, description, sku }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Description");

  return (
    <section className="sf-product-tabs" aria-label="Product details">
      <div className="sf-tab-list" role="tablist" aria-label="Product details">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "active" : undefined}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="sf-tab-panel" role="tabpanel">
        {activeTab === "Description" ? (
          <>
            <h2>Product details</h2>
            <p>{description || "Detailed product information will be available soon."}</p>
          </>
        ) : null}

        {activeTab === "Specifications" ? (
          <>
            <h2>Specifications</h2>
            <dl>
              <dt>Brand</dt>
              <dd>{brand}</dd>
              {categoryName ? (
                <>
                  <dt>Category</dt>
                  <dd>{categoryName}</dd>
                </>
              ) : null}
              {sku ? (
                <>
                  <dt>SKU</dt>
                  <dd>{sku}</dd>
                </>
              ) : null}
              <dt>Variants</dt>
              <dd>Product variants are coming soon.</dd>
              <dt>Video</dt>
              <dd>Product videos are coming soon.</dd>
            </dl>
          </>
        ) : null}

        {activeTab === "Reviews" ? (
          <>
            <h2>Reviews</h2>
            <p>Customer reviews and AI recommendations will appear here once available.</p>
          </>
        ) : null}

        {activeTab === "Shipping & Returns" ? (
          <>
            <h2>Shipping & Returns</h2>
            <p>
              Shipping options, easy returns, and frequently bought together recommendations will be
              shown here as the storefront grows.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
