"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import type { MediaPickerAsset } from "../../media/media.types";
import {
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings,
  type StorefrontHeroSlide
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
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <input name="themeName" type="hidden" value="Theme v1" />
      <input name="announcementText" type="hidden" value={announcementText} />

      <SettingsCard
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
