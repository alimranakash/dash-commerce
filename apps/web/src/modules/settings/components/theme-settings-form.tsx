"use client";

import { Button } from "@dash/ui";
import { useActionState, useState, type ReactNode } from "react";
import { MediaUrlPicker } from "../../media/components/media-url-picker";
import type { MediaPickerAsset } from "../../media/media.types";
import {
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings
} from "../../storefront/customization";
import type { SettingsActionState } from "../settings.actions";

export type ThemeSettingsFormValue = {
  themeName: string;
  primaryColor: string;
  secondaryColor?: string | null;
  heroTitle: string;
  heroSubtitle?: string | null;
  heroImageUrl?: string | null;
  announcementText?: string | null;
  featuredSectionTitle: string;
  advancedSettings?: StorefrontAdvancedSettings | null;
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
  const [heroImageUrl, setHeroImageUrl] = useState(settings.heroImageUrl ?? "");
  const advanced = normalizeAdvancedSettings(settings.advancedSettings);

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-section-heading">
        <h2>Theme</h2>
        <p>Theme v1 keeps storefront customization polished and hard to break.</p>
      </div>
      <div className="form-grid">
        <label>
          Theme name
          <input name="themeName" readOnly value={settings.themeName} />
        </label>
        <FieldError errors={state.fieldErrors} name="primaryColor">
          <label>
            Primary color
            <span className="color-input-row">
              <input
                defaultValue={settings.primaryColor}
                name="primaryColor"
                type="color"
              />
              <input
                defaultValue={settings.primaryColor}
                aria-label="Primary color hex"
                pattern="^#[0-9a-fA-F]{6}$"
                readOnly
                type="text"
              />
            </span>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="secondaryColor">
          <label>
            Secondary color
            <input
              defaultValue={settings.secondaryColor ?? ""}
              name="secondaryColor"
              placeholder="#c89356"
              type="text"
            />
          </label>
        </FieldError>
      </div>
      <div className="form-section-heading">
        <h2>Homepage</h2>
        <p>These fields power the public storefront hero and featured products section.</p>
      </div>
      <FieldError errors={state.fieldErrors} name="announcementText">
        <label>
          Announcement text
          <input
            defaultValue={settings.announcementText ?? ""}
            name="announcementText"
            type="text"
          />
        </label>
      </FieldError>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="heroTitle">
          <label>
            Hero title
            <input defaultValue={settings.heroTitle} name="heroTitle" required type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="featuredSectionTitle">
          <label>
            Featured section title
            <input
              defaultValue={settings.featuredSectionTitle}
              name="featuredSectionTitle"
              required
              type="text"
            />
          </label>
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="heroSubtitle">
        <label>
          Hero subtitle
          <textarea defaultValue={settings.heroSubtitle ?? ""} name="heroSubtitle" rows={4} />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="heroImageUrl">
        <label>
          Hero image URL
          <input
            name="heroImageUrl"
            onChange={(event) => setHeroImageUrl(event.target.value)}
            type="url"
            value={heroImageUrl}
          />
        </label>
        <MediaUrlPicker assets={mediaAssets} onSelect={setHeroImageUrl} />
      </FieldError>
      <div className="form-section-heading">
        <h2>Announcement Bar</h2>
        <p>Control the full-width scrolling message bar above the storefront header.</p>
      </div>
      <div className="form-grid">
        <ToggleLabel label="Enable announcement bar" name="announcementEnabled" value={advanced.announcement.enabled} />
        <label>
          Scroll speed
          <select defaultValue={advanced.announcement.scrollSpeed} name="announcementScrollSpeed">
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label>
          Background color
          <input defaultValue={advanced.announcement.backgroundColor} name="announcementBackgroundColor" type="color" />
        </label>
        <label>
          Text color
          <input defaultValue={advanced.announcement.textColor} name="announcementTextColor" type="color" />
        </label>
        <label>
          Font size
          <input defaultValue={advanced.announcement.fontSize} min={10} max={20} name="announcementFontSize" type="number" />
        </label>
      </div>
      <label>
        Messages
        <textarea
          defaultValue={advanced.announcement.messages.map((message) => `${message.text}${message.link ? ` | ${message.link}` : ""}`).join("\n")}
          name="announcementMessages"
          rows={4}
        />
        <span className="field-help">One message per line. Optional format: Message | /link</span>
      </label>
      <div className="form-section-heading">
        <h2>Header</h2>
        <p>Control logo text, navigation, icons, colors, spacing, and sticky behavior.</p>
      </div>
      <div className="form-grid">
        <ToggleLabel label="Enable header" name="headerEnabled" value={advanced.header.enabled} />
        <ToggleLabel label="Sticky header" name="headerSticky" value={advanced.header.sticky} />
        <ToggleLabel label="Show search" name="headerShowSearch" value={advanced.header.showSearch} />
        <ToggleLabel label="Show account" name="headerShowAccount" value={advanced.header.showAccount} />
        <ToggleLabel label="Show cart" name="headerShowCart" value={advanced.header.showCart} />
        <ToggleLabel label="Show currency/language" name="headerShowCurrency" value={advanced.header.showCurrency} />
        <label>
          Logo text override
          <input defaultValue={advanced.header.logoText ?? ""} name="headerLogoText" placeholder={settings.themeName} type="text" />
        </label>
        <label>
          Header height
          <input defaultValue={advanced.header.height} min={56} max={140} name="headerHeight" type="number" />
        </label>
        <label>
          Menu spacing
          <input defaultValue={advanced.header.spacing} min={16} max={96} name="headerSpacing" type="number" />
        </label>
        <label>
          Background color
          <input defaultValue={advanced.header.backgroundColor} name="headerBackgroundColor" type="color" />
        </label>
        <label>
          Text color
          <input defaultValue={advanced.header.textColor} name="headerTextColor" type="color" />
        </label>
      </div>
      <label>
        Menu items
        <textarea
          defaultValue={advanced.header.menuItems.map((item) => `${item.label} | ${item.url}`).join("\n")}
          name="headerMenuItems"
          rows={5}
        />
        <span className="field-help">One item per line. Format: Label | /path</span>
      </label>
      <div className="form-section-heading">
        <h2>Advanced Hero</h2>
        <p>Prepare image, video, YouTube, and slider hero content without changing templates later.</p>
      </div>
      <div className="form-grid">
        <ToggleLabel label="Enable hero" name="heroEnabled" value={advanced.hero.enabled} />
        <ToggleLabel label="Autoplay slider" name="heroAutoplay" value={advanced.hero.autoplay} />
        <ToggleLabel label="Show arrows" name="heroShowArrows" value={advanced.hero.showArrows} />
        <ToggleLabel label="Show dots" name="heroShowDots" value={advanced.hero.showDots} />
        <label>
          Layout width
          <select defaultValue={advanced.hero.layoutWidth} name="heroLayoutWidth">
            <option value="full">Full width</option>
            <option value="boxed">Boxed width</option>
            <option value="custom">Custom width</option>
          </select>
        </label>
        <label>
          Content type
          <select defaultValue={advanced.hero.contentType} name="heroContentType">
            <option value="single-image">Single image</option>
            <option value="image-slider">Image slider</option>
            <option value="single-video">Single video</option>
            <option value="video-slider">Video slider</option>
            <option value="mixed-slider">Mixed image/video slider</option>
            <option value="youtube">YouTube video</option>
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
          Custom height
          <input defaultValue={advanced.hero.customHeight ?? ""} min={320} max={1000} name="heroCustomHeight" type="number" />
        </label>
        <label>
          Custom width
          <input defaultValue={advanced.hero.customWidth ?? ""} min={720} max={1920} name="heroCustomWidth" type="number" />
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
          Hero text color
          <input defaultValue={advanced.hero.textColor} name="heroTextColor" type="color" />
        </label>
        <label>
          Overlay color
          <input defaultValue={advanced.hero.overlayColor} name="heroOverlayColor" type="color" />
        </label>
        <label>
          Overlay opacity
          <input defaultValue={advanced.hero.overlayOpacity} min={0} max={90} name="heroOverlayOpacity" type="number" />
        </label>
        <label>
          Slider speed
          <input defaultValue={advanced.hero.sliderSpeed} min={2000} max={12000} name="heroSliderSpeed" type="number" />
        </label>
        <label>
          Button style
          <select defaultValue={advanced.hero.buttonStyle} name="heroButtonStyle">
            <option value="light">Light</option>
            <option value="filled">Filled</option>
            <option value="outline">Outline</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
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
        <label>
          Video URL
          <input defaultValue={advanced.hero.videoUrl ?? ""} name="heroVideoUrl" type="url" />
        </label>
        <label>
          YouTube URL
          <input defaultValue={advanced.hero.youtubeUrl ?? ""} name="heroYoutubeUrl" type="url" />
        </label>
      </div>
      <label>
        Slider items
        <textarea
          defaultValue={advanced.hero.slides.map((slide) => `${slide.mediaType} | ${slide.url} | ${slide.title ?? ""} | ${slide.subtitle ?? ""}`).join("\n")}
          name="heroSlides"
          rows={5}
        />
        <span className="field-help">One slide per line. Format: image/video/youtube | URL | title | subtitle</span>
      </label>
      <div className="form-section-heading">
        <h2>Global Storefront Layout</h2>
        <p>Reusable layout controls for all future website templates.</p>
      </div>
      <div className="form-grid">
        <label>
          Storefront width mode
          <select defaultValue={advanced.layout.widthMode} name="layoutWidthMode">
            <option value="full">Full width</option>
            <option value="boxed">Boxed</option>
          </select>
        </label>
        <label>
          Boxed max width
          <input defaultValue={advanced.layout.boxedMaxWidth} min={960} max={1920} name="layoutBoxedMaxWidth" type="number" />
        </label>
        <label>
          Section padding
          <input defaultValue={advanced.layout.sectionPadding} min={24} max={120} name="layoutSectionPadding" type="number" />
        </label>
        <label>
          Page background
          <input defaultValue={advanced.layout.pageBackgroundColor} name="layoutPageBackgroundColor" type="color" />
        </label>
      </div>
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save theme"}
        </Button>
      </div>
    </form>
  );
}

function ToggleLabel({ label, name, value }: { label: string; name: string; value: boolean }) {
  return (
    <label className="toggle-field">
      {label}
      <input defaultChecked={value} name={name} type="checkbox" />
    </label>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors?: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div className="field-shell">
      {children}
      {errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );
}
