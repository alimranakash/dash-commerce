import type { DemoPackProduct, DemoPackProductImage } from "../types";

/**
 * Every product ships two frames - `<slug>-1` is the packshot the card and
 * gallery lead with, `<slug>-2` is the texture, swatch or in-use frame the card
 * swaps to on hover. Both files must exist under
 * apps/web/public/demo-assets/beauty/products/.
 */
function gallery(slug: string, title: string): DemoPackProductImage[] {
  return [
    { alt: `${title} - packshot`, url: `/demo-assets/beauty/products/${slug}-1.webp` },
    { alt: `${title} - texture and finish`, url: `/demo-assets/beauty/products/${slug}-2.webp` }
  ];
}

function product(
  input: Omit<DemoPackProduct, "imageAlt" | "imageUrl" | "images">
): DemoPackProduct {
  const images = gallery(input.slug, input.title);
  const primary = images[0]!;

  return {
    ...input,
    imageAlt: primary.alt,
    imageUrl: primary.url,
    images
  };
}

export const beautyDemoProducts = [
  // -------------------------------------------------------------------- skincare
  product({
    brandSlug: "cocoon",
    categorySlug: "skincare",
    compareAtPrice: "2290.00",
    description:
      "A clear SPF 50 spray that goes on without the white cast that stops most sunscreens from being worn daily here. It sits under makeup rather than pilling against it, which is the whole reason a spray format exists, and the 500ml bottle lasts a full season of reapplying at the two-hourly interval the label asks for. Reapplication is the part that matters and the part everyone skips - keep it somewhere it gets seen.",
    price: "1890.00",
    shortDescription: "Clear SPF 50 spray sunscreen, 500ml, no white cast and safe under makeup.",
    sku: "BEA-SKI-001",
    slug: "clear-spf50-sunscreen",
    stockQuantity: 64,
    tagSlugs: ["best-seller", "everyday-ritual", "on-sale"],
    title: "Clear SPF 50 Spray Sunscreen"
  }),
  product({
    brandSlug: "cocoon",
    categorySlug: "skincare",
    compareAtPrice: "2690.00",
    description:
      "A detoxifying clay masque for the weeks when humidity turns the T-zone into a losing battle. It goes on grey-green and sets to a matte finish in about ten minutes, which is short enough that it does not crack and pull at the corners of the mouth the way a longer-setting clay does. Once a week is enough - clay does not become more effective at three times a week, it just leaves the skin tight.",
    price: "2190.00",
    shortDescription: "Detoxifying clay masque that sets in ten minutes without cracking.",
    sku: "BEA-SKI-002",
    slug: "glacial-coast-detox-masque",
    stockQuantity: 38,
    tagSlugs: ["clean-beauty", "cruelty-free", "on-sale"],
    title: "Glacial Coast Detox Masque"
  }),
  product({
    brandSlug: "lumen-skin",
    categorySlug: "skincare",
    compareAtPrice: "1990.00",
    description:
      "A light face lotion for people who want moisture without a layer they can feel for the next hour. It absorbs in under a minute and leaves a matte-satin finish rather than a shine, so it works as a morning base in a climate where a heavier cream slides off by mid-morning. Unscented, which is not a marketing angle so much as one fewer thing on the ingredient list to react to.",
    price: "1690.00",
    shortDescription: "Unscented lightweight face lotion that absorbs to a matte-satin finish.",
    sku: "BEA-SKI-003",
    slug: "hydrating-face-lotion",
    stockQuantity: 72,
    tagSlugs: ["fragrance-free", "hydrating", "on-sale"],
    title: "Hydrating Face Lotion"
  }),
  product({
    brandSlug: "lumen-skin",
    categorySlug: "skincare",
    compareAtPrice: "4190.00",
    description:
      "The most concentrated serum in this catalogue, in a 30ml amber-black bottle that keeps light off the formula - the reason a serum comes in dark glass rather than clear. Three or four drops covers the whole face, so the bottle runs about two months at nightly use rather than the three weeks a heavier hand suggests. Build up to every night over a fortnight instead of starting there.",
    price: "3490.00",
    shortDescription:
      "Concentrated night serum in a 30ml light-blocking bottle, three drops per use.",
    sku: "BEA-SKI-004",
    slug: "advanced-anti-aging-serum",
    stockQuantity: 26,
    tagSlugs: ["best-seller", "hydrating", "on-sale"],
    title: "Advanced Anti-Ageing Serum"
  }),
  product({
    brandSlug: "lumen-skin",
    categorySlug: "skincare",
    description:
      "A 25ml vitamin E serum with a ceramide complex, formulated without added fragrance because fragrance is the single most common reason a serum stops agreeing with someone. The texture is closer to a light oil than a gel, so it goes on last at night and seals whatever is underneath it. New to the catalogue and stocked in small runs while the shade of the glass settles.",
    price: "2490.00",
    shortDescription: "25ml fragrance-free vitamin E and ceramide serum with a light oil texture.",
    sku: "BEA-SKI-005",
    slug: "vitamin-e-ceramide-serum",
    stockQuantity: 31,
    tagSlugs: ["sensitive-skin", "fragrance-free", "new-arrival"],
    title: "Vitamin E Ceramide Serum"
  }),
  product({
    brandSlug: "lumen-skin",
    categorySlug: "skincare",
    compareAtPrice: "3390.00",
    description:
      "A rich botanical face cream in a screw-top tin, which is the format that makes sense for a balm-weight product and the one that annoys anyone who wants to use it with wet hands. It is the night counterpart to the face lotion - too heavy for a Dhaka morning, close to ideal under an air conditioner overnight. A pea-sized amount is genuinely the dose; more sits on the surface.",
    price: "2890.00",
    shortDescription: "Rich botanical night cream in a screw-top tin, a pea-sized amount per use.",
    sku: "BEA-SKI-006",
    slug: "botanicare-face-cream",
    stockQuantity: 44,
    tagSlugs: ["hydrating", "sensitive-skin", "on-sale"],
    title: "Botanicare Face Cream"
  }),

  // ---------------------------------------------------------------------- makeup
  product({
    brandSlug: "rosewood",
    categorySlug: "makeup",
    compareAtPrice: "1590.00",
    description:
      "A true blue-red in a satin finish, which is the shade that reads as red in daylight instead of turning orange the way a warm red does on most skin tones. The bullet is firm enough to draw the lip line without a pencil, and the finish sits between matte and cream - enough slip to be comfortable through a meal, enough pigment to survive one. Blot once after the first pass and it holds through a long evening.",
    price: "1290.00",
    shortDescription: "Satin-finish blue-red lipstick with enough pigment for one coat.",
    sku: "BEA-MAK-001",
    slug: "luxury-red-lipstick",
    stockQuantity: 58,
    tagSlugs: ["best-seller", "gift-idea", "on-sale"],
    title: "Luxury Red Lipstick"
  }),
  product({
    brandSlug: "rosewood",
    categorySlug: "makeup",
    description:
      "A high-shine gloss in a warm pink that works over bare lips or on top of the lipstick above, which is the more common way it gets used. The doe-foot applicator is cut flat rather than pointed, so it covers the whole lip in two passes. Non-sticky is a claim every gloss makes; this one earns it by being thinner than most, at the cost of needing a touch-up after a drink.",
    price: "990.00",
    shortDescription: "High-shine warm pink lip gloss with a flat doe-foot applicator.",
    sku: "BEA-MAK-002",
    slug: "shiny-lip-gloss",
    stockQuantity: 83,
    tagSlugs: ["new-arrival", "gift-idea", "vegan"],
    title: "Shiny Lip Gloss"
  }),
  product({
    brandSlug: "bare-bloom",
    categorySlug: "makeup",
    compareAtPrice: "990.00",
    description:
      "A retractable lip pencil in a neutral rosy-brown, the shade that gets used up first in any set because it goes with everything from a bare lip to the red above. Retractable means no sharpener and no wasted product, but it also means the tip cannot be re-shaped - draw with the flat side for a soft line and the edge for a defined one. The formula sets in about thirty seconds and stops a gloss from travelling.",
    price: "790.00",
    shortDescription: "Retractable rosy-brown lip pencil that sets in thirty seconds.",
    sku: "BEA-MAK-003",
    slug: "lip-pencil",
    stockQuantity: 97,
    tagSlugs: ["everyday-ritual", "on-sale", "vegan"],
    title: "Lip Pencil"
  }),
  product({
    brandSlug: "bare-bloom",
    categorySlug: "makeup",
    compareAtPrice: "1690.00",
    description:
      "A radiant-finish concealer for under-eyes rather than for spots - it evens tone without fully blocking it out, which is what keeps the area from looking flat and powdery by afternoon. The doe-foot holds enough for both eyes in one dip, and the formula stays workable for about twenty seconds, so it can be tapped out with a fingertip before it sets. Set with the compact powder below if the under-eye creases.",
    price: "1390.00",
    shortDescription: "Radiant-finish under-eye concealer with a twenty-second blending window.",
    sku: "BEA-MAK-004",
    slug: "radiant-touch-concealer",
    stockQuantity: 76,
    tagSlugs: ["best-seller", "everyday-ritual", "on-sale"],
    title: "Radiant Touch Concealer"
  }),
  product({
    brandSlug: "vellora",
    categorySlug: "makeup",
    compareAtPrice: "1890.00",
    description:
      "A finely milled pressed powder in a mirrored compact, meant for setting and for the mid-afternoon pass rather than for building coverage. The pan is pressed firmly enough that it does not shatter in a bag, which is where most compacts die, and the mirror runs the full width of the lid rather than the half-lid a cheaper case gives you. Comes with a puff; a brush gives a lighter result.",
    price: "1590.00",
    shortDescription: "Finely milled pressed setting powder in a full-width mirrored compact.",
    sku: "BEA-MAK-005",
    slug: "compact-powder",
    stockQuantity: 61,
    tagSlugs: ["best-seller", "everyday-ritual", "on-sale"],
    title: "Compact Powder"
  }),
  product({
    brandSlug: "vellora",
    categorySlug: "makeup",
    description:
      "A pressed pearl highlighter in a cool pink that lands somewhere between a blush and a strobe - it lifts the cheekbone without the silver flash that a straight champagne shade throws under a phone camera. The pearl is fine rather than glittery, so it catches light in movement instead of sitting on the skin as visible specks. A light hand with a fan brush is the whole technique.",
    price: "1490.00",
    shortDescription:
      "Cool pink pressed highlighter with a fine pearl rather than visible glitter.",
    sku: "BEA-MAK-006",
    slug: "halo-highlighter",
    stockQuantity: 29,
    tagSlugs: ["new-arrival", "limited-stock", "vegan"],
    title: "Halo Highlighter"
  }),
  product({
    brandSlug: "petalworks",
    categorySlug: "makeup",
    compareAtPrice: "1490.00",
    description:
      "A coloured mascara for the days when black is more commitment than the rest of the face wants. The brush is a slim moulded bristle rather than a fibre one, which is what makes a coloured lash read as intentional instead of clumped, and the tube is small because a mascara should be replaced every three months whether or not it is finished. One coat on the top lash line is the point of it.",
    price: "1190.00",
    shortDescription: "Coloured mascara with a slim moulded brush for a clean single coat.",
    sku: "BEA-MAK-007",
    slug: "color-mascara",
    stockQuantity: 47,
    tagSlugs: ["new-arrival", "on-sale", "vegan"],
    title: "Colour Mascara"
  }),
  product({
    brandSlug: "petalworks",
    categorySlug: "makeup",
    compareAtPrice: "1590.00",
    description:
      "A volumising black mascara made without beeswax or any other animal-derived wax, which is the ingredient that usually keeps a vegan formula off the shelf. The brush is a full spiral, so it builds thickness rather than length - two coats is where it looks best and three is where it starts to clump. It removes with warm water and a cloth, no oil-based remover needed.",
    price: "1290.00",
    shortDescription:
      "Vegan volumising black mascara with a full spiral brush, removes with water.",
    sku: "BEA-MAK-008",
    slug: "vegan-mascara",
    stockQuantity: 54,
    tagSlugs: ["vegan", "cruelty-free", "on-sale"],
    title: "Vegan Volume Mascara"
  }),

  // ------------------------------------------------------------------- haircare
  product({
    brandSlug: "auralis",
    categorySlug: "haircare",
    compareAtPrice: "2190.00",
    description:
      "A 150ml argan oil with a dropper rather than a pump, because the difference between two drops and a palmful is the difference between shine and grease. It goes on damp mid-lengths before drying, or on dry ends afterwards, but not on the scalp - that is where the greasy-by-lunchtime reputation of hair oil comes from. The glass is amber for the same reason the serum bottle is.",
    price: "1790.00",
    shortDescription: "150ml argan hair oil in an amber dropper bottle, two drops per use.",
    sku: "BEA-HAI-001",
    slug: "argan-hair-oil",
    stockQuantity: 51,
    tagSlugs: ["best-seller", "clean-beauty", "on-sale"],
    title: "Argan Hair Oil"
  }),
  product({
    brandSlug: "auralis",
    categorySlug: "haircare",
    compareAtPrice: "1590.00",
    description:
      "A daily shampoo with a mild surfactant base, which lathers less than a stripping formula and worries people for exactly one wash before they notice the ends stop feeling like straw. Made for hair that gets washed four or five times a week, which is most hair in this climate. The pump is a full-size one, so it can be worked one-handed in a shower rather than needing a cap unscrewed.",
    price: "1290.00",
    shortDescription: "Mild daily shampoo for frequent washing, in a full-size pump bottle.",
    sku: "BEA-HAI-002",
    slug: "botanical-bliss-shampoo",
    stockQuantity: 88,
    tagSlugs: ["everyday-ritual", "on-sale", "vegan"],
    title: "Botanical Bliss Nourishing Shampoo"
  }),
  product({
    brandSlug: "dewline",
    categorySlug: "haircare",
    description:
      "A clarifying shampoo for once a fortnight, not for every wash - it strips product buildup, hard-water residue and oil, and doing that weekly will undo the point of the daily shampoo above. 354ml in a heavy pump bottle that stands up on a wet shelf. Follow it with the mask or the oil, because clarified hair without something after it is where the squeaky, tangled feeling comes from.",
    price: "1490.00",
    shortDescription: "Clarifying 354ml shampoo for buildup and hard water, use once a fortnight.",
    sku: "BEA-HAI-003",
    slug: "detox-shampoo",
    stockQuantity: 42,
    tagSlugs: ["clean-beauty", "everyday-ritual", "new-arrival"],
    title: "Detox Shampoo"
  }),
  product({
    brandSlug: "dewline",
    categorySlug: "haircare",
    compareAtPrice: "2290.00",
    description:
      "A volumising mask for fine hair, which is a harder brief than it sounds - most masks add weight, and weight is the one thing fine hair cannot carry. This one conditions the mid-lengths and rinses cleanly off the root, so the lift at the crown survives. Five minutes in the shower is the full instruction; leaving it on for twenty makes no difference except to the bottle.",
    price: "1890.00",
    shortDescription: "Five-minute volumising mask for fine hair that rinses clean at the root.",
    sku: "BEA-HAI-004",
    slug: "volumizing-hair-mask",
    stockQuantity: 36,
    tagSlugs: ["hydrating", "on-sale", "best-seller"],
    title: "Volumising Hair Mask"
  }),
  product({
    brandSlug: "lumen-skin",
    categorySlug: "haircare",
    compareAtPrice: "2790.00",
    description:
      "A fermented honey and protein mask in a 35g jar - a small jar because it is a weekly treatment for damaged lengths, not a conditioner. Protein masks work by temporarily filling gaps in the hair shaft, which is why they help bleached or heat-damaged hair and do nothing much for hair that is neither. Alternate it with the mint clay mask rather than using both in the same week.",
    price: "2290.00",
    shortDescription: "35g fermented honey protein mask, a weekly treatment for damaged lengths.",
    sku: "BEA-HAI-005",
    slug: "honey-protein-mask",
    stockQuantity: 23,
    tagSlugs: ["limited-stock", "clean-beauty", "on-sale"],
    title: "Fermented Honey Protein Mask"
  }),
  product({
    brandSlug: "lumen-skin",
    categorySlug: "haircare",
    description:
      "A cooling clay mask for the scalp rather than the lengths, which is the opposite of what most hair masks are for. The mint is a genuine tingle and not a fragrance note, so it is worth doing a small patch first if the scalp is already irritated. 60g in a glass jar, and about eight uses if it is kept to the roots where it belongs.",
    price: "1990.00",
    shortDescription: "60g cooling mint clay scalp mask, roughly eight treatments per jar.",
    sku: "BEA-HAI-006",
    slug: "mint-clay-hair-mask",
    stockQuantity: 33,
    tagSlugs: ["clean-beauty", "cruelty-free", "new-arrival"],
    title: "Cooling Mint Clay Hair Mask"
  }),

  // ------------------------------------------------------------------- bodycare
  product({
    brandSlug: "silkroot",
    categorySlug: "bodycare",
    compareAtPrice: "1690.00",
    description:
      "A 200ml body cream in a squeeze tube rather than a tub, which matters more than it sounds when it is being used on damp skin straight out of a shower. It is thick enough to do something for shins and elbows and light enough to dress over within a minute or two. Lightly scented, green and clean rather than floral, and it fades within the hour instead of arguing with the perfume below.",
    price: "1390.00",
    shortDescription: "200ml body cream in a squeeze tube, dressable within a minute.",
    sku: "BEA-BOD-001",
    slug: "botanical-body-cream",
    stockQuantity: 69,
    tagSlugs: ["hydrating", "everyday-ritual", "on-sale"],
    title: "Botanical Body Cream"
  }),
  product({
    brandSlug: "silkroot",
    categorySlug: "bodycare",
    compareAtPrice: "2590.00",
    description:
      "A body serum, which is still an unusual enough category that it needs explaining: it is a lightweight hydrating layer that goes on before the body cream, in the same order a face routine runs. On its own it is enough for arms and shoulders on a humid day when a cream is too much. The dropper is there for control, and the whole bottle covers roughly a month of daily use on limbs.",
    price: "2190.00",
    shortDescription: "Lightweight hydrating body serum that layers under a cream or wears alone.",
    sku: "BEA-BOD-002",
    slug: "crystalglow-body-essence",
    stockQuantity: 41,
    tagSlugs: ["new-arrival", "hydrating", "on-sale"],
    title: "Crystalglow Body Essence"
  }),

  // ------------------------------------------------------------------ fragrance
  product({
    brandSlug: "silkroot",
    categorySlug: "fragrance",
    compareAtPrice: "4690.00",
    description:
      "A 50ml eau de parfum built around bergamot and white musk, which is a combination that stays legible in heat rather than turning heavy the way an oriental base does by noon. Eau de parfum concentration means four to six hours on skin and considerably longer on a scarf. Two sprays is the dose - this is a scent that projects for the first twenty minutes and then settles close.",
    price: "3990.00",
    shortDescription: "50ml bergamot and white musk eau de parfum, four to six hours on skin.",
    sku: "BEA-FRA-001",
    slug: "eau-de-parfum",
    stockQuantity: 27,
    tagSlugs: ["best-seller", "gift-idea", "on-sale"],
    title: "Aura Eau de Parfum"
  }),

  // --------------------------------------------------------------- beauty tools
  product({
    brandSlug: "petalworks",
    categorySlug: "beauty-tools",
    compareAtPrice: "890.00",
    description:
      "A set of six latex-free blending sponges in three sizes: two large for foundation across the cheeks, two mid for the jaw and nose, two small for the under-eye and around the nostril. They are used damp, always - a dry sponge absorbs product instead of pressing it in, which is where most of the complaints about sponges come from. Six is the right count because they need washing after every second use and drying takes a day.",
    price: "690.00",
    shortDescription: "Six latex-free blending sponges in three sizes, used damp.",
    sku: "BEA-TOO-001",
    slug: "beauty-blender-sponge",
    stockQuantity: 112,
    tagSlugs: ["gift-idea", "on-sale", "everyday-ritual"],
    title: "Blending Sponge Set"
  })
] satisfies DemoPackProduct[];
