import type { DemoPackProduct, DemoPackProductImage } from "../types";

/**
 * Every product ships two frames - `<slug>-1` is the card/gallery primary and
 * `<slug>-2` is what the card swaps to on hover. Both files must exist under
 * apps/web/public/demo-assets/general/products/.
 */
function gallery(slug: string, title: string): DemoPackProductImage[] {
  return [
    { alt: `${title} - front view`, url: `/demo-assets/general/products/${slug}-1.webp` },
    { alt: `${title} - alternate view`, url: `/demo-assets/general/products/${slug}-2.webp` }
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

export const generalDemoProducts = [
  // ---------------------------------------------------------------- electronics
  product({
    brandSlug: "novaline",
    categorySlug: "electronics",
    compareAtPrice: "3490.00",
    description:
      "Over-ear headphones tuned for long listening sessions rather than one loud demo track. The earcups sit around the ear instead of pressing on it, the headband adjusts in small steps so it holds without pinching, and the padding stays breathable through a full commute. Bluetooth pairing remembers the last two devices, and a single charge covers roughly a week of daily use. A short cable is included for the times a wired connection is simply easier.",
    price: "2890.00",
    shortDescription: "Comfortable over-ear Bluetooth headphones with all-day battery and two-device pairing.",
    sku: "GEN-ELE-001",
    slug: "nova-wireless-headphones",
    stockQuantity: 42,
    tagSlugs: ["best-seller", "on-sale", "everyday-use"],
    title: "Nova Wireless Headphones"
  }),
  product({
    brandSlug: "novaline",
    categorySlug: "electronics",
    description:
      "A speaker small enough to sit in a jacket pocket that still fills a room at half volume. The rubberised shell shrugs off the knocks that come with being carried around, and a soft light ring along the base can be switched off entirely when you would rather not have it glowing. Pairs in a couple of seconds and runs about ten hours between charges, which is usually longer than the gathering it was brought to.",
    price: "1890.00",
    shortDescription: "Pocket-sized Bluetooth speaker with a soft light ring and ten-hour battery.",
    sku: "GEN-ELE-002",
    slug: "pocket-led-speaker",
    stockQuantity: 35,
    tagSlugs: ["compact", "travel-ready", "gift-idea"],
    title: "Pocket LED Speaker"
  }),
  product({
    brandSlug: "voltway",
    categorySlug: "electronics",
    compareAtPrice: "2290.00",
    description:
      "A 10,000 mAh power bank that holds enough charge for two full phone top-ups and still fits in a small bag pocket. Both the USB-C and USB-A ports can run at once, and the USB-C port takes fast input as well as output, so the bank itself refills in a couple of hours rather than overnight. Four dots on the side show the remaining charge, which is a lot more useful than guessing from a single blinking light.",
    price: "1790.00",
    shortDescription: "10,000 mAh fast-charge power bank with USB-C in/out and a four-dot charge gauge.",
    sku: "GEN-ELE-003",
    slug: "fast-charge-power-bank",
    stockQuantity: 58,
    tagSlugs: ["best-seller", "on-sale", "travel-ready"],
    title: "Fast Charge Power Bank"
  }),
  product({
    brandSlug: "voltway",
    categorySlug: "electronics",
    description:
      "A flat charging pad for the corner of a desk or a bedside table, so the phone goes down in the same place every night instead of hunting for a cable. The top surface is a grippy matt finish that keeps the phone from sliding off when a notification buzzes, and the whole pad is slim enough to sit under a monitor stand. Works through most slim cases; the braided cable is long enough to reach behind a desk.",
    price: "1290.00",
    shortDescription: "Slim wireless charging pad with a non-slip surface and braided cable.",
    sku: "GEN-ELE-004",
    slug: "wireless-charging-pad",
    stockQuantity: 47,
    tagSlugs: ["new-arrival", "home-office", "compact"],
    title: "Wireless Charging Pad"
  }),

  // --------------------------------------------------------------- home-living
  product({
    brandSlug: "hearthly",
    categorySlug: "home-living",
    compareAtPrice: "1090.00",
    description:
      "A square cushion with a soft woven cover and a filling that recovers its shape instead of flattening into a pancake after a month on the sofa. The cover unzips completely for washing, which matters far more than it sounds once the cushion has lived through a few spilled cups of tea. Sized to work either propped in a corner of a sofa or stacked two-deep against a headboard.",
    price: "890.00",
    shortDescription: "Woven throw pillow with a removable, washable cover and shape-recovering fill.",
    sku: "GEN-HOM-001",
    slug: "cozy-throw-pillow",
    stockQuantity: 64,
    tagSlugs: ["on-sale", "everyday-use", "gift-idea"],
    title: "Cozy Throw Pillow"
  }),
  product({
    brandSlug: "hearthly",
    categorySlug: "home-living",
    description:
      "A fabric basket that stands up on its own when full and folds down flat when it is not needed, which is the whole point of it. Useful for laundry, for the pile of things that live on the floor beside a bed, or for toys that need to disappear before guests arrive. Two stitched handles let it be carried between rooms without the sides collapsing inward, and the base is stiffened so it keeps its shape.",
    price: "1190.00",
    shortDescription: "Collapsible fabric storage basket with a stiffened base and carry handles.",
    sku: "GEN-HOM-002",
    slug: "foldable-storage-basket",
    stockQuantity: 48,
    tagSlugs: ["everyday-use", "budget-pick"],
    title: "Foldable Storage Basket"
  }),
  product({
    brandSlug: "hearthly",
    categorySlug: "home-living",
    compareAtPrice: "2490.00",
    description:
      "A knit blanket sized for one person on a sofa rather than for a bed, which is the size people actually reach for. The weave is open enough that it does not turn into a sweat trap indoors, but dense enough to be worth pulling over your legs on a cool evening. Finished edges mean it will not unravel from a snagged thread, and it washes without needing special handling.",
    price: "1990.00",
    shortDescription: "Single-person knit throw blanket with finished edges and a breathable weave.",
    sku: "GEN-HOM-003",
    slug: "warm-knit-throw-blanket",
    stockQuantity: 31,
    tagSlugs: ["on-sale", "gift-idea"],
    title: "Warm Knit Throw Blanket"
  }),
  product({
    brandSlug: "hearthly",
    categorySlug: "home-living",
    description:
      "A small lamp for a bedside table, with a warm bulb and a dimmer that goes low enough to read by without waking anyone else in the room. The head tilts forward so light lands on a page instead of on the ceiling, and the base is weighted enough that a reaching hand in the dark will not knock it over. A USB port on the back charges a phone overnight, which frees up the wall socket.",
    price: "1490.00",
    shortDescription: "Tilting bedside reading lamp with a low-end dimmer and built-in USB charging port.",
    sku: "GEN-HOM-004",
    slug: "bedside-reading-lamp",
    stockQuantity: 39,
    tagSlugs: ["new-arrival", "home-office"],
    title: "Bedside Reading Lamp"
  }),

  // ------------------------------------------------------------------- kitchen
  product({
    brandSlug: "brewhaus",
    categorySlug: "kitchen",
    compareAtPrice: "3890.00",
    description:
      "A drip coffee maker for households that want a pot in the morning without a routine built around it. The reservoir is marked in cups on both sides so it can be filled from either hand, the basket takes standard paper filters, and the carafe pours without dribbling down the side. The warming plate switches itself off after forty minutes, which is roughly when the coffee stops being worth drinking anyway.",
    price: "3290.00",
    shortDescription: "Drip coffee brewer with a dual-scale reservoir and auto-off warming plate.",
    sku: "GEN-KIT-001",
    slug: "everyday-coffee-brewer",
    stockQuantity: 18,
    tagSlugs: ["best-seller", "on-sale", "everyday-use"],
    title: "Everyday Coffee Brewer"
  }),
  product({
    brandSlug: "vessel-co",
    categorySlug: "kitchen",
    description:
      "Three ceramic bowls that nest into each other, so they take one bowl's worth of cupboard space instead of three. The largest handles a batch of dough, the middle one is the everyday mixing size, and the smallest ends up holding chopped onions more often than anything else. Each has a rolled rim that stays comfortable to grip when the bowl is full, and all three go in the dishwasher and the microwave.",
    price: "1790.00",
    shortDescription: "Set of three nesting ceramic mixing bowls, dishwasher and microwave safe.",
    sku: "GEN-KIT-002",
    slug: "ceramic-mixing-bowl-set",
    stockQuantity: 46,
    tagSlugs: ["everyday-use", "gift-idea"],
    title: "Ceramic Mixing Bowl Set"
  }),
  product({
    brandSlug: "brewhaus",
    categorySlug: "kitchen",
    compareAtPrice: "2690.00",
    description:
      "A 1.7-litre stainless kettle that boils and then gets out of the way. The lid opens wide enough to fill and to clean inside, the spout is shaped so it pours in a controlled stream rather than a surge, and the handle stays cool. It lifts off its base in any direction, so it does not matter which way the kettle is turned when you reach for it. Boil-dry protection cuts power if it is switched on empty.",
    price: "2190.00",
    shortDescription: "1.7-litre stainless steel kettle with a cool-touch handle and boil-dry protection.",
    sku: "GEN-KIT-003",
    slug: "stainless-steel-kettle",
    stockQuantity: 27,
    tagSlugs: ["on-sale", "everyday-use"],
    title: "Stainless Steel Kettle"
  }),
  product({
    brandSlug: "vessel-co",
    categorySlug: "kitchen",
    description:
      "A double-walled lunch container that keeps a hot meal genuinely warm until midday rather than lukewarm by ten. The lid seals with a silicone gasket and a clip on each side, so it can travel in a bag lying on its side without leaking into everything else. Wide enough at the mouth to eat straight from, and to actually get a sponge into when washing up.",
    price: "1590.00",
    shortDescription: "Double-walled insulated lunch container with a leak-sealed clip lid.",
    sku: "GEN-KIT-004",
    slug: "insulated-lunch-container",
    stockQuantity: 52,
    tagSlugs: ["reusable", "travel-ready", "everyday-use"],
    title: "Insulated Lunch Container"
  }),

  // -------------------------------------------------------------------- office
  product({
    brandSlug: "deskline",
    categorySlug: "office",
    compareAtPrice: "2790.00",
    description:
      "An aluminium stand that lifts a laptop screen to something closer to eye level, which is the cheapest fix there is for a sore neck at the end of a working day. Six height positions lock firmly enough that the laptop does not sink under typing pressure. The open frame lets air reach the underside, and silicone pads hold the machine in place without marking the lid. It folds flat enough to slide into a backpack sleeve.",
    price: "2290.00",
    shortDescription: "Foldable aluminium laptop stand with six locking heights and open-frame cooling.",
    sku: "GEN-OFF-001",
    slug: "adjustable-laptop-stand",
    stockQuantity: 33,
    tagSlugs: ["best-seller", "on-sale", "home-office"],
    title: "Adjustable Laptop Stand"
  }),
  product({
    brandSlug: "papermark",
    categorySlug: "office",
    description:
      "Three A5 notebooks with paper chosen so that a gel or fountain pen does not bleed through to the other side of the page. Each one lies flat when opened, which sounds minor until you have tried to write in the gutter of a notebook that keeps snapping shut. Ruled pages, a card cover stiff enough to write against while standing, and a ribbon marker in each.",
    price: "690.00",
    shortDescription: "Set of three A5 ruled notebooks with bleed-resistant paper that lie flat when open.",
    sku: "GEN-OFF-002",
    slug: "smooth-writing-notebook-set",
    stockQuantity: 90,
    tagSlugs: ["budget-pick", "home-office", "gift-idea"],
    title: "Smooth Writing Notebook Set"
  }),
  product({
    brandSlug: "deskline",
    categorySlug: "office",
    description:
      "A shallow tray that collects the small things that otherwise migrate across a desk all day - pens, a phone, keys, the one cable that always goes missing. Three compartments of different sizes, a felt-lined base so nothing rattles or gets scratched, and a footprint that fits between a keyboard and the edge of most desks. Stackable with a second tray if one turns out not to be enough.",
    price: "1090.00",
    shortDescription: "Three-compartment desk organiser tray with a felt-lined, non-scratch base.",
    sku: "GEN-OFF-003",
    slug: "desk-organiser-tray",
    stockQuantity: 61,
    tagSlugs: ["home-office", "everyday-use"],
    title: "Desk Organiser Tray"
  }),
  product({
    brandSlug: "papermark",
    categorySlug: "office",
    description:
      "Ten gel pens in a 0.5 mm point, which is fine enough for margin notes but not so fine that it tears through cheap paper. The ink dries quickly enough that a left-handed writer can get through a page without smearing it, and the barrels have a rubberised grip for long note-taking sessions. Five black, three blue, two red - the split most people actually use.",
    price: "390.00",
    shortDescription: "Ten quick-drying 0.5 mm gel pens with rubberised grips, in black, blue and red.",
    sku: "GEN-OFF-004",
    slug: "gel-pen-set-of-10",
    stockQuantity: 120,
    tagSlugs: ["budget-pick", "everyday-use"],
    title: "Gel Pen Set of 10"
  }),

  // -------------------------------------------------------------------- sports
  product({
    brandSlug: "peakline",
    categorySlug: "sports",
    compareAtPrice: "990.00",
    description:
      "A 750 ml training bottle with a flip cap that can be opened one-handed mid-set, which is the only thing that really matters in a gym bottle. The body is a soft-touch plastic that does not turn slippery when hands are wet, and volume markings run up the side so it doubles as a rough water tracker. Fits standard bike cages and the side pocket of most backpacks.",
    price: "790.00",
    shortDescription: "750 ml training bottle with a one-handed flip cap and volume markings.",
    sku: "GEN-SPO-001",
    slug: "flex-training-bottle",
    stockQuantity: 82,
    tagSlugs: ["on-sale", "fitness", "reusable"],
    title: "Flex Training Bottle"
  }),
  product({
    brandSlug: "peakline",
    categorySlug: "sports",
    description:
      "A 6 mm mat with enough padding for knees during floor work but not so much that balance poses turn wobbly. The textured top holds grip once hands get sweaty, which is the point at which thinner mats start sliding across a hard floor. Closed-cell surface so sweat sits on top and wipes off rather than soaking in. Rolls up with an included strap for carrying.",
    price: "1690.00",
    shortDescription: "6 mm non-slip yoga mat with a textured, wipe-clean surface and carry strap.",
    sku: "GEN-SPO-002",
    slug: "non-slip-yoga-mat",
    stockQuantity: 44,
    tagSlugs: ["fitness", "new-arrival"],
    title: "Non-Slip Yoga Mat"
  }),
  product({
    brandSlug: "peakline",
    categorySlug: "sports",
    description:
      "A skipping rope with a steel cable that can be cut to length, so it matches your height instead of forcing you to work around a loop that is too long. The handles spin on sealed bearings, which is what keeps the rope turning smoothly at speed rather than snagging every third rotation. Weighted enough to feel the rhythm, light enough to keep going past the first minute.",
    price: "590.00",
    shortDescription: "Adjustable-length steel skipping rope with sealed-bearing handles.",
    sku: "GEN-SPO-003",
    slug: "adjustable-skipping-rope",
    stockQuantity: 73,
    tagSlugs: ["fitness", "budget-pick", "compact"],
    title: "Adjustable Skipping Rope"
  }),
  product({
    brandSlug: "peakline",
    categorySlug: "sports",
    compareAtPrice: "1390.00",
    description:
      "Five loop bands covering a light-to-heavy range, so the same set works for warming up and for the point months later when the light band has stopped doing anything. Each band is a different colour with the resistance printed on it, which saves guessing mid-session. Fabric-backed on the inside so they grip skin instead of rolling up the thigh, and the whole set packs into a mesh bag the size of a fist.",
    price: "1090.00",
    shortDescription: "Five fabric-backed resistance loop bands from light to heavy, with a mesh bag.",
    sku: "GEN-SPO-004",
    slug: "resistance-band-set",
    stockQuantity: 66,
    tagSlugs: ["on-sale", "fitness", "compact"],
    title: "Resistance Band Set"
  }),

  // --------------------------------------------------------------- accessories
  product({
    brandSlug: "trailform",
    categorySlug: "accessories",
    compareAtPrice: "3590.00",
    description:
      "A 22-litre backpack built around a padded laptop sleeve that sits against your back rather than at the bottom, so a dropped bag does not land on the machine. Water-resistant fabric handles a sudden shower, and a zipped pocket on the back panel keeps a wallet and phone out of reach in a crowd. The shoulder straps are wide enough to carry a full load comfortably on a long walk.",
    price: "2990.00",
    shortDescription: "22-litre water-resistant backpack with a suspended laptop sleeve and hidden back pocket.",
    sku: "GEN-ACC-001",
    slug: "city-travel-backpack",
    stockQuantity: 27,
    tagSlugs: ["best-seller", "on-sale", "travel-ready"],
    title: "City Travel Backpack"
  }),
  product({
    brandSlug: "trailform",
    categorySlug: "accessories",
    description:
      "A canvas tote with a flat base, so it stands up on a counter while being packed instead of folding over on itself. The handles are long enough to go over a shoulder while wearing a coat, and reinforced where they meet the body, which is where cheap totes give out first. One inner pocket holds keys and a phone so they are not buried under groceries.",
    price: "890.00",
    shortDescription: "Flat-based canvas tote with reinforced shoulder-length handles and an inner pocket.",
    sku: "GEN-ACC-002",
    slug: "everyday-tote-bag",
    stockQuantity: 85,
    tagSlugs: ["reusable", "everyday-use", "budget-pick"],
    title: "Everyday Tote Bag"
  }),
  product({
    brandSlug: "vessel-co",
    categorySlug: "accessories",
    description:
      "A 400 ml travel mug that fits in a car cup holder, which rules out a surprising number of the alternatives. The lid seals shut for a bag and opens to a drinking slot with a twist, so it can go from commute to desk without being unscrewed. Double-walled, so it stays hot for hours and the outside never gets too warm to hold. The lid comes apart for cleaning rather than trapping old coffee in a seal.",
    price: "1390.00",
    shortDescription: "400 ml insulated travel mug with a twist-seal lid that fits a car cup holder.",
    sku: "GEN-ACC-003",
    slug: "insulated-travel-mug",
    stockQuantity: 58,
    tagSlugs: ["reusable", "travel-ready", "gift-idea"],
    title: "Insulated Travel Mug"
  }),
  product({
    brandSlug: "trailform",
    categorySlug: "accessories",
    description:
      "A card wallet for people who carry four cards and some folded notes and resent the bulk of anything larger. Holds six cards across two slots, with a pull-tab that pushes the back cards forward so the one you want is not always the one at the bottom. Slim enough for a front pocket, where it is harder to lose and harder to pickpocket than in a back one.",
    price: "990.00",
    shortDescription: "Six-card slim wallet with a pull-tab for quick access, sized for a front pocket.",
    sku: "GEN-ACC-004",
    slug: "slim-card-wallet",
    stockQuantity: 94,
    tagSlugs: ["compact", "gift-idea", "new-arrival"],
    title: "Slim Card Wallet"
  })
] satisfies DemoPackProduct[];
