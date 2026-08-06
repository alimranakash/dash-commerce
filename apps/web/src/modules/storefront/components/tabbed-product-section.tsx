import type { CSSProperties } from "react";
import { ProductCarousel } from "./product-carousel";
import { ProductGrid } from "./product-listing";
import { TabbedProductTabs } from "./tabbed-product-tabs";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontTabbedProductShowcaseSettings,
  type StorefrontTabbedProductSource
} from "../customization";
import type { StorefrontProduct } from "../storefront.types";

type TabbedProductSectionProps = {
  currency: string;
  productsBySource: Partial<Record<StorefrontTabbedProductSource, StorefrontProduct[]>>;
  section: StorefrontTabbedProductShowcaseSettings;
  storeSlug: string;
};

export function TabbedProductSection({
  currency,
  productsBySource,
  section,
  storeSlug
}: TabbedProductSectionProps) {
  if (!section.enabled) {
    return null;
  }

  const enabledTabs = section.tabs.filter((tab) => tab.enabled);

  if (enabledTabs.length === 0) {
    return null;
  }

  const sectionId = "tabbed-product-showcase";
  const titleId = section.title ? `${sectionId}-title` : undefined;
  const baseProductSection = {
    ...DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.featured,
    columns: section.productsPerView,
    count: section.productsPerTab,
    mode: section.sliderEnabled ? "slider" : "grid",
    title: section.title || "Products"
  } as const;

  return (
    <section
      className={`tabbed-product-showcase${section.fullWidth ? " is-full-width" : " is-boxed"}`}
      style={{
        "--tabbed-showcase-bg": section.backgroundColor,
        "--tabbed-showcase-spacing": `${section.sectionSpacing}px`
      } as CSSProperties}
      aria-label={titleId ? undefined : "Tabbed product showcase"}
      aria-labelledby={titleId}
    >
      <div className="tabbed-product-showcase-inner">
        <div className="tabbed-product-showcase-header">
          <div>
            {section.title ? <h2 id={titleId}>{section.title}</h2> : null}
            {section.description ? <p>{section.description}</p> : null}
          </div>
        </div>
        <TabbedProductTabs
          arrowsVisible={section.arrowsVisible}
          autoplay={section.autoplay}
          defaultActiveTab={section.defaultActiveTab}
          infiniteLoop={section.infiniteLoop}
          panels={enabledTabs.map((tab, index) => {
            const products = resolveProducts(productsBySource, tab.source).slice(0, tab.productCount || section.productsPerTab);
            const panelSection = {
              ...baseProductSection,
              count: tab.productCount || section.productsPerTab
            };

            return (
              <ProductCarousel key={`${tab.label}-${tab.source}-${index}`}>
                <ProductGrid
                  currency={currency}
                  gridId={`${sectionId}-panel-${index}`}
                  products={products}
                  section={panelSection}
                  storeSlug={storeSlug}
                />
              </ProductCarousel>
            );
          })}
          scrollAmount={section.scrollAmount}
          sectionId={sectionId}
          sliderEnabled={section.sliderEnabled}
          tabs={enabledTabs.map((tab, index) => ({
            label: tab.label,
            panelId: `${sectionId}-panel-${index}`
          }))}
        />
      </div>
    </section>
  );
}

function resolveProducts(
  productsBySource: Partial<Record<StorefrontTabbedProductSource, StorefrontProduct[]>>,
  source: StorefrontTabbedProductSource
) {
  return productsBySource[source]?.length
    ? productsBySource[source] ?? []
    : productsBySource.all ?? productsBySource.featured ?? [];
}
