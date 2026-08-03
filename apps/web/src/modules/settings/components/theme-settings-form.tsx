"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import type { MediaPickerAsset } from "../../media/media.types";
import { StorefrontSettingsToast } from "../../storefront/dashboard/storefront-settings-toast";
import {
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings,
  type StorefrontHeroSlide,
  type StorefrontProductSectionSettings
} from "../../storefront/customization";
import type { SettingsActionState } from "../settings.actions";
import { ColorPickerField, SettingsCard, ToggleField, UploadField } from "./theme-form-fields";

export type ThemeSettingsFormValue = {
  advancedSettings?: StorefrontAdvancedSettings | null;
  announcementText?: string | null;
  featuredSectionTitle: string;
  heroImageUrl?: string | null;
  heroSubtitle?: string | null;
  heroTitle: string;
  primaryColor: string;
  secondaryColor?: string | null;
  themeName: string;
};

type ThemeSettingsFormProps = {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  mediaAssets?: MediaPickerAsset[];
  settings: ThemeSettingsFormValue;
};

const initialState: SettingsActionState = {
  status: "idle"
};

export function ThemeSettingsForm({ action, mediaAssets = [], settings }: ThemeSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const advanced = normalizeAdvancedSettings(settings.advancedSettings);
  const slides = normalizeSlides(advanced.hero.slides);
  const announcementText = advanced.announcement.messages[0]?.text ?? settings.announcementText ?? "";

  return (
    <form action={formAction} className="theme-settings-form">
      <StorefrontSettingsToast
        message={state.status === "idle" ? null : state.message}
        messageKey={state.toastId}
        type={state.status === "error" ? "error" : "success"}
      />
      <input name="themeName" type="hidden" value="Theme v1" />
      <input name="announcementText" type="hidden" value={announcementText} />

      <SettingsCard
        id="announcement-bar"
        title="Announcement Bar"
        description="Create a full-width scrolling top bar with promotional messages."
      >
        <div className="theme-settings-grid three">
          <ToggleField label="Enable announcement bar" name="announcementEnabled" value={advanced.announcement.enabled} />
          <ColorPickerField label="Background color" name="announcementBackgroundColor" value={advanced.announcement.backgroundColor} />
          <ColorPickerField label="Text color" name="announcementTextColor" value={advanced.announcement.textColor} />
          <label>
            Scroll speed
            <select defaultValue={advanced.announcement.scrollSpeed} name="announcementScrollSpeed">
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label>
            Font size
            <input defaultValue={advanced.announcement.fontSize} max={20} min={10} name="announcementFontSize" type="number" />
          </label>
        </div>
        <RepeaterTextarea
          helper="One message per line. Add a link like: Free shipping | /products"
          label="Messages"
          name="announcementMessages"
          value={advanced.announcement.messages.map((message) => `${message.text}${message.link ? ` | ${message.link}` : ""}`).join("\n")}
        />
      </SettingsCard>

      <SettingsCard
        id="header"
        title="Header"
        description="Control storefront logo, navigation, icons, sticky behavior, and colors."
      >
        <div className="theme-settings-grid three">
          <ToggleField label="Enable header" name="headerEnabled" value={advanced.header.enabled} />
          <ToggleField label="Sticky header" name="headerSticky" value={advanced.header.sticky} />
          <ToggleField label="Show search" name="headerShowSearch" value={advanced.header.showSearch} />
          <ToggleField label="Show account" name="headerShowAccount" value={advanced.header.showAccount} />
          <ToggleField label="Show cart" name="headerShowCart" value={advanced.header.showCart} />
          <ToggleField label="Show currency/language" name="headerShowCurrency" value={advanced.header.showCurrency} />
        </div>
        <div className="theme-settings-grid three">
          <label>
            Logo text override
            <input defaultValue={advanced.header.logoText ?? ""} name="headerLogoText" placeholder="Optional" type="text" />
          </label>
          <label>
            Header height
            <input defaultValue={advanced.header.height} max={140} min={56} name="headerHeight" type="number" />
          </label>
          <label>
            Menu spacing
            <input defaultValue={advanced.header.spacing} max={96} min={16} name="headerSpacing" type="number" />
          </label>
          <ColorPickerField label="Header background" name="headerBackgroundColor" value={advanced.header.backgroundColor} />
          <ColorPickerField label="Header text color" name="headerTextColor" value={advanced.header.textColor} />
        </div>
        <RepeaterTextarea
          helper="One item per line. Format: Label | /path. Reorder lines to reorder menu."
          label="Menu items"
          name="headerMenuItems"
          value={advanced.header.menuItems.map((item) => `${item.label} | ${item.url}`).join("\n")}
        />
      </SettingsCard>

      <SettingsCard
        id="hero-section"
        title="Hero Section"
        description="Manage the top hero with image, slider, video, YouTube, overlay, title, and CTA buttons."
      >
        <div className="theme-settings-grid two">
          <UploadField
            assets={mediaAssets}
            fileName="heroImageFile"
            label="Hero Image"
            name="heroImageUrl"
            value={settings.heroImageUrl ?? advanced.hero.imageUrl}
          />
          <div className="theme-settings-grid two compact">
            <ToggleField label="Enable hero" name="heroEnabled" value={advanced.hero.enabled} />
            <ToggleField label="Autoplay slider" name="heroAutoplay" value={advanced.hero.autoplay} />
            <ToggleField label="Show arrows" name="heroShowArrows" value={advanced.hero.showArrows} />
            <ToggleField label="Show dots" name="heroShowDots" value={advanced.hero.showDots} />
          </div>
        </div>
        <div className="theme-settings-grid three">
          <label>
            Content type
            <select defaultValue={advanced.hero.contentType} name="heroContentType">
              <option value="single-image">Single Image</option>
              <option value="image-slider">Image Slider</option>
              <option value="single-video">Single Video</option>
              <option value="video-slider">Video Slider</option>
              <option value="mixed-slider">Mixed Slider</option>
              <option value="youtube">YouTube Video</option>
            </select>
          </label>
          <label>
            Hero height
            <select defaultValue={advanced.hero.height} name="heroHeight">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            Text alignment
            <select defaultValue={advanced.hero.align} name="heroAlign">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label>
            Title
            <input defaultValue={settings.heroTitle} name="heroTitle" required type="text" />
          </label>
          <label>
            Subtitle
            <input defaultValue={settings.heroSubtitle ?? advanced.hero.subtitle} name="heroSubtitle" type="text" />
          </label>
          <label>
            Featured section title
            <input defaultValue={settings.featuredSectionTitle} name="featuredSectionTitle" required type="text" />
          </label>
          <label>
            Button 1 text
            <input defaultValue={advanced.hero.button1Text} name="heroButton1Text" type="text" />
          </label>
          <label>
            Button 1 link
            <input defaultValue={advanced.hero.button1Link} name="heroButton1Link" type="text" />
          </label>
          <label>
            Button 2 text
            <input defaultValue={advanced.hero.button2Text} name="heroButton2Text" type="text" />
          </label>
          <label>
            Button 2 link
            <input defaultValue={advanced.hero.button2Link} name="heroButton2Link" type="text" />
          </label>
          <ColorPickerField label="Text color" name="heroTextColor" value={advanced.hero.textColor} />
          <ColorPickerField label="Overlay color" name="heroOverlayColor" value={advanced.hero.overlayColor} />
          <label>
            Overlay opacity
            <input defaultValue={advanced.hero.overlayOpacity} max={90} min={0} name="heroOverlayOpacity" type="number" />
          </label>
          <label>
            Slider speed
            <input defaultValue={advanced.hero.sliderSpeed} max={12000} min={2000} name="heroSliderSpeed" type="number" />
          </label>
          <label>
            Custom height
            <input defaultValue={advanced.hero.customHeight ?? ""} max={1000} min={320} name="heroCustomHeight" type="number" />
          </label>
          <label>
            Layout width
            <select defaultValue={advanced.hero.layoutWidth} name="heroLayoutWidth">
              <option value="full">Full width</option>
              <option value="boxed">Boxed width</option>
              <option value="custom">Custom width</option>
            </select>
          </label>
          <label>
            Custom width
            <input defaultValue={advanced.hero.customWidth ?? ""} max={1920} min={720} name="heroCustomWidth" type="number" />
          </label>
          <label>
            Button style
            <select defaultValue={advanced.hero.buttonStyle} name="heroButtonStyle">
              <option value="light">Light</option>
              <option value="filled">Filled</option>
              <option value="outline">Outline</option>
            </select>
          </label>
          <label>
            Video URL
            <input defaultValue={advanced.hero.videoUrl ?? ""} name="heroVideoUrl" placeholder="Optional video URL" type="url" />
          </label>
          <label>
            YouTube URL
            <input defaultValue={advanced.hero.youtubeUrl ?? ""} name="heroYoutubeUrl" placeholder="https://youtube.com/watch?v=..." type="url" />
          </label>
        </div>
        <div className="theme-slider-editor">
          <div>
            <h3>Hero Slider Images</h3>
            <p>Upload up to 4 slides. Use the title/subtitle fields only when a slide needs custom copy.</p>
          </div>
          {slides.map((slide, index) => (
            <HeroSlideFields assets={mediaAssets} index={index} key={index} slide={slide} />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        id="colors-layout"
        title="Colors & Layout"
        description="Reusable storefront color and layout controls for all templates."
      >
        <div className="theme-settings-grid three">
          <ColorPickerField label="Primary color" name="primaryColor" value={settings.primaryColor} />
          <ColorPickerField label="Secondary color" name="secondaryColor" value={settings.secondaryColor ?? "#f5f1e8"} />
          <ColorPickerField label="Page background" name="layoutPageBackgroundColor" value={advanced.layout.pageBackgroundColor} />
          <label>
            Storefront width
            <select defaultValue={advanced.layout.widthMode} name="layoutWidthMode">
              <option value="full">Full width</option>
              <option value="boxed">Boxed</option>
            </select>
          </label>
          <label>
            Boxed max width
            <input defaultValue={advanced.layout.boxedMaxWidth} max={1920} min={960} name="layoutBoxedMaxWidth" type="number" />
          </label>
          <label>
            Section spacing
            <input defaultValue={advanced.layout.sectionPadding} max={120} min={24} name="layoutSectionPadding" type="number" />
          </label>
        </div>
      </SettingsCard>

      <SettingsCard
        id="tabbed-product-showcase"
        title="Tabbed Product Showcase"
        description="Create a premium product rail with category-style tabs, slider controls, and reusable product sources."
      >
        <div className="theme-settings-grid three">
          <ToggleField label="Enable section" name="tabbedShowcaseEnabled" value={advanced.tabbedProductShowcase.enabled} />
          <ToggleField label="Full width" name="tabbedShowcaseFullWidth" value={advanced.tabbedProductShowcase.fullWidth} />
          <ToggleField label="Enable slider" name="tabbedShowcaseSliderEnabled" value={advanced.tabbedProductShowcase.sliderEnabled} />
          <ToggleField label="Show arrows" name="tabbedShowcaseArrowsVisible" value={advanced.tabbedProductShowcase.arrowsVisible} />
          <ToggleField label="Autoplay" name="tabbedShowcaseAutoplay" value={advanced.tabbedProductShowcase.autoplay} />
          <ToggleField label="Infinite loop" name="tabbedShowcaseInfiniteLoop" value={advanced.tabbedProductShowcase.infiniteLoop} />
        </div>
        <div className="theme-settings-grid three">
          <label>
            Section title
            <input defaultValue={advanced.tabbedProductShowcase.title} name="tabbedShowcaseTitle" placeholder="Optional" type="text" />
          </label>
          <label>
            Section description
            <input defaultValue={advanced.tabbedProductShowcase.description} name="tabbedShowcaseDescription" type="text" />
          </label>
          <ColorPickerField label="Background color" name="tabbedShowcaseBackgroundColor" value={advanced.tabbedProductShowcase.backgroundColor} />
          <label>
            Products per tab
            <input defaultValue={advanced.tabbedProductShowcase.productsPerTab} max={20} min={1} name="tabbedShowcaseProductsPerTab" type="number" />
          </label>
          <label>
            Products per view
            <select defaultValue={advanced.tabbedProductShowcase.productsPerView} name="tabbedShowcaseProductsPerView">
              <option value={2}>2 products</option>
              <option value={3}>3 products</option>
              <option value={4}>4 products</option>
              <option value={5}>5 products</option>
            </select>
          </label>
          <label>
            Default active tab
            <input defaultValue={advanced.tabbedProductShowcase.defaultActiveTab} max={7} min={0} name="tabbedShowcaseDefaultActiveTab" type="number" />
          </label>
          <label>
            Section spacing
            <input defaultValue={advanced.tabbedProductShowcase.sectionSpacing} max={140} min={32} name="tabbedShowcaseSectionSpacing" type="number" />
          </label>
          <label>
            Scroll amount
            <select defaultValue={advanced.tabbedProductShowcase.scrollAmount} name="tabbedShowcaseScrollAmount">
              <option value="page">Page</option>
              <option value="one">One product</option>
            </select>
          </label>
        </div>
        <RepeaterTextarea
          helper="One tab per line. Format: Label | source | product count | enabled. Sources: all, featured, best-sellers, new-arrivals, on-sale, category, collection, manual."
          label="Tabs"
          name="tabbedShowcaseTabs"
          value={advanced.tabbedProductShowcase.tabs.map((tab) => `${tab.label} | ${tab.source} | ${tab.productCount} | ${tab.enabled}`).join("\n")}
        />
      </SettingsCard>

      <SettingsCard
        id="shop-collection-page"
        title="Shop / Collection Page"
        description="Control the premium product listing page header, toolbar, filters, sorting, grid, and product card options."
      >
        <div className="theme-settings-grid three">
          <label>
            Page title
            <input defaultValue={advanced.shopPage.pageTitle} name="shopPageTitle" type="text" />
          </label>
          <label>
            Description
            <input defaultValue={advanced.shopPage.description} name="shopDescription" type="text" />
          </label>
          <ToggleField label="Show description" name="shopDescriptionEnabled" value={advanced.shopPage.descriptionEnabled} />
          <label>
            Products per row
            <select defaultValue={advanced.shopPage.productsPerRow} name="shopProductsPerRow">
              <option value={2}>2 columns</option>
              <option value={3}>3 columns</option>
              <option value={4}>4 columns</option>
            </select>
          </label>
          <label>
            Products per page
            <input defaultValue={advanced.shopPage.productsPerPage} max={48} min={4} name="shopProductsPerPage" type="number" />
          </label>
          <label>
            Grid spacing
            <input defaultValue={advanced.shopPage.gridSpacing} max={36} min={0} name="shopGridSpacing" type="number" />
          </label>
          <label>
            Section spacing
            <input defaultValue={advanced.shopPage.sectionSpacing} max={140} min={32} name="shopSectionSpacing" type="number" />
          </label>
          <label>
            Width mode
            <select defaultValue={advanced.shopPage.widthMode} name="shopWidthMode">
              <option value="full">Full width</option>
              <option value="boxed">Boxed</option>
              <option value="custom">Custom container</option>
            </select>
          </label>
          <label>
            Pagination
            <select defaultValue={advanced.shopPage.paginationMode} name="shopPaginationMode">
              <option value="pagination">Pagination</option>
              <option value="load-more">Load more</option>
            </select>
          </label>
          <label>
            Default sorting
            <select defaultValue={advanced.shopPage.defaultSort} name="shopDefaultSort">
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="best-selling">Best Selling</option>
              <option value="price-asc">Price Low -&gt; High</option>
              <option value="price-desc">Price High -&gt; Low</option>
              <option value="alpha-asc">Alphabetically A-Z</option>
              <option value="alpha-desc">Alphabetically Z-A</option>
            </select>
          </label>
        </div>
        <div className="theme-settings-grid four compact">
          <ToggleField label="Show filter button" name="shopEnableFilters" value={advanced.shopPage.enableFilters} />
          <ToggleField label="Show sorting" name="shopEnableSorting" value={advanced.shopPage.enableSorting} />
          <ToggleField label="Show result counter" name="shopEnableResultCounter" value={advanced.shopPage.enableResultCounter} />
          <ToggleField label="Collections filter" name="shopEnableCollectionFilter" value={advanced.shopPage.enableCollectionFilter} />
          <ToggleField label="Categories filter" name="shopEnableCategoryFilter" value={advanced.shopPage.enableCategoryFilter} />
          <ToggleField label="Brand filter" name="shopEnableBrandFilter" value={advanced.shopPage.enableBrandFilter} />
          <ToggleField label="Price filter" name="shopEnablePriceFilter" value={advanced.shopPage.enablePriceFilter} />
          <ToggleField label="Availability filter" name="shopEnableAvailabilityFilter" value={advanced.shopPage.enableAvailabilityFilter} />
          <ToggleField label="Tags filter" name="shopEnableTagFilter" value={advanced.shopPage.enableTagFilter} />
          <ToggleField label="Colors filter" name="shopEnableColorFilter" value={advanced.shopPage.enableColorFilter} />
          <ToggleField label="Sizes filter" name="shopEnableSizeFilter" value={advanced.shopPage.enableSizeFilter} />
          <ToggleField label="Show product brand" name="shopEnableProductBrand" value={advanced.shopPage.enableProductBrand} />
          <ToggleField label="Show compare price" name="shopEnableComparePrice" value={advanced.shopPage.enableComparePrice} />
          <ToggleField label="Show badges" name="shopEnableProductBadges" value={advanced.shopPage.enableProductBadges} />
          <ToggleField label="Show color count" name="shopEnableProductColorCount" value={advanced.shopPage.enableProductColorCount} />
          <ToggleField label="Hover image" name="shopEnableHoverImage" value={advanced.shopPage.enableHoverImage} />
          <ToggleField label="Quick view placeholder" name="shopEnableQuickView" value={advanced.shopPage.enableQuickView} />
        </div>
        <RepeaterTextarea
          helper="One option per line. Supported values: featured, newest, best-selling, price-asc, price-desc, alpha-asc, alpha-desc."
          label="Available sorting options"
          name="shopSortOptions"
          value={advanced.shopPage.sortOptions.join("\n")}
        />
      </SettingsCard>

      <SettingsCard
        id="cart-page"
        title="Cart Page"
        description="Control the minimal cart layout, free shipping progress, order notes, and checkout button style."
      >
        <div className="theme-settings-grid three">
          <ToggleField label="Enable breadcrumb" name="cartBreadcrumbEnabled" value={advanced.cartPage.breadcrumbEnabled} />
          <ToggleField label="Enable free shipping bar" name="cartFreeShippingEnabled" value={advanced.cartPage.freeShippingEnabled} />
          <ToggleField label="Enable order notes" name="cartOrderNotesEnabled" value={advanced.cartPage.orderNotesEnabled} />
          <ToggleField label="Show estimated delivery" name="cartEstimatedDeliveryEnabled" value={advanced.cartPage.estimatedDeliveryEnabled} />
          <ToggleField label="Show taxes" name="cartTaxesEnabled" value={advanced.cartPage.taxesEnabled} />
          <ToggleField label="Show brand" name="cartShowBrand" value={advanced.cartPage.showBrand} />
          <ToggleField label="Show variant" name="cartShowVariant" value={advanced.cartPage.showVariant} />
          <ToggleField label="Show remove button" name="cartShowRemoveButton" value={advanced.cartPage.showRemoveButton} />
          <label>
            Width mode
            <select defaultValue={advanced.cartPage.widthMode} name="cartWidthMode">
              <option value="full">Full width</option>
              <option value="boxed">Boxed</option>
            </select>
          </label>
          <label>
            Free shipping amount
            <input defaultValue={advanced.cartPage.freeShippingAmount} min={0} name="cartFreeShippingAmount" type="number" />
          </label>
          <label>
            Free shipping text
            <input defaultValue={advanced.cartPage.freeShippingText} name="cartFreeShippingText" type="text" />
          </label>
          <label>
            Free shipping CTA
            <input defaultValue={advanced.cartPage.freeShippingCtaText} name="cartFreeShippingCtaText" type="text" />
          </label>
          <label>
            Free shipping CTA link
            <input defaultValue={advanced.cartPage.freeShippingCtaLink} name="cartFreeShippingCtaLink" type="text" />
          </label>
          <label>
            Checkout button text
            <input defaultValue={advanced.cartPage.checkoutButtonText} name="cartCheckoutButtonText" type="text" />
          </label>
          <ColorPickerField
            label="Checkout button background"
            name="cartCheckoutButtonBackgroundColor"
            value={advanced.cartPage.checkoutButtonBackgroundColor}
          />
          <ColorPickerField
            label="Checkout button text"
            name="cartCheckoutButtonTextColor"
            value={advanced.cartPage.checkoutButtonTextColor}
          />
          <label>
            Button radius
            <input
              defaultValue={advanced.cartPage.checkoutButtonBorderRadius}
              max={32}
              min={0}
              name="cartCheckoutButtonBorderRadius"
              type="number"
            />
          </label>
          <label>
            Continue shopping link
            <input defaultValue={advanced.cartPage.continueShoppingLink} name="cartContinueShoppingLink" type="text" />
          </label>
        </div>
      </SettingsCard>

      <SettingsCard
        id="mini-cart-drawer"
        title="Mini Cart Drawer"
        description="Control the slide-in cart drawer that opens from the storefront cart icon."
      >
        <div className="theme-settings-grid three">
          <ToggleField label="Enable mini cart" name="miniCartEnabled" value={advanced.miniCart.enabled} />
          <ToggleField label="Auto open after add to cart" name="miniCartAutoOpenAfterAdd" value={advanced.miniCart.autoOpenAfterAdd} />
          <ToggleField label="Show item count" name="miniCartShowItemCount" value={advanced.miniCart.showItemCount} />
          <ToggleField label="Enable free shipping" name="miniCartFreeShippingEnabled" value={advanced.miniCart.freeShippingEnabled} />
          <ToggleField label="Show brand" name="miniCartShowBrand" value={advanced.miniCart.showBrand} />
          <ToggleField label="Show variant" name="miniCartShowVariant" value={advanced.miniCart.showVariant} />
          <ToggleField label="Show quantity" name="miniCartShowQuantity" value={advanced.miniCart.showQuantity} />
          <ToggleField label="Show remove" name="miniCartShowRemoveButton" value={advanced.miniCart.showRemoveButton} />
          <ToggleField label="Enable order notes" name="miniCartOrderNotesEnabled" value={advanced.miniCart.orderNotesEnabled} />
          <ToggleField label="Enable checkout button" name="miniCartCheckoutButtonEnabled" value={advanced.miniCart.checkoutButtonEnabled} />
          <ToggleField label="Enable view cart button" name="miniCartViewCartButtonEnabled" value={advanced.miniCart.viewCartButtonEnabled} />
          <label>
            Drawer width
            <input defaultValue={advanced.miniCart.drawerWidth} max={560} min={320} name="miniCartDrawerWidth" type="number" />
          </label>
          <label>
            Overlay opacity
            <input defaultValue={advanced.miniCart.overlayOpacity} max={90} min={0} name="miniCartOverlayOpacity" type="number" />
          </label>
          <label>
            Free shipping amount
            <input defaultValue={advanced.miniCart.freeShippingAmount} min={0} name="miniCartFreeShippingAmount" type="number" />
          </label>
          <label>
            Free shipping text
            <input defaultValue={advanced.miniCart.freeShippingText} name="miniCartFreeShippingText" type="text" />
          </label>
          <label>
            Free shipping CTA
            <input defaultValue={advanced.miniCart.freeShippingCtaText} name="miniCartFreeShippingCtaText" type="text" />
          </label>
          <label>
            Free shipping CTA link
            <input defaultValue={advanced.miniCart.freeShippingCtaLink} name="miniCartFreeShippingCtaLink" type="text" />
          </label>
          <label>
            Checkout button text
            <input defaultValue={advanced.miniCart.checkoutButtonText} name="miniCartCheckoutButtonText" type="text" />
          </label>
          <ColorPickerField
            label="Checkout background"
            name="miniCartCheckoutButtonBackgroundColor"
            value={advanced.miniCart.checkoutButtonBackgroundColor}
          />
          <ColorPickerField
            label="Checkout text"
            name="miniCartCheckoutButtonTextColor"
            value={advanced.miniCart.checkoutButtonTextColor}
          />
          <label>
            Checkout radius
            <input
              defaultValue={advanced.miniCart.checkoutButtonBorderRadius}
              max={32}
              min={0}
              name="miniCartCheckoutButtonBorderRadius"
              type="number"
            />
          </label>
          <label>
            View cart text
            <input defaultValue={advanced.miniCart.viewCartButtonText} name="miniCartViewCartButtonText" type="text" />
          </label>
          <label>
            View cart link
            <input defaultValue={advanced.miniCart.viewCartButtonLink} name="miniCartViewCartButtonLink" type="text" />
          </label>
        </div>
      </SettingsCard>

      <SettingsCard
        id="product-sections"
        title="Product Sections"
        description="Control the reusable storefront product listing layout used by featured products, shop pages, search results, and related products."
      >
        <div className="theme-product-section-editor">
          <ProductSectionFields label="Featured Products" name="featured" section={advanced.productSections.featured} />
          <ProductSectionFields label="Best Sellers" name="bestSellers" section={advanced.productSections.bestSellers} />
          <ProductSectionFields label="New Arrivals" name="newArrivals" section={advanced.productSections.newArrivals} />
          <ProductSectionFields label="Trending" name="trending" section={advanced.productSections.trending} />
          <ProductSectionFields label="Shop / Category Listing" name="listing" section={advanced.productSections.listing} />
          <ProductSectionFields label="Search Results" name="search" section={advanced.productSections.search} />
          <ProductSectionFields label="Related Products" name="related" section={advanced.productSections.related} />
          <ProductSectionFields label="Recently Viewed" name="recentlyViewed" section={advanced.productSections.recentlyViewed} />
        </div>
      </SettingsCard>

      <SettingsCard
        id="fashion-homepage"
        title="Fashion Homepage"
        description="Fashion-only controls for editorial sections, media overrides, newsletter copy, and footer menus."
      >
        <div className="theme-settings-grid three">
          <label>
            New arrivals title
            <input defaultValue={advanced.fashion.newArrivalsTitle} name="fashionNewArrivalsTitle" type="text" />
          </label>
          <label>
            New arrivals description
            <input defaultValue={advanced.fashion.newArrivalsDescription} name="fashionNewArrivalsDescription" type="text" />
          </label>
          <label>
            Collection card CTAs
            <textarea defaultValue={advanced.fashion.collectionCtas.join("\n")} name="fashionCollectionCtas" rows={4} />
          </label>
          <label>
            Split banner heading
            <input defaultValue={advanced.fashion.editorialSplitHeading} name="fashionEditorialSplitHeading" type="text" />
          </label>
          <label>
            Split banner CTA text
            <input defaultValue={advanced.fashion.editorialSplitCtaText} name="fashionEditorialSplitCtaText" type="text" />
          </label>
          <label>
            Split banner CTA link
            <input defaultValue={advanced.fashion.editorialSplitCtaLink} name="fashionEditorialSplitCtaLink" type="text" />
          </label>
          <label>
            Split overlay opacity
            <input defaultValue={advanced.fashion.editorialSplitOverlayOpacity} max={80} min={0} name="fashionEditorialSplitOverlayOpacity" type="number" />
          </label>
          <label>
            Split left image URL
            <input defaultValue={advanced.fashion.editorialSplitLeftImageUrl} name="fashionEditorialSplitLeftImageUrl" type="text" />
          </label>
          <label>
            Split right image URL
            <input defaultValue={advanced.fashion.editorialSplitRightImageUrl} name="fashionEditorialSplitRightImageUrl" type="text" />
          </label>
          <label>
            Split height
            <input defaultValue={advanced.fashion.editorialSplitHeight} max={1000} min={360} name="fashionEditorialSplitHeight" type="number" />
          </label>
          <label>
            Campaign title
            <input defaultValue={advanced.fashion.editorialBannerTitle} name="fashionEditorialBannerTitle" type="text" />
          </label>
          <label>
            Campaign subtitle
            <input defaultValue={advanced.fashion.editorialBannerSubtitle} name="fashionEditorialBannerSubtitle" type="text" />
          </label>
          <label>
            Campaign image URL
            <input defaultValue={advanced.fashion.editorialBannerImageUrl} name="fashionEditorialBannerImageUrl" type="text" />
          </label>
          <label>
            Campaign CTA text
            <input defaultValue={advanced.fashion.editorialBannerCtaText} name="fashionEditorialBannerCtaText" type="text" />
          </label>
          <label>
            Campaign CTA link
            <input defaultValue={advanced.fashion.editorialBannerCtaLink} name="fashionEditorialBannerCtaLink" type="text" />
          </label>
          <label>
            Featured look title
            <input defaultValue={advanced.fashion.featuredLookTitle} name="fashionFeaturedLookTitle" type="text" />
          </label>
          <label>
            Featured look description
            <input defaultValue={advanced.fashion.featuredLookDescription} name="fashionFeaturedLookDescription" type="text" />
          </label>
          <label>
            Featured look image URL
            <input defaultValue={advanced.fashion.featuredLookImageUrl} name="fashionFeaturedLookImageUrl" type="text" />
          </label>
          <label>
            Featured look CTA text
            <input defaultValue={advanced.fashion.featuredLookCtaText} name="fashionFeaturedLookCtaText" type="text" />
          </label>
          <label>
            Featured look CTA link
            <input defaultValue={advanced.fashion.featuredLookCtaLink} name="fashionFeaturedLookCtaLink" type="text" />
          </label>
          <label>
            Community title
            <input defaultValue={advanced.fashion.communityTitle} name="fashionCommunityTitle" type="text" />
          </label>
          <label>
            Community description
            <input defaultValue={advanced.fashion.communityDescription} name="fashionCommunityDescription" type="text" />
          </label>
          <label>
            Community image URLs
            <textarea defaultValue={advanced.fashion.communityImages.join("\n")} name="fashionCommunityImages" rows={4} />
          </label>
          <label>
            Newsletter title
            <input defaultValue={advanced.fashion.newsletterTitle} name="fashionNewsletterTitle" type="text" />
          </label>
          <label>
            Newsletter description
            <input defaultValue={advanced.fashion.newsletterDescription} name="fashionNewsletterDescription" type="text" />
          </label>
          <label>
            Newsletter image URL
            <input defaultValue={advanced.fashion.newsletterImageUrl} name="fashionNewsletterImageUrl" type="text" />
          </label>
          <label>
            Newsletter button text
            <input defaultValue={advanced.fashion.newsletterButtonText} name="fashionNewsletterButtonText" type="text" />
          </label>
          <label>
            Before image URL
            <input defaultValue={advanced.fashion.beforeAfterBeforeImageUrl} name="fashionBeforeAfterBeforeImageUrl" type="text" />
          </label>
          <label>
            Before label
            <input defaultValue={advanced.fashion.beforeAfterBeforeLabel} name="fashionBeforeAfterBeforeLabel" type="text" />
          </label>
          <label>
            After image URL
            <input defaultValue={advanced.fashion.beforeAfterAfterImageUrl} name="fashionBeforeAfterAfterImageUrl" type="text" />
          </label>
          <label>
            After label
            <input defaultValue={advanced.fashion.beforeAfterAfterLabel} name="fashionBeforeAfterAfterLabel" type="text" />
          </label>
          <label>
            Comparison position
            <input defaultValue={advanced.fashion.beforeAfterInitialPosition} max={90} min={10} name="fashionBeforeAfterInitialPosition" type="number" />
          </label>
          <label>
            Footer description
            <textarea defaultValue={advanced.fashion.footerDescription} name="fashionFooterDescription" rows={4} />
          </label>
          <label>
            Footer newsletter title
            <input defaultValue={advanced.fashion.footerNewsletterTitle} name="fashionFooterNewsletterTitle" type="text" />
          </label>
          <label>
            Footer newsletter description
            <input defaultValue={advanced.fashion.footerNewsletterDescription} name="fashionFooterNewsletterDescription" type="text" />
          </label>
        </div>
        <div className="theme-settings-grid two">
          <RepeaterTextarea
            helper="One link per line. Format: Label | /path."
            label="Footer about links"
            name="fashionFooterAboutLinks"
            value={advanced.fashion.footerAboutLinks.map((link) => `${link.label} | ${link.url}`).join("\n")}
          />
          <RepeaterTextarea
            helper="One link per line. Format: Label | /path."
            label="Footer shop links"
            name="fashionFooterShopLinks"
            value={advanced.fashion.footerShopLinks.map((link) => `${link.label} | ${link.url}`).join("\n")}
          />
          <RepeaterTextarea
            helper="One link per line. Format: Label | /path."
            label="Footer legal links"
            name="fashionFooterLegalLinks"
            value={advanced.fashion.footerLegalLinks.map((link) => `${link.label} | ${link.url}`).join("\n")}
          />
          <RepeaterTextarea
            helper="One publication name per line."
            label="Press logos"
            name="fashionFooterPressLogos"
            value={advanced.fashion.footerPressLogos.join("\n")}
          />
        </div>
      </SettingsCard>

      <SettingsCard
        id="electronics-homepage"
        title="Electronics Homepage"
        description="Electronics-only controls for promo cards, recommendation copy, footer menus, and support text."
      >
        <div className="theme-settings-grid three">
          <label>
            Category section title
            <input defaultValue={advanced.electronics.categorySectionTitle} name="electronicsCategorySectionTitle" type="text" />
          </label>
          <label>
            Brand section title
            <input defaultValue={advanced.electronics.brandSectionTitle} name="electronicsBrandSectionTitle" type="text" />
          </label>
          <label>
            Featured section title
            <input defaultValue={advanced.electronics.featuredSectionTitle} name="electronicsFeaturedSectionTitle" type="text" />
          </label>
          <label>
            Flash deal eyebrow
            <input defaultValue={advanced.electronics.flashDealEyebrow} name="electronicsFlashDealEyebrow" type="text" />
          </label>
          <label>
            Flash deal title
            <input defaultValue={advanced.electronics.flashDealTitle} name="electronicsFlashDealTitle" type="text" />
          </label>
          <label>
            New arrivals title
            <input defaultValue={advanced.electronics.newArrivalsTitle} name="electronicsNewArrivalsTitle" type="text" />
          </label>
          <label>
            Urgent sale title
            <input defaultValue={advanced.electronics.promoSectionTitle} name="electronicsPromoSectionTitle" type="text" />
          </label>
          <label>
            Recommended title
            <input defaultValue={advanced.electronics.recommendedTitle} name="electronicsRecommendedTitle" type="text" />
          </label>
          <label>
            Support text
            <input defaultValue={advanced.electronics.supportText} name="electronicsSupportText" type="text" />
          </label>
          <label>
            Newsletter title
            <input defaultValue={advanced.electronics.newsletterTitle} name="electronicsNewsletterTitle" type="text" />
          </label>
          <label>
            Newsletter description
            <input defaultValue={advanced.electronics.newsletterDescription} name="electronicsNewsletterDescription" type="text" />
          </label>
        </div>
        <RepeaterTextarea
          helper="One card per line. Format: title | badge | description | image URL | CTA text | CTA link | background color."
          label="Hero promo cards"
          name="electronicsHeroPromoCards"
          value={advanced.electronics.heroPromoCards.map((card) => `${card.title} | ${card.badge} | ${card.description} | ${card.imageUrl} | ${card.ctaText} | ${card.ctaLink} | ${card.backgroundColor}`).join("\n")}
        />
        <RepeaterTextarea
          helper="One card per line. Format: title | badge | description | image URL | CTA text | CTA link | background color."
          label="Urgent sale promo cards"
          name="electronicsPromoCards"
          value={advanced.electronics.promoCards.map((card) => `${card.title} | ${card.badge} | ${card.description} | ${card.imageUrl} | ${card.ctaText} | ${card.ctaLink} | ${card.backgroundColor}`).join("\n")}
        />
        <RepeaterTextarea
          helper="One item per line. Format: title | description."
          label="Trust items"
          name="electronicsTrustItems"
          value={advanced.electronics.trustItems.map((item) => `${item.title} | ${item.description}`).join("\n")}
        />
        <div className="theme-settings-grid two">
          <RepeaterTextarea
            helper="One link per line. Format: Label | /path."
            label="Footer collection links"
            name="electronicsFooterCollectionLinks"
            value={advanced.electronics.footerCollectionLinks.map((link) => `${link.label} | ${link.url}`).join("\n")}
          />
          <RepeaterTextarea
            helper="One link per line. Format: Label | /path."
            label="Footer information links"
            name="electronicsFooterInformationLinks"
            value={advanced.electronics.footerInformationLinks.map((link) => `${link.label} | ${link.url}`).join("\n")}
          />
        </div>
      </SettingsCard>

      <SettingsCard
        id="product-page"
        title="Product Page"
        description="Control the single product page gallery, purchase area, accordions, shipping copy, and promotional blocks."
      >
        <div className="theme-settings-grid four compact">
          <ToggleField label="Show breadcrumb" name="productPageBreadcrumbEnabled" value={advanced.productPage.breadcrumbEnabled} />
          <ToggleField label="Enable zoom" name="productPageZoomEnabled" value={advanced.productPage.zoomEnabled} />
          <ToggleField label="Enable lightbox" name="productPageLightboxEnabled" value={advanced.productPage.lightboxEnabled} />
          <ToggleField label="Show variants" name="productPageVariantEnabled" value={advanced.productPage.variantEnabled} />
          <ToggleField label="Show buy now" name="productPageBuyNowEnabled" value={advanced.productPage.buyNowEnabled} />
          <ToggleField label="Show shipping info" name="productPageShippingEnabled" value={advanced.productPage.shippingEnabled} />
          <ToggleField label="Show accordions" name="productPageAccordionEnabled" value={advanced.productPage.accordionEnabled} />
          <ToggleField label="Show promo blocks" name="productPagePromoBlocksEnabled" value={advanced.productPage.promoBlocksEnabled} />
        </div>
        <div className="theme-settings-grid three compact">
          <label>
            Gallery layout
            <select defaultValue={advanced.productPage.galleryLayout} name="productPageGalleryLayout">
              <option value="two-column">Two-column</option>
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          <label>
            Image ratio
            <select defaultValue={advanced.productPage.imageRatio} name="productPageImageRatio">
              <option value="portrait">Portrait</option>
              <option value="square">Square</option>
              <option value="wide">Wide</option>
            </select>
          </label>
          <label>
            Gallery spacing
            <input defaultValue={advanced.productPage.gallerySpacing} max={32} min={0} name="productPageGallerySpacing" type="number" />
          </label>
          <label>
            Variant style
            <select defaultValue={advanced.productPage.variantStyle} name="productPageVariantStyle">
              <option value="buttons">Buttons</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </label>
          <label>
            Add to cart text
            <input defaultValue={advanced.productPage.addToCartText} name="productPageAddToCartText" type="text" />
          </label>
          <label>
            Button radius
            <input
              defaultValue={advanced.productPage.addToCartButtonRadius}
              max={32}
              min={0}
              name="productPageAddToCartButtonRadius"
              type="number"
            />
          </label>
          <ColorPickerField
            label="Button color"
            name="productPageAddToCartButtonColor"
            value={advanced.productPage.addToCartButtonColor}
          />
          <label>
            Shipping notice
            <input defaultValue={advanced.productPage.shippingNotice} name="productPageShippingNotice" type="text" />
          </label>
        </div>
      </SettingsCard>

      <div className="theme-sticky-save">
        <div>
          <strong>Theme settings</strong>
          <span>Changes apply to the public storefront after saving.</span>
        </div>
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save theme settings"}
        </Button>
      </div>
    </form>
  );
}

function HeroSlideFields({
  assets,
  index,
  slide
}: {
  assets: MediaPickerAsset[];
  index: number;
  slide: StorefrontHeroSlide;
}) {
  return (
    <div className="theme-slide-card">
      <UploadField
        assets={assets}
        fileName={`heroSlideImageFile${index}`}
        label={`Slide ${index + 1} Image`}
        name={`heroSlideImageUrl${index}`}
        value={slide.mediaType === "image" ? slide.url : ""}
      />
      <div className="theme-settings-grid two compact">
        <label>
          Media type
          <select defaultValue={slide.mediaType} name={`heroSlideMediaType${index}`}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="youtube">YouTube</option>
          </select>
        </label>
        <label>
          Slide title
          <input defaultValue={slide.title ?? ""} name={`heroSlideTitle${index}`} type="text" />
        </label>
        <label>
          Slide subtitle
          <input defaultValue={slide.subtitle ?? ""} name={`heroSlideSubtitle${index}`} type="text" />
        </label>
        <label>
          Video URL
          <input defaultValue={slide.mediaType === "video" ? slide.url : ""} name={`heroSlideVideoUrl${index}`} type="url" />
        </label>
        <label>
          YouTube URL
          <input defaultValue={slide.mediaType === "youtube" ? slide.url : ""} name={`heroSlideYoutubeUrl${index}`} type="url" />
        </label>
      </div>
    </div>
  );
}

function RepeaterTextarea({
  helper,
  label,
  name,
  value
}: {
  helper: string;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="theme-repeater-field">
      {label}
      <textarea defaultValue={value} name={name} rows={5} />
      <span>{helper}</span>
    </label>
  );
}

function ProductSectionFields({
  label,
  name,
  section
}: {
  label: string;
  name: keyof StorefrontAdvancedSettings["productSections"];
  section: StorefrontProductSectionSettings;
}) {
  return (
    <details className="theme-product-section-panel" open={name === "featured"}>
      <summary>{label}</summary>
      <div className="theme-settings-grid three compact">
        <label>
          Section title
          <input defaultValue={section.title} name={`productSection_${name}_title`} type="text" />
        </label>
        <label>
          Subtitle
          <input defaultValue={section.subtitle} name={`productSection_${name}_subtitle`} type="text" />
        </label>
        <label>
          CTA text
          <input defaultValue={section.ctaText} name={`productSection_${name}_ctaText`} type="text" />
        </label>
        <label>
          CTA link
          <input defaultValue={section.ctaLink} name={`productSection_${name}_ctaLink`} type="text" />
        </label>
        <label>
          Products shown
          <input defaultValue={section.count} max={24} min={1} name={`productSection_${name}_count`} type="number" />
        </label>
        <label>
          Columns
          <select defaultValue={section.columns} name={`productSection_${name}_columns`}>
            <option value={2}>2 columns</option>
            <option value={3}>3 columns</option>
            <option value={4}>4 columns</option>
            <option value={5}>5 columns</option>
          </select>
        </label>
        <label>
          Display mode
          <select defaultValue={section.mode} name={`productSection_${name}_mode`}>
            <option value="grid">Grid</option>
            <option value="slider">Slider-ready</option>
          </select>
        </label>
        <label>
          Product source
          <select defaultValue={section.source} name={`productSection_${name}_source`}>
            <option value="featured">Featured</option>
            <option value="best-sellers">Best sellers</option>
            <option value="new-arrivals">New arrivals</option>
            <option value="trending">Trending</option>
            <option value="related">Related</option>
            <option value="search">Search</option>
            <option value="recently-viewed">Recently viewed</option>
            <option value="manual">Manual</option>
          </select>
        </label>
      </div>
      <div className="theme-settings-grid four compact">
        <ToggleField label="Show badges" name={`productSection_${name}_enableBadges`} value={section.enableBadges} />
        <ToggleField label="Show compare price" name={`productSection_${name}_enableComparePrice`} value={section.enableComparePrice} />
        <ToggleField label="Show variant count" name={`productSection_${name}_enableVariants`} value={section.enableVariants} />
        <ToggleField label="Enable hover image" name={`productSection_${name}_enableHoverImage`} value={section.enableHoverImage} />
      </div>
    </details>
  );
}

function normalizeSlides(slides: StorefrontHeroSlide[]) {
  const normalized = [...slides].slice(0, 4);

  while (normalized.length < 4) {
    normalized.push({
      mediaType: "image",
      url: ""
    });
  }

  return normalized;
}
