import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings
} from "../../customization";

const SECTION_ID = "beauty-moments";
// Five is what the strip is designed around: a sixth portrait would shrink every
// column past the width where a face still reads, so extra configured images are
// dropped rather than wrapped onto a second row.
const MAX_IMAGES = 5;

export type BeautyMomentsSectionProps = {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
};

export function BeautyMomentsSection({ advancedSettings }: BeautyMomentsSectionProps) {
  const beauty = advancedSettings?.beauty ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.beauty;
  const images = beauty.momentsImageUrls
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, MAX_IMAGES);

  // The band is nothing but photographs under a heading, so without images there
  // is no section left to render.
  if (images.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={`${SECTION_ID}-title`}
      className="beauty-home-section beauty-moments"
      id={SECTION_ID}
    >
      <div className="beauty-moments-header">
        <h2 className="beauty-moments-title" id={`${SECTION_ID}-title`}>
          {beauty.momentsTitle}
          {beauty.momentsTitleAccent ? (
            <>
              {" "}
              <em className="beauty-moments-title-accent">{beauty.momentsTitleAccent}</em>
            </>
          ) : null}
        </h2>
        {beauty.momentsDescription ? (
          <p className="beauty-moments-description">{beauty.momentsDescription}</p>
        ) : null}
      </div>
      <div className="beauty-moments-track">
        {images.map((image, index) => (
          <div className="beauty-moments-item" key={`${image}-${index}`}>
            {/* Mood photography with no caption and nothing to click: the heading
                above already carries the meaning, so each frame stays out of the
                a11y tree instead of announcing five unlabelled images. */}
            <img
              alt=""
              className="beauty-moments-image"
              decoding="async"
              loading="lazy"
              src={image}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
